const userService = require('../services/user-service');

const authController = {
    // Registrar nuevo usuario
    async register(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ 
                    error: 'Email y contraseña son requeridos' 
                });
            }

            const user = await userService.registerUser(email, password);
            
            res.status(201).json({
                success: true,
                message: 'Usuario registrado correctamente',
                user: {
                    id: user.id,
                    email: user.email,
                    apiKey: user.api_key
                }
            });

        } catch (error) {
            res.status(400).json({ 
                error: error.message 
            });
        }
    },

    // Login de usuario
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ 
                    error: 'Email y contraseña son requeridos' 
                });
            }

            const user = await userService.loginUser(email, password);
            
            res.json({
                success: true,
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    email: user.email,
                    apiKey: user.apiKey
                }
            });

        } catch (error) {
            res.status(401).json({ 
                error: error.message 
            });
        }
    },

    // Verificar API key
    async verifyApiKey(req, res) {
        try {
            const apiKey = req.headers['x-api-key'];
            
            if (!apiKey) {
                return res.status(401).json({ 
                    error: 'API key requerida' 
                });
            }

            const isValid = await userService.validateApiKey(apiKey);
            
            if (!isValid) {
                return res.status(401).json({ 
                    error: 'API key inválida' 
                });
            }

            res.json({ 
                success: true, 
                message: 'API key válida' 
            });

        } catch (error) {
            res.status(500).json({ 
                error: 'Error verificando API key' 
            });
        }
    }
};

module.exports = authController;