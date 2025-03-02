import wol from 'wol';
import { exec } from 'child_process';
import { Client } from 'ssh2';
import ping from 'ping';
import { Socket } from 'net';
import { config } from '../config.js';
import logger from '../utils/logger.js';

interface WakePCResult {
  success: boolean;
  elapsedMs: number;
  attempts: number;
}

export class WolService {
  private readonly macAddress: string;
  private readonly ipAddress: string;
  private readonly port: number;
  private readonly pcIp: string;
  private readonly pcUser: string;
  private readonly pcPassword: string;
  private readonly sshPort: number;

  constructor() {
    this.macAddress = config.wol.macAddress;
    this.ipAddress = config.wol.ipAddress;
    this.port = config.wol.port;
    this.pcIp = config.wol.pcIp || '';
    this.pcUser = config.wol.pcUser || '';
    this.pcPassword = config.wol.pcPassword || '';
    this.sshPort = 22;
  }

  /**
   * Just send the WOL packet without waiting for verification
   */
  public async sendWolPacket(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      logger.info(`Sending WOL packet to ${this.macAddress} via ${this.ipAddress}:${this.port}`);
      wol.wake(
        this.macAddress,
        {
          address: this.ipAddress,
          port: this.port,
        },
        (error: Error | null) => {
          if (error) {
            logger.error({ error, macAddress: this.macAddress }, 'Failed to send WOL packet');
            reject(error);
            return;
          }
          logger.info('WOL packet sent successfully');
          resolve(true);
        },
      );
    });
  }

  /**
   * Wake PC and verify it comes online within timeout period
   * Returns detailed result with success status, elapsed time, and attempt count
   */
  public async wakePC(maxWaitTime: number = 60000): Promise<WakePCResult> {
    const startTime = Date.now();
    let attempts = 0;

    // Check if already online
    if (await this.isPCOnline()) {
      return {
        success: true,
        elapsedMs: 0,
        attempts: 1,
      };
    }

    // Send WOL packet
    try {
      await this.sendWolPacket();

      // Try subnet broadcast as well
      if (this.pcIp) {
        const ipParts = this.pcIp.split('.');
        if (ipParts.length === 4) {
          const subnetBroadcast = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.255`;
          logger.info(`Sending additional WOL packet to subnet broadcast ${subnetBroadcast}`);
          await new Promise<void>((resolve) => {
            wol.wake(
              this.macAddress,
              {
                address: subnetBroadcast,
                port: this.port,
              },
              () => resolve(),
            );
          });
        }
      }

      // Check every second until PC is online or timeout
      logger.info(`Beginning connection checks (max wait time: ${maxWaitTime}ms)...`);

      while (Date.now() - startTime < maxWaitTime) {
        attempts++;
        logger.info(`Attempt #${attempts}: Checking if PC is online...`);

        // Try multiple check methods to increase reliability
        const isOnline = await this.robustOnlineCheck();

        if (isOnline) {
          const elapsedMs = Date.now() - startTime;
          logger.info(`Attempt #${attempts}: SUCCESS - PC is online after ${elapsedMs}ms`);
          return {
            success: true,
            elapsedMs,
            attempts,
          };
        }

        logger.info(`Attempt #${attempts}: FAILED - PC not yet online`);

        // Wait 1 second before next check
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Timeout reached
      const elapsedMs = Date.now() - startTime;
      logger.warn(`Verification timeout after ${elapsedMs}ms and ${attempts} attempts`);
      return {
        success: false,
        elapsedMs,
        attempts,
      };
    } catch (error) {
      logger.error({ error }, 'Error in wakeAndVerify process');
      return {
        success: false,
        elapsedMs: Date.now() - startTime,
        attempts,
      };
    }
  }

  /**
   * Try multiple methods to check if PC is online
   * Returns true if any method succeeds
   */
  private async robustOnlineCheck(): Promise<boolean> {
    // Try checking via SSH connection first
    try {
      const isSSHReachable = await this.isSSHReachable();
      if (isSSHReachable) {
        logger.debug('PC is online (SSH connection successful)');
        return true;
      }
    } catch (error) {
      // Ignore errors, just continue to next check method
    }

    // Try ping library
    try {
      const pingResult = await ping.promise.probe(this.pcIp);
      if (pingResult.alive) {
        logger.debug('PC is online (ping successful)');
        return true;
      }
    } catch (error) {
      // Ignore errors, just continue to next check method
    }

    // Try socket connection to common port (RDP)
    try {
      const isRDPReachable = await this.isPortReachable(3389);
      if (isRDPReachable) {
        logger.debug('PC is online (RDP port reachable)');
        return true;
      }
    } catch (error) {
      // Ignore errors, just continue to next check method
    }

    // Try system ping command as last resort
    try {
      const isPingable = await this.isPCOnline();
      if (isPingable) {
        logger.debug('PC is online (system ping successful)');
        return true;
      }
    } catch (error) {
      // Ignore errors
    }

    // All methods failed
    return false;
  }

  /**
   * Check if SSH is reachable
   */
  private async isSSHReachable(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.pcIp || !this.pcUser || !this.pcPassword) {
        resolve(false);
        return;
      }

      const conn = new Client();

      conn.on('ready', () => {
        logger.debug('SSH connection successful');
        conn.end();
        resolve(true);
      });

      conn.on('error', () => {
        resolve(false);
      });

      conn.connect({
        host: this.pcIp,
        port: this.sshPort,
        username: this.pcUser,
        password: this.pcPassword,
        readyTimeout: 1000,
        timeout: 1000,
      });
    });
  }

  /**
   * Check if a specific port is reachable
   */
  private async isPortReachable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.pcIp) {
        resolve(false);
        return;
      }

      const socket = new Socket();

      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, this.pcIp);
    });
  }

  /**
   * Check if the PC is online using system ping command
   */
  public async isPCOnline(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.pcIp) {
        logger.warn('PC IP not configured for status check');
        resolve(false);
        return;
      }

      const pingCommand =
        process.platform === 'win32'
          ? `ping -n 1 -w 1000 ${this.pcIp}`
          : `ping -c 1 -W 1 ${this.pcIp}`;

      exec(pingCommand, (error) => {
        if (error) {
          logger.debug(`PC at ${this.pcIp} is offline`);
          resolve(false);
          return;
        }
        logger.debug(`PC at ${this.pcIp} is online`);
        resolve(true);
      });
    });
  }

  /**
   * Put the PC to sleep
   */
  public async sleepPC(): Promise<boolean> {
    try {
      // Check if already offline
      if (!(await this.isPCOnline())) {
        logger.info('PC is already offline');
        return true;
      }

      // Send sleep command via SSH
      logger.info(`Sending sleep command to ${this.pcIp}`);

      try {
        await this.sendSleepCommand();
      } catch (error) {
        logger.warn({ error }, 'Error sending sleep command, continuing to check status');
      }

      // Wait for PC to go offline (max 2 minutes)
      logger.info('Waiting for PC to go offline (max 2 minutes)...');
      const startTime = Date.now();
      const maxWaitTime = 2 * 60 * 1000; // 2 minutes

      while (Date.now() - startTime < maxWaitTime) {
        // Use ping for offline check
        const pingResult = await ping.promise.probe(this.pcIp);
        if (!pingResult.alive) {
          logger.info('PC is now offline');
          return true;
        }

        // Wait 5 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      logger.warn('PC did not go offline within timeout period');
      return false;
    } catch (error) {
      logger.error({ error }, 'Error in sleepPC process');
      throw error;
    }
  }

  /**
   * Send sleep command via SSH
   */
  private async sendSleepCommand(): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        logger.info('SSH connection timeout');
        resolve();
      }, 5000);

      conn.on('ready', () => {
        logger.info('SSH connection established');
        conn.exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', (err) => {
          clearTimeout(timeout);

          if (err) {
            logger.error({ error: err }, 'Failed to execute sleep command');
            conn.end();
            reject(err);
            return;
          }

          logger.info('Sleep command sent successfully');
          conn.end();
          resolve();
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        logger.error({ error: err }, 'SSH connection error');
        reject(err);
      });

      conn.connect({
        host: this.pcIp,
        port: this.sshPort,
        username: this.pcUser,
        password: this.pcPassword,
        readyTimeout: 3000,
      });
    });
  }
}

export const wolService = new WolService();
export default wolService;
