const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class UserService {
    // Generar API key única
    generateApiKey() {
        return 'sk_' + crypto.randomBytes(24).toString('hex');
    }

    // Registrar nuevo usuario
    async registerUser(email, password) {
        try {
            // Verificar si el usuario ya existe
            const existingUser = await this.findByEmail(email);
            if (existingUser) {
                throw new Error('El usuario ya existe');
            }

            // Hashear la contraseña
            const passwordHash = await bcrypt.hash(password, 12);
            const apiKey = this.generateApiKey();

            // Insertar en la base de datos
            const result = await query(
                `INSERT INTO usuario (email, password_hash, api_key) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, email, api_key, fechaCreacion`,
                [email, passwordHash, apiKey]
            );

            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Login de usuario
    async loginUser(email, password) {
        try {
            // Buscar usuario por email
            const user = await this.findByEmail(email);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar contraseña
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                throw new Error('Contraseña incorrecta');
            }

            // Actualizar último login
            await query(
                'UPDATE usuario SET ultimoLogin = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Devolver datos del usuario (sin password_hash)
            return {
                id: user.id,
                email: user.email,
                apiKey: user.api_key,
                fechaCreacion: user.fechacreacion
            };
        } catch (error) {
            throw error;
        }
    }


    async findById(userId) {
    const result = await query(
        'SELECT id, email, api_key FROM usuario WHERE id = $1',
        [userId]
    );
    return result.rows[0];
    }   
    
    // Buscar usuario por email
    async findByEmail(email) {
        const result = await query(
            'SELECT * FROM usuario WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    // Buscar usuario por API key
    async findByApiKey(apiKey) {
        const result = await query(
            'SELECT * FROM usuario WHERE api_key = $1',
            [apiKey]
        );
        return result.rows[0];
    }

    // Verificar si API key es válida
    async validateApiKey(apiKey) {
        const user = await this.findByApiKey(apiKey);
        return !!user; // Devuelve true si existe, false si no
    }
}

module.exports = new UserService();