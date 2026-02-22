// scripts/scheduled-cleanup.js - MODIFICADO
const cleanupService = require('./limpiezaArchivos');
const cron = require('node-cron');
const { query } = require('../config/database');
const blueskyQueue = require('../api/queues/bluesky-queue');

class ScheduledCleanup {
    constructor() {
        this.scheduleCleanup();
        this.scheduleRecurrentJobs();
    }

    scheduleCleanup() {
        // Limpieza diaria a las 2:11 AM
        cron.schedule('02 11 * * *', async () => {
            console.log('Ejecutando limpieza programada...');
            await cleanupService.runFullCleanup();
        });

        console.log('Limpieza programada: Diaria a las 3:00 AM');
    }

    scheduleRecurrentJobs() {
        // Verificación de trabajos recurrentes a las 2:11 AM
        cron.schedule('02 11 * * *', async () => {
            console.log('Verificando trabajos recurrentes...');
            await this.checkRecurrentJobs();
        });

        console.log('Verificación recurrente: Diaria a las 4:00 AM');
    }


async checkRecurrentJobs() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        
        const result = await query(
            `SELECT id, user_id, search_params, recurrente_hasta 
             FROM trabajo 
             WHERE es_recurrente = true 
             AND status = 'programado' or status ='partial_failure'`
        );

        console.log(`Encontrados ${result.rows.length} trabajos recurrentes activos`);

        for (const trabajo of result.rows) {
            try {
                const searchParams = typeof trabajo.search_params === 'string' 
                    ? JSON.parse(trabajo.search_params) 
                    : trabajo.search_params;
                
                const user_id = trabajo.user_id;
                const recurrenteHasta = trabajo.recurrente_hasta;

                if (hoy > recurrenteHasta) {
                    console.log(`Trabajo recurrente ${trabajo.id} alcanzó su fecha límite: ${recurrenteHasta}`);
                    await query(
                        `UPDATE trabajo SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
                        [trabajo.id]
                    );
                    continue;
                }

                const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                
                console.log(`Procesando trabajo ${trabajo.id}:`);
                console.log(`   - Hoy: ${hoy}`);
                console.log(`   - Ayer: ${ayer}`);
                console.log(`   - Límite: ${recurrenteHasta}`);
                console.log(`   - ¿Hoy > Límite?: ${hoy > recurrenteHasta}`);

                // Verificar si ya existe un trabajo para ayer
                const existingJob = await query(
                    `SELECT id FROM trabajo 
                     WHERE trabajo_padre_id = $1 
                     AND search_params::jsonb @> $2::jsonb`,
                    [trabajo.id, JSON.stringify({fechaDesde: ayer, fechaHasta: hoy})]
                );

                if (existingJob.rows.length > 0) {
                    console.log(`Ya existe trabajo para ${ayer}, saltando...`);
                    continue;
                }

                const jobData = {
                    ...searchParams,
                    fechaDesde: ayer,    
                    fechaHasta: hoy,     
                    tweetsLimit: searchParams.tweetsLimit || 100
                };

                const job = await blueskyQueue.add('bluesky-scraping', jobData, {
                    jobId: `bluesky-recurrente-${trabajo.id}-${ayer}-${Math.random().toString(36).substr(2, 5)}`,
                    priority: 1
                });

                await query(
                    `INSERT INTO trabajo (user_id, bullmq_id, platform, search_params, status, trabajo_padre_id, es_padre)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [user_id, job.id, 'bluesky', JSON.stringify(jobData), 'waiting', trabajo.id, false]
                );

                console.log(`Creado trabajo recurrente para recopilar datos de ${ayer}`);

            } catch (error) {
                console.error(`Error procesando trabajo recurrente ${trabajo.id}:`, error);
            }
        }

    } catch (error) {
        console.error('Error en verificación de trabajos recurrentes:', error);
    }
}

    async runManualCleanup() {
        console.log('Ejecutando limpieza manual...');
        await cleanupService.runFullCleanup();
    }
}

module.exports = new ScheduledCleanup();