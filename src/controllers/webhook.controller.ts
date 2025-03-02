import { Request, Response } from 'express';
import { wolService, lifxService } from '../services/index.js';
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
  public async wakePC(req: Request, res: Response): Promise<Response> {
    try {
      const isAlreadyOnline = await wolService.isPCOnline();
      if (isAlreadyOnline) {
        return res.status(200).json({
          success: true,
          message: 'PC is already online',
          isOnline: true,
        });
      }

      if (req.query.verify === 'false') {
        await wolService.sendWolPacket();
        return res.status(202).json({
          success: true,
          message: 'Wake-on-LAN packet sent successfully',
          verificationSkipped: true,
        });
      }

      const maxWaitTime = req.body.maxWaitTime ? parseInt(req.body.maxWaitTime) : 60000;

      logger.info(`Waking PC with verification (max wait time: ${maxWaitTime}ms)`);
      const result = await wolService.wakePC(maxWaitTime);

      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `PC successfully woken up after ${result.elapsedMs}ms`,
          isOnline: true,
          attempts: result.attempts,
          elapsedTime: `${(result.elapsedMs / 1000).toFixed(1)} seconds`,
        });
      } else {
        return res.status(202).json({
          success: true,
          message:
            'Wake-on-LAN packet sent, but PC did not come online within the verification period',
          isOnline: false,
          attempts: result.attempts,
          suggestion:
            'You may need to increase the maxWaitTime parameter or check your WOL configuration',
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error sending Wake-on-LAN packet');
      return res.status(500).json({
        success: false,
        message: 'Failed to send Wake-on-LAN packet',
        error: (error as Error).message,
      });
    }
  }

  public async controlLight(req: Request, res: Response): Promise<Response> {
    const lightName = req.params.name;
    const action = req.params.action;

    if (!lightName) {
      return res.status(400).json({
        success: false,
        message: 'Light name is required',
      });
    }

    try {
      const duration = req.body.duration ? parseFloat(req.body.duration) : 1.0;
      let success = false;

      if (action === 'on') {
        success = await lifxService.turnOn(lightName, duration);
      } else if (action === 'off') {
        success = await lifxService.turnOff(lightName, duration);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "on" or "off"',
        });
      }

      if (success) {
        return res.status(200).json({
          success: true,
          message: `Light ${lightName} turned ${action} successfully`,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: `Failed to turn ${action} light ${lightName}. Light not found or API error.`,
        });
      }
    } catch (error) {
      logger.error({ error, lightName, action }, 'Error controlling light');
      return res.status(500).json({
        success: false,
        message: 'Error controlling light',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Control a group of lights
   */
  public async controlLightGroup(req: Request, res: Response): Promise<Response> {
    const groupName = req.params.name;
    const action = req.params.action;

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }

    try {
      const duration = req.body.duration ? parseFloat(req.body.duration) : 1.0;
      let results: { [key: string]: boolean } = {};

      if (action === 'on') {
        results = await lifxService.turnOnGroup(groupName, duration);
      } else if (action === 'off') {
        results = await lifxService.turnOffGroup(groupName, duration);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "on" or "off"',
        });
      }

      const successCount = Object.values(results).filter((result) => result === true).length;

      if (successCount > 0) {
        return res.status(200).json({
          success: true,
          message: `${successCount} lights in group ${groupName} turned ${action} successfully`,
          results,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: `No lights found in group ${groupName} or all operations failed`,
        });
      }
    } catch (error) {
      logger.error({ error, groupName, action }, 'Error controlling light group');
      return res.status(500).json({
        success: false,
        message: 'Error controlling light group',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Control all lights
   */
  public async controlAllLights(req: Request, res: Response): Promise<Response> {
    const action = req.params.action;

    try {
      const duration = req.body.duration ? parseFloat(req.body.duration) : 1.0;
      let results: { [key: string]: boolean } = {};

      if (action === 'on') {
        results = await lifxService.turnOnAll(duration);
      } else if (action === 'off') {
        results = await lifxService.turnOffAll(duration);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "on" or "off"',
        });
      }

      const successCount = Object.values(results).filter((result) => result === true).length;

      if (successCount > 0) {
        return res.status(200).json({
          success: true,
          message: `${successCount} lights turned ${action} successfully`,
          results,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: `No lights found or all operations failed`,
        });
      }
    } catch (error) {
      logger.error({ error, action }, 'Error controlling all lights');
      return res.status(500).json({
        success: false,
        message: 'Error controlling all lights',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Activate a scene
   */
  public async activateScene(req: Request, res: Response): Promise<Response> {
    const sceneName = req.params.name;

    if (!sceneName) {
      return res.status(400).json({
        success: false,
        message: 'Scene name is required',
      });
    }

    try {
      const results = await lifxService.activateScene(sceneName);
      const successCount = Object.values(results).filter((result) => result === true).length;

      if (successCount > 0 || Object.keys(results).length === 0) {
        return res.status(200).json({
          success: true,
          message: `Scene ${sceneName} activated successfully`,
          results,
        });
      } else {
        return res.status(500).json({
          success: false,
          message: `Failed to activate scene ${sceneName}`,
          results,
        });
      }
    } catch (error) {
      logger.error({ error, sceneName }, 'Error activating scene');
      return res.status(500).json({
        success: false,
        message: 'Error activating scene',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get light state
   */
  public async getLightState(req: Request, res: Response): Promise<Response> {
    const lightName = req.params.name;

    if (!lightName) {
      return res.status(400).json({
        success: false,
        message: 'Light name is required',
      });
    }

    try {
      const state = await lifxService.getLightState(lightName);

      if (state) {
        return res.status(200).json({
          success: true,
          data: state,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: `Could not find light ${lightName} or failed to get state`,
        });
      }
    } catch (error) {
      logger.error({ error, lightName }, 'Error getting light state');
      return res.status(500).json({
        success: false,
        message: 'Error getting light state',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get all light states
   */
  public async getAllLightStates(req: Request, res: Response): Promise<Response> {
    try {
      const states = await lifxService.getAllLightStates();

      return res.status(200).json({
        success: true,
        data: states,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting all light states');
      return res.status(500).json({
        success: false,
        message: 'Error getting all light states',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get light states by group
   */
  public async getGroupLightStates(req: Request, res: Response): Promise<Response> {
    const groupName = req.params.name;

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }

    try {
      const states = await lifxService.getGroupLightStates(groupName);

      if (Object.keys(states).length > 0) {
        return res.status(200).json({
          success: true,
          data: states,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: `No lights found in group ${groupName}`,
        });
      }
    } catch (error) {
      logger.error({ error, groupName }, 'Error getting group light states');
      return res.status(500).json({
        success: false,
        message: 'Error getting group light states',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Office arrival sequence - wake PC and turn on lights
   */
  public async arriveAtOffice(req: Request, res: Response): Promise<Response> {
    try {
      // Start both actions in parallel
      const [wolResult, lightResults] = await Promise.all([
        wolService.wakePC(),
        lifxService.turnOnGroup('office', 1.0),
      ]);

      // If no office lights found, try turning on all lights
      const successCount = Object.values(lightResults).filter((result) => result === true).length;
      if (successCount === 0) {
        await lifxService.turnOnAll(1.0);
      }

      return res.status(200).json({
        success: true,
        message: 'Office arrival sequence initiated successfully',
        wolSent: wolResult,
        lightResults,
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
   * Office departure sequence - turn off lights
   */
  public async leaveOffice(req: Request, res: Response): Promise<Response> {
    try {
      const [wolResult, lightResults] = await Promise.all([
        wolService.sleepPC(),
        lifxService.turnOffGroup('office', 1.0),
      ]);

      const successCount = Object.values(lightResults).filter((result) => result === true).length;
      if (successCount === 0) {
        await lifxService.turnOffAll(1.0);
      }

      return res.status(200).json({
        success: true,
        message: 'Office departure sequence initiated successfully',
        wolSent: wolResult,
        lightResults,
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

  /**
   * Put the PC to sleep
   */
  public async sleepPC(req: Request, res: Response): Promise<Response> {
    try {
      const isPCOnline = await wolService.isPCOnline();

      if (!isPCOnline) {
        return res.status(400).json({
          success: false,
          message: 'PC appears to be offline already',
        });
      }

      await wolService.sleepPC();
      return res.status(200).json({
        success: true,
        message: 'Sleep command sent to PC successfully',
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
   * Ping the PC
   */
  public async pingPC(req: Request, res: Response): Promise<Response> {
    try {
      const isPCOnline = await wolService.isPCOnline();
      return res.status(200).json({
        success: true,
        message: isPCOnline ? 'PC is online' : 'PC is offline',
        isPCOnline,
      });
    } catch (error) {
      logger.error({ error }, 'Error pinging PC');
      return res.status(500).json({
        success: false,
        message: 'Error pinging PC',
        error: (error as Error).message,
      });
    }
  }
}

export const webhookController = new WebhookController();
export default webhookController;
