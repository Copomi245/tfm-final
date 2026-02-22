const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Registrar nuevo usuario
router.post('/register', authController.register);

// Login de usuario
router.post('/login', authController.login);

// Verificar API key
router.get('/verify', authController.verifyApiKey);

module.exports = router;