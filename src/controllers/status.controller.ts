import { Request, Response } from 'express';
import { pcControlService } from '../services/index.js';
import { config } from '../config.js';

export class StatusController {
  /**
   * Get overall system status
   */
  public async getStatus(_req: Request, res: Response): Promise<Response> {
    try {
      const isPCOnline = await pcControlService.isPCOnline();
      console.log(isPCOnline);
      return res.status(200).json({
        success: true,
        system: 'Office Control System - Simplified & Clean',
        pc: {
          macAddress: config.pc.macAddress,
          ipAddress: config.pc.ipAddress,
          online: isPCOnline,
        },
        lifx: {
          configured: !!config.lifx.apiToken,
        },
        endpoints: [
          '/webhooks/arrive',
          '/webhooks/leave', 
          '/webhooks/wake-pc',
          '/webhooks/sleep-pc',
          '/webhooks/lights-on',
          '/webhooks/lights-off',
        ],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get system status',
        error: (error as Error).message,
      });
    }
  }
}

export const statusController = new StatusController();
export default statusController;