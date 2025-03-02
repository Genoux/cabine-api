import { Request, Response } from 'express';
import { wolService, lifxService } from '../services/index.js';
import { LightState } from '../services/lifx.service.js';
import os from 'os';
import { config } from '../config.js';

export class StatusController {
  /**
   * Get overall system status
   */
  public async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const uptime = process.uptime();
      const memory = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      };
      
      const isPCOnline = await wolService.isPCOnline();
      
      const lightsStatus: Record<string, Partial<LightState> & { online: boolean }> = {};
      const lights = lifxService.getAllLights();
      
      for (const light of lights) {
        try {
          const state = await lifxService.getLightState(light.name);
          if (state) {
            lightsStatus[light.name] = {
              online: true,
              power: state.power,
              brightness: state.brightness,
              color: state.color
            };
          } else {
            lightsStatus[light.name] = { 
              online: false,
              power: 'off'
            };
          }
        } catch (error) {
          lightsStatus[light.name] = { 
            online: false,
            power: 'off',
          };
        }
      }
      
      return res.status(200).json({
        success: true,
        serverStatus: {
          uptime: uptime,
          uptimeFormatted: formatUptime(uptime),
          memory: memory,
          memoryUsage: `${Math.round((memory.used / memory.total) * 100)}%`,
          hostname: os.hostname(),
          platform: os.platform(),
          version: process.version
        },
        pcStatus: {
          online: isPCOnline,
          ip: config.wol.pcIp || 'Not configured'
        },
        lightsStatus: lightsStatus,
        config: {
          lifxLightsCount: lights.length,
          wolConfigured: !!config.wol.macAddress,
          sleepConfigured: !!(config.wol.pcIp && config.wol.pcUser && config.wol.pcPassword)
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get system status',
        error: (error as Error).message
      });
    }
  }
}

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export const statusController = new StatusController();
export default statusController;