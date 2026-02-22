const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');          
const fs = require('fs');
const { createBullBoard } = require('@bull-board/api');
const { ExpressAdapter } = require('@bull-board/express');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const userService = require('../services/user-service'); 
const authRoutes = require('../routes/authRoutes');
const scrapingRoutes = require('../routes/scrapingRoutes');
const jobRoutes = require('../routes/jobRoutes');
const downloadRoutes = require('../routes/downloadRoutes');
const workerRoutes = require('../routes/workerRoutes');

const scheduledCleanup =require('../scripts/scheduledCleanup')


const app = express();
const server = http.createServer(app);



app.use(cors());
app.use(express.json({ limit: '1000mb' })); 
app.use(express.urlencoded({ limit: '1000mb', extended: true }));

//BULL BOARD
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { setQueues } = createBullBoard({
  queues: [],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

//RUTAS PÚBLICAS
app.use('/api/auth', authRoutes);


app.use('/api/worker', workerRoutes);



app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor de colas funcionando',
    timestamp: new Date().toISOString()
  });
});

//MIDDLEWARE DE AUTENTICACIÓN 
app.use('/api', async (req, res, next) => {
  try {
    const publicRoutes = [
      '/auth',          
      '/health',        
      '/test'           
    ];

    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    
    if (isPublicRoute) {
      return next();
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key requerida' });
    }

    const isValid = await userService.validateApiKey(apiKey);
    if (!isValid) {
      return res.status(401).json({ error: 'API key inválida' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

//RUTAS PROTEGIDAS
app.get('/api/protected', (req, res) => {
  res.json({ message: 'Ruta protegida - API key válida' });
});
app.use('/api/scraping', scrapingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/download', downloadRoutes);

//CONFIGURACIÓN DE COLA
try {
  const testQueue = require('./queues/test-queue');
  const blueskyQueue = require('./queues/bluesky-queue');

  setQueues([
    new BullMQAdapter(testQueue, { 
      name: 'test-scraping-queue',
      readOnlyMode: false
    }),new BullMQAdapter(blueskyQueue, { 
            name: 'bluesky-scraping-queue',
            readOnlyMode: false
        })
  ]);
  console.log('Cola test-queue conectada al dashboard');
} catch (error) {
  console.log('Cola test-queue no disponible:', error.message);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Monitor de colas: http://localhost:${PORT}/admin/queues`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Auth: http://localhost:3001/api/auth/register`);
});



