import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  PC_MAC_ADDRESS: z.string(),
  PC_IP_ADDRESS: z.string(),
  PC_SSH_USER: z.string().optional(),
  PC_SSH_PASSWORD: z.string().optional(),
  PC_SSH_KEY_PATH: z.string().optional(),

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
  pc: {
    macAddress: env.data.PC_MAC_ADDRESS,
    ipAddress: env.data.PC_IP_ADDRESS,
    sshUser: env.data.PC_SSH_USER,
    sshPassword: env.data.PC_SSH_PASSWORD,
    sshKeyPath: env.data.PC_SSH_KEY_PATH,
  },
  lifx: {
    apiToken: env.data.LIFX_API_TOKEN,
  },
  security: {
    webhookSecret: env.data.WEBHOOK_SECRET,
  },
};

export default config;
