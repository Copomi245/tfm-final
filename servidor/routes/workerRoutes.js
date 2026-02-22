// routes/workerRoutes.js
const express = require('express');
const workerController = require('../controllers/workerController');

const router = express.Router();

// Endpoints para el worker 
router.put('/jobs/:bullmqId/status', workerController.updateJobStatus);
router.get('/credentials/bluesky', workerController.getBlueskyCredentials);
router.get('/credentials/twitter', workerController.getTwitterCredentials);
router.post('/account-usage', workerController.recordAccountUsage);
router.get('/jobs/bullmq/:bullmqId', workerController.getJobByBullmqId);
router.put('/jobs/:id/status-direct', workerController.updateJobStatusDirect);
router.get('/jobs/:id/parent', workerController.getJobParent);
router.get('/jobs/:id/info', workerController.getJobInfo);
router.get('/jobs/:id/children-status', workerController.getChildrenStatus);
router.post('/execute-query', workerController.executeQuery);
router.post('/save-file', workerController.saveFile);
module.exports = router;