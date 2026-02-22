// routes/downloadRoutes.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const userService = require('../services/user-service');
const router = express.Router();

const verifyApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key requerida' });
        }

        const isValid = await userService.validateApiKey(apiKey);
        if (!isValid) {
            return res.status(401).json({ error: 'API key inválida' });
        }

        req.user = await userService.findByApiKey(apiKey);
        next();
    } catch (error) {
        console.error('Error en verificación API key:', error);
        res.status(500).json({ error: 'Error de autenticación' });
    }
};

const getBsRawPath = () => {
    return path.join(__dirname, '..', 'resultados/bluesky');
};


router.get('/', verifyApiKey, async (req, res) => {
    try {
        const filePath = req.query.path;
        console.log('📥 Solicitud de descarga para:', filePath);
        
        if (!filePath) {
            return res.status(400).json({ error: 'Ruta de archivo requerida' });
        }


        const fileName = path.basename(filePath);
        const fullPath = path.join(getBsRawPath(), fileName);

        console.log('📁 Ruta resuelta:', fullPath);
        console.log('📁 ¿Existe el archivo?', fs.existsSync(fullPath));

        if (!fs.existsSync(fullPath)) {
            const availableFiles = fs.readdirSync(getBsRawPath()).filter(f => f.endsWith('.json'));
            console.log('📋 Archivos disponibles:', availableFiles);
            
            return res.status(404).json({ 
                error: 'Archivo no encontrado',
                requestedFileName: fileName,
                resolvedPath: fullPath,
                availableFiles: availableFiles
            });
        }

        const fileSize = fs.statSync(fullPath).size;
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', fileSize);

        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('Error al leer el archivo:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error al leer el archivo' });
            }
        });

    } catch (error) {
        console.error('Error en descarga:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
});


router.get('/debug', async (req, res) => {
    try {
        const bsRawPath = path.join(__dirname, '..', 'bs_raw');
        const exists = fs.existsSync(bsRawPath);
        let files = [];
        let fileStats = [];
        
        if (exists) {
            files = fs.readdirSync(bsRawPath).filter(f => f.endsWith('.json'));
            fileStats = files.map(file => {
                const filePath = path.join(bsRawPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: stats.size,
                    exists: fs.existsSync(filePath)
                };
            });
        }
        
        res.json({
            success: true,
            bsRawPath,
            directoryExists: exists,
            currentWorkingDirectory: process.cwd(),
            files: fileStats,
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;