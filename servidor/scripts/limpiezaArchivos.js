// scripts/limpiezaArchivos.js
const fs = require('fs').promises;
const path = require('path');
const { query } = require('../config/database');

class CleanupService {
    constructor() {
        this.BASE_DIR = path.join(process.cwd(), 'resultados');
    }

    

    async cleanupExpiredFiles() {
    try {
        console.log('🧹 Iniciando limpieza de archivos expirados...');
        
        const expiredJobs = await query(`
            SELECT id, file_path, platform, bullmq_id
            FROM trabajo 
            WHERE expires_at <= CURRENT_TIMESTAMP 
            AND file_path IS NOT NULL
            AND file_deleted = false
            AND status IN ('completed', 'failed', 'cancelled')
        `);

        console.log(`📊 Encontrados ${expiredJobs.rows.length} trabajos por limpiar`);

        let deletedCount = 0;

        for (const job of expiredJobs.rows) {
            const realFileName = job.file_path;
            const fullPath = path.join(this.BASE_DIR, job.platform, realFileName);
            
            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                console.log(`🗑️  Eliminado: ${job.platform}/${realFileName}`);
                deletedCount++;
                
                await query(
                    `UPDATE trabajo SET file_deleted = true WHERE id = $1`,
                    [job.id]
                );
                
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await query(
                        `UPDATE trabajo SET file_deleted = true WHERE id = $1`,
                        [job.id]
                    );
                } else {
                    console.error(`Error:`, error.message);
                }
            }
        }
        
        console.log(`${deletedCount} archivos eliminados`);
        
    } catch (error) {
        console.error('Error en limpieza:', error.message);
    }
}

    async deleteJobFile(job) {
        try {
            const fullPath = path.join(this.BASE_DIR, job.platform, job.file_path);
            
            await fs.unlink(fullPath);
            console.log(`🗑️  Eliminado: ${job.platform}/${job.file_path}`);
            return true;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`Archivo ya no existe: ${job.platform}/${job.file_path}`);
                return true;
            }
            console.error(`Error eliminando archivo ${job.file_path}:`, error.message);
            return false;
        }
    }

    async ensureDirectories() {
        try {
            const platforms = ['bluesky', 'twitter'];
            
            for (const platform of platforms) {
                const platformPath = path.join(this.BASE_DIR, platform);
                await fs.mkdir(platformPath, { recursive: true });
            }
            
        } catch (error) {
            console.error('Error creando directorios:', error);
        }
    }

    // Ejecutar limpieza completa
    async runFullCleanup() {
        console.log('Ejecutando limpieza de archivos expirados...');
        await this.ensureDirectories();
        await this.cleanupExpiredFiles();
        console.log('Limpieza completada');
    }
}

module.exports = new CleanupService();