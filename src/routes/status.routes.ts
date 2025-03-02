// src/routes/status.routes.ts
import { Router } from 'express';
import { statusController } from '../controllers/status.controller.js';
import { authenticateWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.use(authenticateWebhook);

router.get('/', statusController.getStatus);

export const statusRoutes: Router = router;
export default statusRoutes;