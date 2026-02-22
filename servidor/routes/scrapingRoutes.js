// routes/scrapingRoutes.js
const express = require('express');
const scrapingController = require('../controllers/scrapingController');

const router = express.Router();

// Iniciar scraping de Bluesky
router.post('/bluesky', scrapingController.startBlueskyScraping);

// Iniciar scraping de Twitter
router.post('/twitter', scrapingController.startTwitterScraping);

// Obtener estado de un job
router.get('/status/:jobId', scrapingController.getJobStatus);

module.exports = router;