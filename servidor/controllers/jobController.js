// controllers/jobController.js
const { query } = require('../config/database');
const userService = require('../services/user-service');
const redis = require('../shared/redis');
const blueskyQueue = require('../api/queues/bluesky-queue');



async function cancelSingleJob(job, userId) {
        // Marcar como cancelado en DB
        await query(
            `UPDATE trabajo SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [job.id]
        );

        // Si está en cola (waiting), eliminar de BullMQ
        if (job.status === 'waiting') {
            const jobInQueue = await blueskyQueue.getJob(job.bullmq_id);
            if (jobInQueue) {
                await jobInQueue.remove();
            }
        }

        // Si está en ejecución (processing), señalizar cancelación
        if (job.status === 'processing') {
            const redisClient = redis.getClient();
            await redisClient.set(`cancel:${job.bullmq_id}`, 'true', 'EX', 3600);
        }
    }
const jobController = {
    // Obtener todos los trabajos del usuario autenticado
    async getUserJobs(req, res) {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key requerida' });
        }

        const user = await userService.findByApiKey(apiKey);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        // Paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Filtros
        const status = req.query.status;
        const platform = req.query.platform;
        const search = req.query.search;

        // Solo padres y trabajos individuales (no hijos)
        let queryText = `
            SELECT 
                t.id,
                t.bullmq_id,
                t.platform,
                t.status,
                t.search_params,
                t.file_path,
                t.result_count,
                t.created_at,
                t.started_at,
                t.completed_at,
                t.expires_at,
                t.file_deleted,
                t.es_padre,
                t.trabajo_padre_id,
                t.recurrente_hasta,
                COUNT(*) OVER() as total_count
            FROM trabajo t
            WHERE t.user_id = $1
            AND (t.es_padre = true OR t.trabajo_padre_id IS NULL)
        `;

        const queryParams = [user.id];
        let paramCount = 1;

        // Añadir filtros
        if (status) {
            paramCount++;
            queryText += ` AND t.status = $${paramCount}`;
            queryParams.push(status);
        }

        if (platform) {
            paramCount++;
            queryText += ` AND t.platform = $${paramCount}`;
            queryParams.push(platform);
        }

        if (search) {
            paramCount++;
            queryText += ` AND t.search_params::text ILIKE $${paramCount}`;
            queryParams.push(`%${search}%`);
        }

        // Orden y paginación
        queryText += ` 
            ORDER BY t.created_at DESC 
            LIMIT $${paramCount + 1} 
            OFFSET $${paramCount + 2}
        `;
        queryParams.push(limit, offset);

        // Ejecutar query
        const result = await query(queryText, queryParams);

        res.json({
            success: true,
            jobs: result.rows,
            pagination: {
                page,
                limit,
                total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
                totalPages: result.rows.length > 0 ? Math.ceil(parseInt(result.rows[0].total_count) / limit) : 0
            }
        });

    } catch (error) {
        console.error('Error obteniendo trabajos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
},

    // Obtener un trabajo específico
    async getJobById(req, res) {
        try {
            const apiKey = req.headers['x-api-key'];
            const jobId = req.params.id;

            if (!apiKey) {
                return res.status(401).json({ error: 'API key requerida' });
            }

            const user = await userService.findByApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            const result = await query(`
                SELECT 
                    t.*,
                    u.email as user_email,
                    json_agg(
                        json_build_object(
                            'id', uc.id,
                            'success', uc.success,
                            'error_message', uc.error_message,
                            'duration', uc.duration,
                            'items_scraped', uc.items_scraped,
                            'used_at', uc.used_at
                        )
                    ) as account_usage
                FROM trabajo t
                LEFT JOIN usuario u ON t.user_id = u.id
                LEFT JOIN uso_cuenta uc ON uc.trabajo_id = t.id
                WHERE t.id = $1 AND t.user_id = $2
                GROUP BY t.id, u.email
            `, [jobId, user.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Trabajo no encontrado' });
            }

            res.json({
                success: true,
                job: result.rows[0]
            });

        } catch (error) {
            console.error('Error obteniendo trabajo:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },

    // Cancelar un trabajo
    async cancelJob(req, res) {
        try {
            const apiKey = req.headers['x-api-key'];
            const jobId = req.params.id;

            if (!apiKey) {
                return res.status(401).json({ error: 'API key requerida' });
            }

            const user = await userService.findByApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            // Verificar si el trabajo existe y pertenece al usuario
            const jobResult = await query(
                'SELECT id, bullmq_id, status, trabajo_padre_id, es_padre FROM trabajo WHERE id = $1 AND user_id = $2',
                [jobId, user.id]
            );

            if (jobResult.rows.length === 0) {
                return res.status(404).json({ error: 'Trabajo no encontrado' });
            }

            const job = jobResult.rows[0];

            // Si es un trabajo padre, cancelar todos los hijos
            if (job.es_padre) {
                // Buscar trabajos hijos
                const childJobs = await query(
                    'SELECT id, bullmq_id, status FROM trabajo WHERE trabajo_padre_id = $1',
                    [jobId]
                );

                let cancelledChildren = 0;
                
                for (const child of childJobs.rows) {
                    if (['waiting', 'processing'].includes(child.status)) {
                        await cancelSingleJob(child, user.id);
                        cancelledChildren++;
                    }
                }

                // Marcar padre como cancelado
                await query(
                    `UPDATE trabajo SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [jobId]
                );

                return res.json({
                    success: true,
                    message: `Trabajo padre y ${cancelledChildren} trabajos hijos cancelados`,
                    cancelledChildren
                });
            }

            // Si es un trabajo hijo, cancelar solo ese
            if (!['waiting', 'processing'].includes(job.status)) {
                return res.status(400).json({ 
                    error: `No se puede cancelar un trabajo con estado "${job.status}"` 
                });
            }

            await cancelSingleJob(job, user.id);

            res.json({
                success: true,
                message: 'Trabajo cancelado correctamente'
            });

        } catch (error) {
            console.error('Error cancelando trabajo:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },


    // Estadísticas de trabajos (actualizada)
    async getJobStats(req, res) {
        try {
            const apiKey = req.headers['x-api-key'];

            if (!apiKey) {
                return res.status(401).json({ error: 'API key requerida' });
            }

            const user = await userService.findByApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            // Estadísticas por tipo de trabajo
            const statsByType = await query(`
                SELECT 
                    es_padre,
                    status,
                    COUNT(*) as count,
                    AVG(result_count) as avg_results,
                    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
                FROM trabajo 
                WHERE user_id = $1
                GROUP BY es_padre, status
            `, [user.id]);

            const totalStats = await query(`
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                    SUM(CASE WHEN es_padre = true THEN 1 ELSE 0 END) as parent_jobs,
                    SUM(result_count) as total_items_scraped
                FROM trabajo 
                WHERE user_id = $1
            `, [user.id]);

            res.json({
                success: true,
                statsByType: statsByType.rows,
                totals: totalStats.rows[0]
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },

    
    async getChildJobs(req, res) {
    try {
        const apiKey = req.headers['x-api-key'];
        const parentId = req.params.parentId;

        if (!apiKey) {
            return res.status(401).json({ error: 'API key requerida' });
        }

        const user = await userService.findByApiKey(apiKey);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        // Verificar que el trabajo padre pertenece al usuario
        const parentCheck = await query(
            'SELECT id FROM trabajo WHERE id = $1 AND user_id = $2',
            [parentId, user.id]
        );

        if (parentCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Trabajo padre no encontrado' });
        }

        // Obtener trabajos hijos
        const childrenResult = await query(`
            SELECT 
                id,
                bullmq_id,
                platform,
                status,
                search_params,
                file_path,
                result_count,
                created_at,
                started_at,
                completed_at
            FROM trabajo 
            WHERE trabajo_padre_id = $1 AND user_id = $2
            ORDER BY created_at DESC
        `, [parentId, user.id]);

        res.json({
            success: true,
            children: childrenResult.rows
        });

    } catch (error) {
        console.error('Error obteniendo trabajos hijos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
};

module.exports = jobController;