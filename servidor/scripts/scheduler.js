const { query } = require('../config/database');
const blueskyQueue = require('../api/queues/bluesky-queue');
const redis = require('../shared/redis');

class Scheduler {
    constructor() {
        this.intervalTime = 60000; 
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            console.log(' Scheduler ya está en ejecución');
            return;
        }

        console.log('Scheduler iniciado. Buscando trabajos programados...');
        this.isRunning = true;
        
        await this.tick();
        
        this.interval = setInterval(() => this.tick(), this.intervalTime);
    }

    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.isRunning = false;
            console.log('Scheduler detenido');
        }
    }

    async tick() {
        try {
            const pendingParents = await query(`
                SELECT * FROM trabajo 
                WHERE tipo = 'programado' 
                AND status = 'scheduled'
                AND trabajo_padre_id IS NULL
            `);

            if (pendingParents.rows.length > 0) {
                console.log(`Scheduler encontrado ${pendingParents.rows.length} trabajos padre.`);
            }

            for (const parentJob of pendingParents.rows) {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const parentEndDate = new Date(parentJob.rango_fecha_hasta);

                if (parentEndDate < new Date(todayStr)) {
                    console.log(`Procesando trabajo padre ${parentJob.id} (Consulta Pasado)`);
                    await this.processHistoricalJob(parentJob);
                } else {
                    console.log(`Procesando trabajo padre ${parentJob.id} (Programación Recurrente)`);
                    await this.processRecurrentJob(parentJob);
                }
            }
        } catch (error) {
            console.error('Error en el Scheduler:', error);
        }
    }

    async processHistoricalJob(parentJob) {
    try {
        const startDate = new Date(parentJob.rango_fecha_desde);
        const endDate = new Date(parentJob.rango_fecha_hasta);
        
        // Asegurarnos de que el endDate incluya el último día
        endDate.setDate(endDate.getDate() + 1); 
        const dates = this.getDatesInRange(startDate, endDate);
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        console.log(`Creando jobs para ${dates.length - 1} días ${dates[0]} este ${(new Date(dates[0] - tzoffset)).toISOString().split('T')[0]}`);

        // Itera desde la primera fecha hasta la penúltima
        for (let i = 0; i < dates.length - 1; i++) {
            const currentDate = dates[i];
            const nextDate = dates[i + 1];
            const sinceDateStr = (new Date(dates[i] - tzoffset)).toISOString().split('T')[0]; 
            const untilDateStr = (new Date(dates[i+1] - tzoffset)).toISOString().split('T')[0];    

            // La fecha "objetivo" es el sinceDate (el día que queremos)
            const targetDateStr = sinceDateStr; 

            // Verificar si el job hijo para esta fecha objetivo ya existe
            const existingChild = await query(
                `SELECT id FROM trabajo WHERE trabajo_padre_id = $1 AND rango_fecha_desde = $2`,
                [parentJob.id, targetDateStr]
            );

            if (existingChild.rows.length > 0) {
                console.log(`Job hijo para ${targetDateStr} ya existe, omitiendo.`);
                continue;
            }

            const childJobData = {
                ...parentJob.search_params,
                fechaDesde: sinceDateStr,  
                fechaHasta: untilDateStr   
            };

            const childDbResult = await query(
                `INSERT INTO trabajo (
                    tipo, status, search_params, user_id, platform,
                    trabajo_padre_id, rango_fecha_desde, rango_fecha_hasta
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    'programado', 'waiting', childJobData, 
                    parentJob.user_id, parentJob.platform,
                    parentJob.id, sinceDateStr, untilDateStr
                ]
            );

            const childId = childDbResult.rows[0].id;
            const bullmqId = `bluesky-${Date.now()}-${childId}`;

            await query(`UPDATE trabajo SET bullmq_id = $1 WHERE id = $2`, [bullmqId, childId]);
            await blueskyQueue.add('bluesky-scraping', childJobData, { jobId: bullmqId });

            console.log(`Creado job para ${targetDateStr} (since:${sinceDateStr} until:${untilDateStr})`);
        }

        await query(`UPDATE trabajo SET status = 'completed' WHERE id = $1`, [parentJob.id]);
        console.log(`Trabajo padre ${parentJob.id} completado.`);

    } catch (error) {
        console.error(`Error procesando job histórico ${parentJob.id}:`, error);
    }
}

async processRecurrentJob(parentJob) {
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        
        const dayBeforeYesterday = new Date(yesterday);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
        
        const dayBeforeYesterdayStr = yesterday.toISOString().split('T')[0]; 
        const yesterdayStr = today.toISOString().split('T')[0];

        const parentEndDate = new Date(parentJob.rango_fecha_hasta);

        if (yesterday > parentEndDate) {
            console.log(`Trabajo recurrente ${parentJob.id} ha alcanzado su fecha final.`);
            await query(`UPDATE trabajo SET status = 'completed' WHERE id = $1`, [parentJob.id]);
            return;
        }

        const existingChild = await query(
            `SELECT id, status FROM trabajo 
             WHERE trabajo_padre_id = $1 AND rango_fecha_desde = $2`,
            [parentJob.id, yesterdayStr]
        );

        if (existingChild.rows.length > 0) {
            console.log(`Job para ${yesterdayStr} ya existe, omitiendo.`);
            return;
        }

        const childJobData = {
            ...parentJob.search_params,
            fechaDesde: dayBeforeYesterdayStr, 
            fechaHasta: yesterdayStr           
        };

        const childDbResult = await query(
            `INSERT INTO trabajo (
                tipo, status, search_params, user_id, platform,
                trabajo_padre_id, rango_fecha_desde, rango_fecha_hasta
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
                'programado', 'waiting', childJobData, 
                parentJob.user_id, parentJob.platform,
                parentJob.id, yesterdayStr, yesterdayStr 
            ]
        );

        const childId = childDbResult.rows[0].id;
        const bullmqId = `bluesky-${Date.now()}-${childId}`;

        await query(`UPDATE trabajo SET bullmq_id = $1 WHERE id = $2`, [bullmqId, childId]);
        await blueskyQueue.add('bluesky-scraping', childJobData, { jobId: bullmqId });

        console.log(`Creado job recurrente hijo ${childId} para el día ${yesterdayStr} (since:${dayBeforeYesterdayStr} until:${yesterdayStr})`);

    } catch (error) {
        console.error(`Error procesando job recurrente ${parentJob.id}:`, error);
    }
}

    getDatesInRange(startDate, endDate) {
        const dates = [];
        const currentDate = new Date(startDate);
        const finalDate = new Date(endDate);
        
        while (currentDate <= finalDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }

    // Función para cancelación en cascada
    async cancelJobWithChildren(jobId) {
        try {
            //Cancelar el trabajo principal
            await query(
                `UPDATE trabajo SET status = 'cancelled' WHERE id = $1`,
                [jobId]
            );

            //Buscar todos los hijos activos
            const activeChildren = await query(
                `SELECT id, bullmq_id, status FROM trabajo 
                 WHERE trabajo_padre_id = $1 AND status IN ('waiting', 'processing')`,
                [jobId]
            );

            console.log(`Cancelando ${activeChildren.rows.length} jobs hijos...`);

            //Cancelar cada hijo activo
            for (const child of activeChildren.rows) {
                await query(
                    `UPDATE trabajo SET status = 'cancelled' WHERE id = $1`,
                    [child.id]
                );
                
                if (child.status === 'waiting') {
                    try {
                        const jobInQueue = await blueskyQueue.getJob(child.bullmq_id);
                        if (jobInQueue) {
                            await jobInQueue.remove();
                            console.log(`Job ${child.bullmq_id} removido de la cola`);
                        }
                    } catch (error) {
                        console.error(`Error removiendo job de la cola:`, error);
                    }
                }
                
                // Si está en procesamiento (processing), señalizar cancelación
                if (child.status === 'processing') {
                    try {
                        const redisClient = redis.getClient();
                        await redisClient.set(`cancel:${child.bullmq_id}`, 'true', 'EX', 3600);
                        console.log(`⏹Señal de cancelación enviada para job ${child.bullmq_id}`);
                    } catch (error) {
                        console.error(`Error enviando señal de cancelación:`, error);
                    }
                }
            }

            console.log(`Cancelación en cascada completada para job ${jobId}`);

        } catch (error) {
            console.error('Error en cancelación en cascada:', error);
            throw error;
        }
    }
}

module.exports = new Scheduler();