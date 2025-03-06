import { Request, Response } from 'express';
import { wolService, lifxService } from '../services/index.js';
import { config } from '../config.js';

export class StatusController {
  /**
   * Get overall system status
   */
  public async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const isPCOnline = await wolService.isPCOnline();

      const lights = lifxService.getAllLights();

      const lightsStatus: Record<string, {
        online: boolean;
        power: 'on' | 'off';
      }> = {};

      for (const light of lights) {
        try {
          const state = await lifxService.getLightState(light.name);

          if (state && Array.isArray(state) && state.length > 0) {
            lightsStatus[light.name] = {
              online: state[0].connected,
              power: state[0].power
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
            power: 'off'
          };
        }
      }

      return res.status(200).json({
        success: true,
        pcStatus: {
          ip: config.wol.pcIp,
          online: isPCOnline
        },
        lightsStatus: lightsStatus
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

export const statusController = new StatusController();
export default statusController;