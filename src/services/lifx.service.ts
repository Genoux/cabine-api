import axios from 'axios';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export class LifxService {
  private readonly apiToken: string;
  private readonly baseUrl: string = 'https://api.lifx.com/v1/lights';
  private readonly groupName: string = 'Cabine'; // Office lights group

  constructor() {
    this.apiToken = config.lifx.apiToken;
    logger.info(`Initialized LIFX service for group: ${this.groupName}`);
  }

  /**
   * Turn on office lights (cabine group)
   */
  public async turnOnAll(duration: number = 1.0): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/group:${this.groupName}/state`;
      
      logger.info(`Turning on LIFX lights in group: ${this.groupName}`);

      const response = await axios.put(
        url,
        {
          power: 'on',
          duration: duration,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info(`LIFX lights in group '${this.groupName}' turned on successfully`);
        return true;
      } else {
        logger.warn({ status: response.status, data: response.data }, `Failed to turn on LIFX lights in group '${this.groupName}'`);
        return false;
      }
    } catch (error) {
      logger.error({ error }, `Error turning on LIFX lights in group '${this.groupName}'`);
      return false;
    }
  }

  /**
   * Turn off office lights (cabine group)
   */
  public async turnOffAll(duration: number = 1.0): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/group:${this.groupName}/state`;
      
      logger.info(`Turning off LIFX lights in group: ${this.groupName}`);

      const response = await axios.put(
        url,
        {
          power: 'off',
          duration: duration,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info(`LIFX lights in group '${this.groupName}' turned off successfully`);
        return true;
      } else {
        logger.warn({ status: response.status, data: response.data }, `Failed to turn off LIFX lights in group '${this.groupName}'`);
        return false;
      }
    } catch (error) {
      logger.error({ error }, `Error turning off LIFX lights in group '${this.groupName}'`);
      return false;
    }
  }
}

export const lifxService = new LifxService();
export default lifxService;
