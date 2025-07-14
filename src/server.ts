import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { performance } from 'perf_hooks';
import axios from 'axios';
import https from 'https';
import iaConstraintsRouter from './routes/iaConstraints';
import ownersRouter from './routes/owners';
import utilsRouter from './routes/utils';

const app = express();

app.use(express.json({ limit: '1mb' }));

// Configuration CORS pour production
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://your-domain.infomaniak.ch']
      : ['http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
  }),
);

// Configuration de sécurité avec Helmet pour production
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        connectSrc: ["'self'", "https://api3.geo.admin.ch"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
      },
    },
  }));
} else {
  // Mode développement - sécurité minimale
  console.log('🔧 Mode développement - sécurité désactivée');
}

// Servir les fichiers statiques depuis public/
app.use(express.static('public'));

app.use('/api', iaConstraintsRouter);
app.use('/api', ownersRouter);
app.use('/api', utilsRouter);

// Route proxy pour GeoAdmin (résout les problèmes CORS)
app.get('/api/geoadmin-search', async (req, res) => {
  try {
    const { searchText, type = 'locations', origins = 'parcel,address,gg25', limit = '8', sr = '2056' } = req.query;
    
    if (!searchText) {
      return res.status(400).json({ error: 'searchText parameter is required' });
    }

    const response = await axios.get(`https://api3.geo.admin.ch/rest/services/api/SearchServer`, {
      params: {
        searchText,
        type,
        origins,
        limit,
        sr
      },
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true
      })
    });

    res.json(response.data);
  } catch (error) {
    console.error('Erreur proxy GeoAdmin:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche GeoAdmin' });
  }
});

// Route de santé pour le monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    server: 'DDOT TypeScript Server',
    autoreload: 'enabled'
  });
});

// Middleware d'erreur générique
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne, réessayez plus tard.' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Serveur DDOT lancé sur port ${port} (${performance.timeOrigin.toFixed(0)})`);
  console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Accessible sur:`);
  console.log(`   - http://localhost:${port}`);
  console.log(`   - http://127.0.0.1:${port}`);
  console.log(`   - http://0.0.0.0:${port}`);
}); 