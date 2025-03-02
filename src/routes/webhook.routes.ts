import { Router } from 'express';
import { webhookController, authenticateWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.use(authenticateWebhook);

router.post('/light/:name/:action', webhookController.controlLight);
router.get('/light/:name', webhookController.getLightState);

router.post('/group/:name/:action', webhookController.controlLightGroup);
router.get('/group/:name', webhookController.getGroupLightStates);

router.post('/lights/:action', webhookController.controlAllLights);
router.get('/lights', webhookController.getAllLightStates);

router.post('/scene/:name', webhookController.activateScene);

router.post('/office/arrive', webhookController.arriveAtOffice);
router.post('/office/leave', webhookController.leaveOffice);

router.post('/wake-pc', webhookController.wakePC);
router.post('/sleep-pc', webhookController.sleepPC);
router.post('/ping-pc', webhookController.pingPC);

export const webhookRoutes: Router = router;
export default webhookRoutes;
