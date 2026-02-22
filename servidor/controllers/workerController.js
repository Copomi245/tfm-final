// controllers/workerController.js
const { query } = require('../config/database');
const path = require('path');
const fs = require('fs');
const workerController = {
    async updateJobStatus(req, res) {
    try {
        const { bullmqId } = req.params;
        const { status, result, cuenta_id, result_count, file_path } = req.body;

        const updateData = {
            status,
            cuenta_id,
            result_count,
            file_path,
            started_at: status === 'processing' ? new Date() : undefined,
            completed_at: ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined
        };

        Object.keys(updateData).forEach(key => 
            updateData[key] === undefined && delete updateData[key]
        );

        if (Object.keys(updateData).length > 0) {
            await query(
                `UPDATE trabajo SET ${Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`).join(', ')} 
                 WHERE bullmq_id = $${Object.keys(updateData).length + 1}`,
                [...Object.values(updateData), bullmqId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ error: error.message });
    }
},

    async getBlueskyCredentials(req, res) {
        try {
            const result = await query(`
                SELECT id, username, password 
                FROM cuenta 
                WHERE platform = 'bluesky' 
                AND is_active = true 
                ORDER BY last_used ASC, success_rate DESC
                LIMIT 1
            `);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No hay cuentas disponibles' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error obteniendo credenciales:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getTwitterCredentials(req, res) {
        try {
            const result = await query(`
                SELECT id, username, password 
                FROM cuenta 
                WHERE platform = 'twitter' 
                AND is_active = true 
                ORDER BY last_used ASC, success_rate DESC
                LIMIT 1
            `);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No hay cuentas disponibles' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error obteniendo credenciales:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async recordAccountUsage(req, res) {
        try {
            const { cuentaId, trabajoId, success, itemsScraped, errorMessage, duration } = req.body;

             await query(`
                INSERT INTO uso_cuenta (cuenta_id, trabajo_id, success, error_message, items_scraped, duration)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [cuentaId, trabajoId, success, errorMessage, itemsScraped, duration]);
 
            await query(`
                UPDATE cuenta 
                SET last_used = CURRENT_TIMESTAMP, 
                    use_count = use_count + 1,
                    daily_use_count = daily_use_count + 1,
                    success_rate = CASE 
                        WHEN use_count = 0 THEN ${success ? 1.0 : 0.0}
                        ELSE (success_rate * use_count + ${success ? 1 : 0}) / (use_count + 1)
                    END
                WHERE id = $1
            `, [cuentaId]);

            res.json({ success: true });
        } catch (error) {
            console.error('Error registrando uso:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getJobByBullmqId(req, res) {
    try {
        const { bullmqId } = req.params;
        const result = await query(
            'SELECT id, user_id, trabajo_padre_id FROM trabajo WHERE bullmq_id = $1',
            [bullmqId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajo no encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error obteniendo trabajo:', error);
        res.status(500).json({ error: error.message });
    }
},

async updateJobStatusDirect(req, res) {
    try {
        const { id } = req.params;
        const { status, cuenta_id, result_count, file_path, started_at } = req.body;

        let queryText = `UPDATE trabajo SET `;
        const queryParams = [];
        let paramCount = 0;

        // Construir query dinámicamente
        if (status) {
            paramCount++;
            queryText += `status = $${paramCount}, `;
            queryParams.push(status);
        }

        if (cuenta_id) {
            paramCount++;
            queryText += `cuenta_id = $${paramCount}, `;
            queryParams.push(cuenta_id);
        }

        if (result_count !== undefined) {
            paramCount++;
            queryText += `result_count = $${paramCount}, `;
            queryParams.push(result_count);
        }

        if (file_path) {
            paramCount++;
            queryText += `file_path = $${paramCount}, `;
            queryParams.push(file_path);
        }

        if (started_at) {
            paramCount++;
            queryText += `started_at = $${paramCount}, `;
            queryParams.push(new Date(started_at));
        }

        if (status && ['completed', 'failed', 'cancelled'].includes(status)) {
            paramCount++;
            queryText += `completed_at = $${paramCount}, `;
            queryParams.push(new Date());
        }

        // Eliminar la última coma y espacio
        queryText = queryText.slice(0, -2);

        paramCount++;
        queryText += ` WHERE id = $${paramCount}`;
        queryParams.push(id);

        await query(queryText, queryParams);

        res.json({ success: true });
    } catch (error) {
        console.error('Error actualizando estado directo:', error);
        res.status(500).json({ error: error.message });
    }
},

async getJobParent(req, res) {
    try {
        const { id } = req.params;
        const result = await query(
            'SELECT trabajo_padre_id FROM trabajo WHERE id = $1',
            [id]
        );
        
        res.json(result.rows[0] || { trabajo_padre_id: null });
    } catch (error) {
        console.error('Error obteniendo trabajo padre:', error);
        res.status(500).json({ error: error.message });
    }
},

async getJobInfo(req, res) {
    try {
        const { id } = req.params;
        const result = await query(
            'SELECT es_recurrente, recurrente_hasta FROM trabajo WHERE id = $1',
            [id]
        );
        
        res.json(result.rows[0] || { es_recurrente: false, recurrente_hasta: null });
    } catch (error) {
        console.error('Error obteniendo información del trabajo:', error);
        res.status(500).json({ error: error.message });
    }
},

async getChildrenStatus(req, res) {
    try {
        const { id } = req.params;
        const result = await query(`
            SELECT status, COUNT(*) as count 
            FROM trabajo 
            WHERE trabajo_padre_id = $1 
            GROUP BY status
        `, [id]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo estado de hijos:', error);
        res.status(500).json({ error: error.message });
    }
},

async executeQuery(req, res) {
    try {
        const { sql, params } = req.body;
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error ejecutando query:', error);
        res.status(500).json({ error: error.message });
    }
},

async saveFile(req, res) {
    try {
        const { fileName, content, platform } = req.body;
        
        // Crear directorio si no existe
        const dir = path.join(process.cwd(), 'resultados', platform);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Guardar archivo
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, content);
        
        console.log('✅ Archivo guardado:', filePath);
        res.json({ success: true, filePath });
        
    } catch (error) {
        console.error('Error guardando archivo:', error);
        res.status(500).json({ error: error.message });
    }
}
};

module.exports = workerController;