import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { Light } from './services/lifx.service.js';

dotenvConfig();

let lights: Light[] = [];
try {
  if (process.env.LIFX_LIGHTS) {
    lights = JSON.parse(process.env.LIFX_LIGHTS);
  }
} catch (error) {
  console.error('Error parsing LIFX_LIGHTS:', error);
}

const envSchema = z.object({
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  WOL_MAC_ADDRESS: z.string(),
  WOL_IP_ADDRESS: z.string().default('255.255.255.255'),
  WOL_PORT: z.string().default('9'),
  WOL_PC_IP: z.string().optional(),
  WOL_PC_USER: z.string().optional(),
  WOL_PC_PASSWORD: z.string().optional(),
  WOL_PC_OS: z.enum(['windows', 'linux', 'macos']).default('windows'),

  WOL_SSH_PORT: z.string().default('22'),
  WOL_SSH_KEY_PATH: z.string().optional(),

  LIFX_API_TOKEN: z.string(),
  WEBHOOK_SECRET: z.string(),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(env.error.format(), null, 2));
  process.exit(1);
}

export const config = {
  server: {
    port: parseInt(env.data.PORT),
    host: env.data.HOST,
    logLevel: env.data.LOG_LEVEL,
  },
  wol: {
    macAddress: env.data.WOL_MAC_ADDRESS,
    ipAddress: env.data.WOL_IP_ADDRESS,
    port: parseInt(env.data.WOL_PORT),
    pcIp: env.data.WOL_PC_IP,
    pcUser: env.data.WOL_PC_USER,
    pcPassword: env.data.WOL_PC_PASSWORD,
    pcOS: env.data.WOL_PC_OS,
  },
  lifx: {
    apiToken: env.data.LIFX_API_TOKEN,
    lights: lights,
  },
  security: {
    webhookSecret: env.data.WEBHOOK_SECRET,
  },
};

export default config;
