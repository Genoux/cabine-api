import pino from 'pino';
import { config } from '../config.js';

export const logger = pino.default({
  level: config.server.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

export default logger;
