const { Queue } = require('bullmq');
const redis = require('../../shared/redis');

const testQueue = new Queue('test-queue', { 
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
    }
});

module.exports = testQueue;