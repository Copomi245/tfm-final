const { Redis } = require('ioredis');

// Configurar conexión a Redis
const redis = new Redis({
    host:  'localhost',
    port: 6379,
    password:'ZekromUva',
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

// Manejadores de eventos
redis.on('connect', () => {
    console.log('Conectado a Redis');
});

redis.on('error', (err) => {
    console.log('Error de Redis:', err.message);
});

redis.on('ready', () => {
    console.log('Redis listo para usar');
});

module.exports = redis;
module.exports.getClient = () => redis;
