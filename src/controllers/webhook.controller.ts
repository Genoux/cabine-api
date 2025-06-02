import { Request, Response } from 'express';
import { pcControlService, lifxService } from '../services/index.js';
import logger from '../utils/logger.js';
import { config } from '../config.js';

export const authenticateWebhook = (req: Request, res: Response, next: (err?: Error) => void) => {
  const secret = req.headers['x-webhook-secret'];

  if (secret !== config.security.webhookSecret) {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
        providedSecret: secret,
      },
      'Unauthorized webhook request',
    );

    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  next();
};

export class WebhookController {
  /**
   * Wake up the PC
   */
  public async wakePC(_req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Wake PC request received');

      const isPCOnline = await pcControlService.isPCOnline();
      if (isPCOnline) {
        return res.status(200).json({
          success: true,
          message: 'PC is already online',
          isPCOnline: true,
        });
      }

      const result = await pcControlService.wakePC();

      return res.status(200).json({
        success: true,
        message: result.success
          ? `Wake-on-LAN successful - PC came online after ${result.attempts} seconds`
          : 'Wake-on-LAN packet sent - PC did not respond within 30 seconds (may still be starting)',
        isPCOnline: result.isOnline,
        waitTimeSeconds: result.attempts,
      });
    } catch (error) {
      logger.error({ error }, 'Error sending Wake-on-LAN packet');
      return res.status(500).json({
        success: false,
        message: 'Failed to send Wake-on-LAN packet',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Put the PC to sleep
   */
  public async sleepPC(_req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Sleep PC request received');

      const isPCOnline = await pcControlService.isPCOnline();
      if (!isPCOnline) {
        return res.status(400).json({
          success: false,
          message: 'PC appears to be offline already',
          isPCOnline: false,
        });
      }

      const result = await pcControlService.sleepPC();

      return res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.success
          ? `Sleep successful - PC went offline after ${result.attempts} seconds`
          : 'Sleep command sent - PC did not go offline within 30 seconds (may still be shutting down)',
        isPCOnline: result.isOnline,
        waitTimeSeconds: result.attempts,
      });
    } catch (error) {
      logger.error({ error }, 'Error sending sleep command to PC');
      return res.status(500).json({
        success: false,
        message: 'Failed to send sleep command to PC',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Turn on all lights
   */
  public async lightsOn(_req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Turn on lights request received');

      const success = await lifxService.turnOnAll();

      return res.status(success ? 200 : 500).json({
        success,
        message: success
          ? 'All lights turned on successfully'
          : 'Failed to turn on lights',
      });
    } catch (error) {
      logger.error({ error }, 'Error turning on lights');
      return res.status(500).json({
        success: false,
        message: 'Error turning on lights',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Turn off all lights
   */
  public async lightsOff(_req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Turn off lights request received');

      const success = await lifxService.turnOffAll();

      return res.status(success ? 200 : 500).json({
        success,
        message: success
          ? 'All lights turned off successfully'
          : 'Failed to turn off lights',
      });
    } catch (error) {
      logger.error({ error }, 'Error turning off lights');
      return res.status(500).json({
        success: false,
        message: 'Error turning off lights',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Office arrival sequence - wake PC and turn on lights
   */
  public async arrive(req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Office arrival sequence initiated');

      const isPCOnline = await pcControlService.isPCOnline();

      const [pcResult, lightsResult] = await Promise.allSettled([
        isPCOnline ? Promise.resolve({ success: true, attempts: 0, isOnline: true }) : pcControlService.wakePC(),
        lifxService.turnOnAll(),
      ]);

      const pcSuccess = pcResult.status === 'fulfilled' && pcResult.value.success;
      const pcData = pcResult.status === 'fulfilled' ? pcResult.value : { success: false, attempts: 0, isOnline: false };
      const lightsSuccess = lightsResult.status === 'fulfilled' && lightsResult.value;

      return res.status(200).json({
        success: true,
        message: 'Office arrival sequence completed',
        results: {
          pc: {
            success: pcSuccess,
            message: isPCOnline
              ? 'PC was already online'
              : pcSuccess
                ? `Wake-on-LAN successful - PC came online after ${pcData.attempts} seconds`
                : 'Failed to wake PC',
            wasAlreadyOnline: isPCOnline,
            waitTimeSeconds: pcData.attempts,
          },
          lights: {
            success: lightsSuccess,
            message: lightsSuccess ? 'Lights turned on' : 'Failed to turn on lights',
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error in office arrival sequence');
      return res.status(500).json({
        success: false,
        message: 'Error in office arrival sequence',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Office departure sequence - sleep PC and turn off lights
   */
  public async leave(_req: Request, res: Response): Promise<Response> {
    try {
      logger.info('Office departure sequence initiated');

      const isPCOnline = await pcControlService.isPCOnline();

      const [pcResult, lightsResult] = await Promise.allSettled([
        isPCOnline ? pcControlService.sleepPC() : Promise.resolve({ success: true, attempts: 0, isOnline: false }),
        lifxService.turnOffAll(),
      ]);

      const pcSuccess = pcResult.status === 'fulfilled' && pcResult.value.success;
      const pcData = pcResult.status === 'fulfilled' ? pcResult.value : { success: false, attempts: 0, isOnline: true };
      const lightsSuccess = lightsResult.status === 'fulfilled' && lightsResult.value;

      return res.status(200).json({
        success: true,
        message: 'Office departure sequence completed',
        results: {
          pc: {
            success: pcSuccess,
            message: !isPCOnline
              ? 'PC was already offline'
              : pcSuccess
                ? `Sleep successful - PC went offline after ${pcData.attempts} seconds`
                : 'Failed to sleep PC',
            wasAlreadyOffline: !isPCOnline,
            waitTimeSeconds: pcData.attempts,
          },
          lights: {
            success: lightsSuccess,
            message: lightsSuccess ? 'Lights turned off' : 'Failed to turn off lights',
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error in office departure sequence');
      return res.status(500).json({
        success: false,
        message: 'Error in office departure sequence',
        error: (error as Error).message,
      });
    }
  }
}

export const webhookController = new WebhookController();
export default webhookController;
