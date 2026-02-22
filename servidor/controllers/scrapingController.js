// controllers/scrapingController.js 
const blueskyQueue = require('../api/queues/bluesky-queue');
const { query } = require('../config/database');
const userService = require('../services/user-service');

// Función auxiliar para dividir rango de fechas por días 
function splitDateRange(fechaDesde, fechaHasta) {
    const startDate = new Date(fechaDesde);
    const endDate = new Date(fechaHasta);
    const dates = [];
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
}

// Función para crear trabajos hijos
async function createChildJobs(parentId, jobData, user, fechaDesde, fechaHasta, platform = 'bluesky') {
    const dates = splitDateRange(fechaDesde, fechaHasta);
    const childJobs = [];

    for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const childJobData = {
            ...jobData,
            fechaDesde: dateStr,
            fechaHasta: nextDayStr,
            platform: platform 
        };

        const job = await blueskyQueue.add(`${platform}-scraping`, childJobData, {
            jobId: `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            priority: 1
        });

        const result = await query(
            `INSERT INTO trabajo (user_id, bullmq_id, platform, search_params, status, trabajo_padre_id, es_padre)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, created_at`,
            [user.id, job.id, platform, JSON.stringify(childJobData), 'waiting', parentId, false]
        );

        childJobs.push({
            jobId: job.id,
            trabajoId: result.rows[0].id,
            date: dateStr,
            platform: platform,
            createdAt: result.rows[0].created_at
        });
    }

    return childJobs;
}

async function createRecurrentJob(parentId, jobData, user, recurrenteHasta) {

    const hoy = new Date().toISOString().split('T')[0];
    if (hoy >= recurrenteHasta) {
        await query(
            `UPDATE trabajo SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [parentId]
        );
        return null;
    }
    
    return null;
}

const scrapingController = {
    async startBlueskyScraping(req, res) {
        try {
            const { 
                palabras, 
                fraseExacta, 
                hashtags, 
                usuarioBusqueda, 
                fechaDesde, 
                fechaHasta, 
                tweetsLimit, 
                esRecurrente, 
                recurrenteHasta 
            } = req.body;
            
            // Validaciones básicas
            if (!palabras && !fraseExacta && !hashtags && !usuarioBusqueda) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar al menos un criterio de búsqueda' 
                });
            }

            if ((fechaDesde && !fechaHasta) || (!fechaDesde && fechaHasta)) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar ambas fechas (desde y hasta) o ninguna' 
                });
            }

            if (esRecurrente && !recurrenteHasta) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar fecha límite para trabajos recurrentes' 
                });
            }

            // Obtener usuario
            const apiKey = req.headers['x-api-key'];
            const user = await userService.findByApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            const jobData = {
                palabras,
                fraseExacta,
                hashtags,
                usuarioBusqueda,
                fechaDesde,
                fechaHasta,
                tweetsLimit: tweetsLimit || 100,
                platform: 'bluesky'
            };

            if (esRecurrente) {
                const hoy = new Date().toISOString().split('T')[0];
                if (recurrenteHasta < hoy) {
                    return res.status(400).json({ 
                        error: 'La fecha límite no puede ser en el pasado' 
                    });
                }

                const parentResult = await query(
                    `INSERT INTO trabajo (user_id, platform, search_params, status, es_padre, es_recurrente, recurrente_hasta)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id, created_at`,
                    [user.id, 'bluesky', JSON.stringify(jobData), 'programado', true, true, recurrenteHasta]
                );

                const parentId = parentResult.rows[0].id;
                
                res.json({
                    success: true,
                    message: `Trabajo recurrente programado hasta ${recurrenteHasta}. 
                            La primera ejecución será mañana a las 3:05 AM.`,
                    trabajoPadreId: parentId,
                    createdAt: parentResult.rows[0].created_at
                });
            }
            //TRABAJO CON RANGO DE FECHAS
            else if (fechaDesde && fechaHasta) {
                const parentJobData = {
                    ...jobData,
                    esPadre: true
                };

                const parentResult = await query(
                    `INSERT INTO trabajo (user_id, platform, search_params, status, es_padre)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, created_at`,
                    [user.id, 'bluesky', JSON.stringify(parentJobData), 'processing', true]
                );

                const parentId = parentResult.rows[0].id;
                const childJobs = await createChildJobs(parentId, jobData, user, fechaDesde, fechaHasta);

                res.json({
                    success: true,
                    message: `Trabajo de scraping dividido en ${childJobs.length} días`,
                    trabajoPadreId: parentId,
                    trabajosHijos: childJobs,
                    createdAt: parentResult.rows[0].created_at
                });
            } 
            //TRABAJO ÚNICO 
            else {
                const job = await blueskyQueue.add('bluesky-scraping', jobData, {
                    jobId: `bluesky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    priority: 1
                });

                const result = await query(
                    `INSERT INTO trabajo (user_id, bullmq_id, platform, search_params, status, es_padre)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, created_at`,
                    [user.id, job.id, 'bluesky', JSON.stringify(jobData), 'waiting', false]
                );

                res.json({
                    success: true,
                    message: 'Trabajo de scraping iniciado',
                    jobId: job.id,
                    trabajoId: result.rows[0].id,
                    createdAt: result.rows[0].created_at
                });
            }

        } catch (error) {
            console.error('Error iniciando scraping:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },

    async startTwitterScraping(req, res) {
        try {
            const { 
                palabras, 
                fraseExacta, 
                hashtags, 
                usuarioBusqueda, 
                fechaDesde, 
                fechaHasta, 
                tweetsLimit, 
                esRecurrente, 
                recurrenteHasta 
            } = req.body;
            
            // Validaciones básicas (igual que Bluesky)
            if (!palabras && !fraseExacta && !hashtags && !usuarioBusqueda) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar al menos un criterio de búsqueda' 
                });
            }

            if ((fechaDesde && !fechaHasta) || (!fechaDesde && fechaHasta)) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar ambas fechas (desde y hasta) o ninguna' 
                });
            }

            if (esRecurrente && !recurrenteHasta) {
                return res.status(400).json({ 
                    error: 'Debe proporcionar fecha límite para trabajos recurrentes' 
                });
            }

            // Obtener usuario
            const apiKey = req.headers['x-api-key'];
            const user = await userService.findByApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }

            const jobData = {
                palabras,
                fraseExacta,
                hashtags,
                usuarioBusqueda,
                fechaDesde,
                fechaHasta,
                tweetsLimit: tweetsLimit || 100,
                platform: 'twitter' 
            };

            //TRABAJO RECURRENTE
            if (esRecurrente) {
                const hoy = new Date().toISOString().split('T')[0];
                if (recurrenteHasta < hoy) {
                    return res.status(400).json({ 
                        error: 'La fecha límite no puede ser en el pasado' 
                    });
                }

                const parentResult = await query(
                    `INSERT INTO trabajo (user_id, platform, search_params, status, es_padre, es_recurrente, recurrente_hasta)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id, created_at`,
                    [user.id, 'twitter', JSON.stringify(jobData), 'programado', true, true, recurrenteHasta]
                );

                const parentId = parentResult.rows[0].id;
                
                res.json({
                    success: true,
                    message: `Trabajo recurrente de Twitter programado hasta ${recurrenteHasta}. 
                             La primera ejecución será mañana a las 3:05 AM.`,
                    trabajoPadreId: parentId,
                    createdAt: parentResult.rows[0].created_at
                });
            }
            //TRABAJO CON RANGO DE FECHAS
            else if (fechaDesde && fechaHasta) {
                const parentJobData = {
                    ...jobData,
                    esPadre: true
                };

                const parentResult = await query(
                    `INSERT INTO trabajo (user_id, platform, search_params, status, es_padre)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, created_at`,
                    [user.id, 'twitter', JSON.stringify(parentJobData), 'processing', true]
                );

                const parentId = parentResult.rows[0].id;
                const childJobs = await createChildJobs(parentId, jobData, user, fechaDesde, fechaHasta, 'twitter');

                res.json({
                    success: true,
                    message: `Trabajo de Twitter dividido en ${childJobs.length} días`,
                    trabajoPadreId: parentId,
                    trabajosHijos: childJobs,
                    createdAt: parentResult.rows[0].created_at
                });
            } 
            //TRABAJO ÚNICO
            else {
                const job = await blueskyQueue.add('twitter-scraping', jobData, {
                    jobId: `twitter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    priority: 1
                });

                const result = await query(
                    `INSERT INTO trabajo (user_id, bullmq_id, platform, search_params, status, es_padre)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, created_at`,
                    [user.id, job.id, 'twitter', JSON.stringify(jobData), 'waiting', false]
                );

                res.json({
                    success: true,
                    message: 'Trabajo de Twitter iniciado',
                    jobId: job.id,
                    trabajoId: result.rows[0].id,
                    createdAt: result.rows[0].created_at
                });
            }

        } catch (error) {
            console.error('Error iniciando scraping de Twitter:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    },

    async getJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            
            const result = await query(
                `SELECT t.*, u.email as user_email 
                 FROM trabajo t 
                 JOIN usuario u ON t.user_id = u.id 
                 WHERE t.bullmq_id = $1`,
                [jobId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Trabajo no encontrado' });
            }

            res.json({
                success: true,
                job: result.rows[0]
            });

        } catch (error) {
            res.status(500).json({ error: 'Error obteniendo estado del trabajo' });
        }
    }
};

module.exports = scrapingController;