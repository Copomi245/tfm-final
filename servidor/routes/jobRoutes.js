// routes/jobRoutes.js
const express = require('express');
const jobController = require('../controllers/jobController');

const router = express.Router();

// Obtener todos los trabajos del usuario
router.get('/', jobController.getUserJobs);

// Obtener estadísticas de trabajos
router.get('/stats', jobController.getJobStats);

// Obtener un trabajo específico
router.get('/:id', jobController.getJobById);

// Cancelar un trabajo
router.delete('/:id/cancel', jobController.cancelJob);

router.get('/:parentId/children', jobController.getChildJobs);


module.exports = router;