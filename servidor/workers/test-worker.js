const { Worker } = require('bullmq');
const redis = require('../shared/redis');

console.log('🟡 Iniciando worker de prueba...');

// Worker simple de prueba
const testWorker = new Worker('test-queue', async job => {
    const { message, seconds, type } = job.data;
    
    console.log('⏸️ Worker pausado por 5 segundos para que veas el dashboard...');
await new Promise(resolve => setTimeout(resolve, 5000)); // ← Pausa de 5 segundos
console.log('▶️ Worker iniciando...');
    console.log(`🟢 Procesando job ${job.id}: ${message}`);
    console.log(`   ⏰ Duración: ${seconds} segundos | Tipo: ${type}`);
    
    // Simular trabajo con delay
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    
    console.log(`✅ Job ${job.id} completado: ${message}`);
    
    return { 
        status: 'completed', 
        jobId: job.id,
        processedAt: new Date().toISOString(),
        message: `Procesado: ${message}`,
        duration: `${seconds} segundos`
    };
}, { 
    connection: redis,
    concurrency: 2, // Máximo 2 jobs simultáneos
    limiter: {
        max: 10,    // Máximo 10 jobs por segundo
        duration: 1000
    }
});

// Eventos del worker
testWorker.on('completed', job => {
    console.log(`🎉 Job ${job.id} terminado con éxito`);
    console.log(`   📊 Resultado:`, job.returnvalue);
});

testWorker.on('failed', (job, err) => {
    console.log(`❌ Job ${job.id} falló:`, err.message);
});

testWorker.on('active', job => {
    console.log(`🔵 Job ${job.id} empezó a procesarse`);
});

testWorker.on('error', err => {
    console.log('⚠️ Error en worker:', err.message);
});

console.log('👷 Worker de prueba listo. Esperando jobs...');
console.log('-------------------------------------------');