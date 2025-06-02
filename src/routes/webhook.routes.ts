import { Router } from 'express';
import { webhookController, authenticateWebhook } from '../controllers/index.js';

const router = Router();

router.use(authenticateWebhook);

// Bundle actions
router.post('/arrive', webhookController.arrive);
router.post('/leave', webhookController.leave);

// PC control
router.post('/wake-pc', webhookController.wakePC);
router.post('/sleep-pc', webhookController.sleepPC);

// Light control
router.post('/lights-on', webhookController.lightsOn);
router.post('/lights-off', webhookController.lightsOff);

export const webhookRoutes: Router = router;
export default webhookRoutes;
