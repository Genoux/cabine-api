import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { webhookRoutes, statusRoutes } from './routes/index.js';
import logger from './utils/logger.js';

const app: express.Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.debug(
    {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    'Incoming request',
  );
  next();
});

// Routes
app.use('/webhooks', webhookRoutes);
app.use('/status', statusRoutes);
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use((err: Error, req: express.Request, res: express.Response) => {
  logger.error({ error: err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`Server running at http://${config.server.host}:${config.server.port}`);
  logger.info('Available webhook endpoints:');
  logger.info(`- POST /webhooks/wake-pc`);
  logger.info(`- POST /webhooks/sleep-pc`);
  logger.info(`- POST /webhooks/light/on`);
  logger.info(`- POST /webhooks/light/off`);
  logger.info(`- GET /webhooks/light/status`);
  logger.info(`- POST /webhooks/office/arrive`);
  logger.info(`- POST /webhooks/office/leave`);
  logger.info(`- GET /status`);
});

const shutdown = () => {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server shut down successfully');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
