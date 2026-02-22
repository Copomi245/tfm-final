const testQueue = require('./queues/test-queue');

async function addTestJobs() {
    console.log('Añadiendo jobs de prueba...');
    
    const jobs = [
    { message: "Scraping Twitter #1", seconds: 10, type: "twitter" },  
    { message: "Scraping Bluesky #1", seconds: 8, type: "bluesky" },   
    { message: "Scraping Twitter #2", seconds: 12, type: "twitter" },  
    { message: "Scraping Bluesky #2", seconds: 6, type: "bluesky" },   
    { message: "Tarea Larga de scraping", seconds: 15, type: "twitter" } 
];

    for (const [index, jobData] of jobs.entries()) {
        const job = await testQueue.add('scraping-job', jobData, {
            priority: jobData.type === 'twitter' ? 1 : 2,
            jobId: `test-job-${index + 1}-${Date.now()}`
        });
        console.log(`Job añadido: ${job.id} - ${jobData.message}`);
    }
    
    console.log('5 jobs de prueba añadidos a la cola');
    console.log('Abre: http://localhost:3001/admin/queues');
    console.log('Ve a la pestaña "Waiting" para ver los jobs');
}

addTestJobs().catch(console.error);