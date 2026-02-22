// queues/bluesky-queue.js
const { Queue } = require('bullmq');
const redis = require('../../shared/redis');

const blueskyQueue = new Queue('bluesky-queue', { 
    connection: redis,
    defaultJobOptions: {
        attempts: 1,
        backoff: { type: 'exponential', delay: 30000 },
        timeout: 3600000 // 1 hora de timeout
    }
});

console.log('Cola creada');

module.exports = blueskyQueue;