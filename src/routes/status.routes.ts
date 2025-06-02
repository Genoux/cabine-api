// src/routes/status.routes.ts
import { Router } from 'express';
import { statusController, authenticateWebhook } from '../controllers/index.js';

const router = Router();

router.use(authenticateWebhook);

router.get('/', statusController.getStatus);

export const statusRoutes: Router = router;
export default statusRoutes;