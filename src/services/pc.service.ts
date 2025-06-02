import wol from 'wol';
import { Client } from 'ssh2';
import ping from 'ping';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export class PcControlService {
  private readonly macAddress: string;
  private readonly ipAddress: string;
  private readonly sshUser?: string;
  private readonly sshPassword?: string;
  private readonly sshKeyPath?: string;

  constructor() {
    this.macAddress = config.pc.macAddress;
    this.ipAddress = config.pc.ipAddress;
    this.sshUser = config.pc.sshUser;
    this.sshPassword = config.pc.sshPassword;
    this.sshKeyPath = config.pc.sshKeyPath;
    
    logger.info(`Initialized PC control service for ${this.macAddress}`);
  }

  /**
   * Send Wake-on-LAN packet to wake up the PC and wait for it to come online
   */
  public async wakePC(): Promise<{ success: boolean; attempts: number; isOnline: boolean }> {
    return new Promise((resolve, reject) => {
      logger.info(`Sending WOL packet to ${this.macAddress}`);
      
      wol.wake(this.macAddress, async (error: Error | null) => {
        if (error) {
          logger.error({ error, macAddress: this.macAddress }, 'Failed to send WOL packet');
          reject(error);
          return;
        }
        
        logger.info('WOL packet sent successfully');
        
        const result = await this.pollForStatusChange(true);
        resolve(result);
      });
    });
  }

  /**
   * Check if PC is online using system ping
   */
  public async isPCOnline(): Promise<boolean> {
    try {
      logger.debug(`Checking if PC at ${this.ipAddress} is online`);
      
      const result = await ping.promise.probe(this.ipAddress, {
        timeout: 3,
        min_reply: 1,
      });
      
      logger.debug(`PC online check: ${result.alive ? 'online' : 'offline'} (time: ${result.time}ms)`);
      return result.alive;
    } catch (error) {
      logger.debug(`PC at ${this.ipAddress} is offline - ping error: ${error}`);
      return false;
    }
  }

  /**
   * Put the PC to sleep and wait for it to go offline using SSH command
   */
  public async sleepPC(): Promise<{ success: boolean; attempts: number; isOnline: boolean }> {
    if (!this.sshUser) {
      logger.warn('SSH user not configured, cannot send system commands');
      return { success: false, attempts: 0, isOnline: true };
    }

    if (!this.sshKeyPath) {
      logger.warn('SSH key path not configured, cannot send system commands');
      return { success: false, attempts: 0, isOnline: true };
    }

    return new Promise((resolve) => {
      const conn = new Client();

      conn.on('ready', () => {
        logger.info('SSH connection established, sending sleep command');
        
        const command = `systemctl suspend`;
        logger.info(`Executing sleep command: ${command}`);

        conn.exec(command, async (err, stream) => {
          if (err) {
            logger.error(`Sleep command exec failed: ${err.message}`);
            conn.end();
            resolve({ success: false, attempts: 0, isOnline: true });
            return;
          }

          let output = '';
          let errorOutput = '';

          stream.on('close', async (code: number) => {
            logger.info(`Sleep command completed with exit code: ${code}`);
            
            if (output.trim()) {
              logger.debug(`Command output: ${output.trim()}`);
            }
            
            if (errorOutput.trim()) {
              logger.warn(`Command stderr: ${errorOutput.trim()}`);
            }

            if (code === 0) {
              logger.info('Sleep command executed successfully');
              conn.end();
              
              const result = await this.pollForStatusChange(false);
              resolve(result);
            } else {
              logger.error(`Sleep command failed with exit code ${code}`);
              conn.end();
              resolve({ success: false, attempts: 0, isOnline: true });
            }
          });

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        logger.error({ error: err }, 'SSH connection failed');
        resolve({ success: false, attempts: 0, isOnline: true });
      });

      try {
        const privateKey = readFileSync(this.sshKeyPath!);
        logger.debug('Using SSH key authentication');
        
        conn.connect({
          host: this.ipAddress,
          port: 22,
          username: this.sshUser,
          privateKey: privateKey,
          readyTimeout: 5000,
        });
      } catch (error) {
        logger.error(`Failed to read SSH key from ${this.sshKeyPath}:`, error);
        resolve({ success: false, attempts: 0, isOnline: true });
      }
    });
  }

  /**
   * Shutdown the PC using SSH command (passwordless sudo)
   */
  public async shutdownPC(): Promise<boolean> {
    return this.executeSystemCommand('poweroff', 'Shutdown');
  }

  /**
   * Reboot the PC using SSH command (passwordless sudo)
   */
  public async rebootPC(): Promise<boolean> {
    return this.executeSystemCommand('reboot', 'Reboot');
  }

  /**
   * Execute a system command via SSH (requires passwordless sudo setup)
   */
  private async executeSystemCommand(action: string, actionName: string): Promise<boolean> {
    if (!this.sshUser || !this.sshPassword) {
      logger.warn('SSH credentials not configured, cannot send system commands');
      return false;
    }

    return new Promise((resolve) => {
      const conn = new Client();

      conn.on('ready', () => {
        logger.info(`SSH connection established, sending ${actionName.toLowerCase()} command`);
        
        const command = `sudo systemctl ${action}`;
        logger.info(`Executing ${actionName.toLowerCase()} command: ${command}`);

        conn.exec(command, (err, stream) => {
          if (err) {
            logger.error(`${actionName} command exec failed: ${err.message}`);
            conn.end();
            resolve(false);
            return;
          }

          let output = '';
          let errorOutput = '';

          stream.on('close', (code: number) => {
            logger.info(`${actionName} command completed with exit code: ${code}`);
            
            if (output.trim()) {
              logger.debug(`Command output: ${output.trim()}`);
            }
            
            if (errorOutput.trim()) {
              logger.warn(`Command stderr: ${errorOutput.trim()}`);
            }

            if (code === 0) {
              logger.info(`${actionName} command executed successfully`);
              conn.end();
              resolve(true);
            } else {
              logger.error(`${actionName} command failed with exit code ${code}`);
              conn.end();
              resolve(false);
            }
          });

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        logger.error({ error: err }, 'SSH connection failed');
        resolve(false);
      });

      conn.connect({
        host: this.ipAddress,
        port: 22,
        username: this.sshUser,
        password: this.sshPassword,
        readyTimeout: 5000,
      });
    });
  }

  /**
   * Poll for PC status change with timeout
   */
  private async pollForStatusChange(
    expectedOnline: boolean,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<{ success: boolean; attempts: number; isOnline: boolean }> {
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      attempts++;
      
      logger.debug(`Checking PC status (attempt ${attempts})...`);
      const currentStatus = await this.isPCOnline();
      
      if (currentStatus === expectedOnline) {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        const action = expectedOnline ? 'came online' : 'went offline';
        logger.info(`PC ${action} after ${elapsedSeconds} seconds (${attempts} attempts)`);
        return { success: true, attempts: elapsedSeconds, isOnline: currentStatus };
      }
    }
    
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    const finalStatus = await this.isPCOnline();
    return { success: false, attempts: elapsedSeconds, isOnline: finalStatus };
  }
}

export const pcControlService = new PcControlService();
export default pcControlService;
