import axios from 'axios';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export interface LightState {
  power: 'on' | 'off';
  brightness?: number;
  color?: string;
  duration?: number;
}

export interface Light {
  id: string;
  name: string;
  group?: string;
  tags?: string[];
}

export class LifxService {
  private readonly apiToken: string;
  private readonly lights: Map<string, Light>;
  private readonly baseUrl: string = 'https://api.lifx.com/v1/lights';

  constructor() {
    this.apiToken = config.lifx.apiToken;
    this.lights = new Map();

    if (config.lifx.lights && Array.isArray(config.lifx.lights)) {
      for (const light of config.lifx.lights) {
        this.addLight(light);
      }
    }

    logger.info(`Initialized LIFX service with ${this.lights.size} lights`);
  }

  /**
   * Add a light to the service
   */
  public addLight(light: Light): void {
    if (!light.id) {
      logger.warn({ light }, 'Attempted to add light with empty ID');
      return;
    }

    this.lights.set(light.name, light);
    logger.info({ name: light.name, id: light.id, group: light.group }, 'Light added to service');
  }

  /**
   * Remove a light from the service
   */
  public removeLight(name: string): boolean {
    if (this.lights.has(name)) {
      this.lights.delete(name);
      logger.info({ name }, 'Light removed from service');
      return true;
    }

    logger.warn({ name }, 'Attempted to remove non-existent light');
    return false;
  }

  /**
   * Get a light by name
   */
  public getLight(name: string): Light | undefined {
    return this.lights.get(name);
  }

  /**
   * Get a light by ID
   */
  public getLightById(id: string): Light | undefined {
    for (const light of this.lights.values()) {
      if (light.id === id) {
        return light;
      }
    }
    return undefined;
  }

  /**
   * Get all lights
   */
  public getAllLights(): Light[] {
    return Array.from(this.lights.values());
  }

  /**
   * Get lights by group
   */
  public getLightsByGroup(group: string): Light[] {
    return this.getAllLights().filter((light) => light.group === group);
  }

  /**
   * Get lights by tag
   */
  public getLightsByTag(tag: string): Light[] {
    return this.getAllLights().filter((light) => light.tags && light.tags.includes(tag));
  }

  /**
   * Set the state of a specific LIFX light by ID
   */
  public async setLightStateById(lightId: string, state: LightState): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${lightId}/state`;

      logger.info({ lightId, state }, 'Setting LIFX light state');

      const response = await axios.put(url, state, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info({ response: response.data }, 'LIFX light state updated successfully');
        return true;
      } else {
        logger.warn(
          { status: response.status, data: response.data },
          'Failed to update LIFX light state',
        );
        return false;
      }
    } catch (error) {
      logger.error({ error, lightId }, 'Error setting LIFX light state');
      return false;
    }
  }

  /**
   * Set the state of a light by name
   */
  public async setLightState(lightName: string, state: LightState): Promise<boolean> {
    const light = this.getLight(lightName);

    if (!light) {
      logger.warn({ lightName }, 'Light not found');
      return false;
    }

    return this.setLightStateById(light.id, state);
  }

  /**
   * Turn on a light by name
   */
  public async turnOn(lightName: string, duration: number = 1.0): Promise<boolean> {
    return this.setLightState(lightName, { power: 'on', duration });
  }

  /**
   * Turn off a light by name
   */
  public async turnOff(lightName: string, duration: number = 1.0): Promise<boolean> {
    return this.setLightState(lightName, { power: 'off', duration });
  }

  /**
   * Turn on a light by ID
   */
  public async turnOnById(lightId: string, duration: number = 1.0): Promise<boolean> {
    return this.setLightStateById(lightId, { power: 'on', duration });
  }

  /**
   * Turn off a light by ID
   */
  public async turnOffById(lightId: string, duration: number = 1.0): Promise<boolean> {
    return this.setLightStateById(lightId, { power: 'off', duration });
  }

  /**
   * Set state for all lights
   */
  public async setAllLightsState(state: LightState): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};
    const promises: Promise<void>[] = [];

    this.getAllLights().forEach((light) => {
      promises.push(
        this.setLightStateById(light.id, state).then((success) => {
          results[light.name] = success;
        }),
      );
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Turn on all lights
   */
  public async turnOnAll(duration: number = 1.0): Promise<{ [key: string]: boolean }> {
    return this.setAllLightsState({ power: 'on', duration });
  }

  /**
   * Turn off all lights
   */
  public async turnOffAll(duration: number = 1.0): Promise<{ [key: string]: boolean }> {
    return this.setAllLightsState({ power: 'off', duration });
  }

  /**
   * Set state for a group of lights
   */
  public async setGroupState(
    groupName: string,
    state: LightState,
  ): Promise<{ [key: string]: boolean }> {
    const groupLights = this.getLightsByGroup(groupName);
    const results: { [key: string]: boolean } = {};
    const promises: Promise<void>[] = [];

    if (groupLights.length === 0) {
      logger.warn({ groupName }, 'No lights found in group');
      return results;
    }

    groupLights.forEach((light) => {
      promises.push(
        this.setLightStateById(light.id, state).then((success) => {
          results[light.name] = success;
        }),
      );
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Turn on a group of lights
   */
  public async turnOnGroup(
    groupName: string,
    duration: number = 1.0,
  ): Promise<{ [key: string]: boolean }> {
    return this.setGroupState(groupName, { power: 'on', duration });
  }

  /**
   * Turn off a group of lights
   */
  public async turnOffGroup(
    groupName: string,
    duration: number = 1.0,
  ): Promise<{ [key: string]: boolean }> {
    return this.setGroupState(groupName, { power: 'off', duration });
  }

  /**
   * Activate a scene - predefined light combinations
   * Scenes are defined in the service but could be moved to configuration
   */
  public async activateScene(sceneName: string): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    // Define scenes
    const scenes: { [key: string]: (service: LifxService) => Promise<void> } = {
      focus: async (service: LifxService) => {
        // Turn on desk lights, turn off others
        const officeLights = service.getLightsByGroup('office');
        const deskLights = service.getLightsByTag('desk');

        // Find lights to turn on (desk) and off (other office lights)
        const lightsToTurnOn =
          deskLights.length > 0 ? deskLights : officeLights.length > 0 ? [officeLights[0]] : [];

        const lightsToTurnOff = officeLights.filter(
          (light) => !lightsToTurnOn.some((deskLight) => deskLight.id === light.id),
        );

        // Turn on desk lights
        for (const light of lightsToTurnOn) {
          results[light.name] = await service.setLightStateById(light.id, {
            power: 'on',
            brightness: 1.0,
            color: 'white',
            duration: 1.0,
          });
        }

        // Turn off other office lights
        for (const light of lightsToTurnOff) {
          results[light.name] = await service.setLightStateById(light.id, {
            power: 'off',
            duration: 1.0,
          });
        }
      },
    };

    // Execute the scene function if it exists
    const sceneFunction = scenes[sceneName.toLowerCase()];
    if (sceneFunction) {
      await sceneFunction(this);
      return results;
    } else {
      logger.warn({ sceneName }, 'Unknown scene');
      return {};
    }
  }

  /**
   * Get the state of a light by ID
   */
  public async getLightStateById(lightId: string): Promise<LightState | null> {
    try {
      const url = `${this.baseUrl}/${lightId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      if (response.status === 200) {
        logger.info({ lightId }, 'Retrieved LIFX light state successfully');
        return response.data;
      } else {
        logger.warn({ status: response.status, lightId }, 'Failed to get LIFX light state');
        return null;
      }
    } catch (error) {
      logger.error({ error, lightId }, 'Error getting LIFX light state');
      return null;
    }
  }

  /**
   * Get the state of a light by name
   */
  public async getLightState(lightName: string): Promise<LightState | null> {
    const light = this.getLight(lightName);

    if (!light) {
      logger.warn({ lightName }, 'Light not found');
      return null;
    }

    return this.getLightStateById(light.id);
  }

  /**
   * Get the states of all lights
   */
  public async getAllLightStates(): Promise<{ [key: string]: LightState | null }> {
    const results: { [key: string]: LightState | null } = {};
    const promises: Promise<void>[] = [];

    this.getAllLights().forEach((light) => {
      promises.push(
        this.getLightStateById(light.id).then((state) => {
          results[light.name] = state;
        }),
      );
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get the states of lights in a group
   */
  public async getGroupLightStates(groupName: string): Promise<{ [key: string]: LightState | null }> {
    const results: { [key: string]: LightState | null } = {};
    const promises: Promise<void>[] = [];

    this.getLightsByGroup(groupName).forEach((light) => {
      promises.push(
        this.getLightStateById(light.id).then((state) => {
          results[light.name] = state;
        }),
      );
    });

    await Promise.all(promises);
    return results;
  }
}

export const lifxService = new LifxService();
export default lifxService;
