import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { performance } from 'perf_hooks';
import axios from 'axios';
import https from 'https';
import iaConstraintsRouter from './routes/iaConstraints';

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
        rejectUnauthorized: false
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
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware d'erreur générique
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne, réessayez plus tard.' });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`🚀 Serveur DDOT lancé sur port ${port} (${performance.timeOrigin.toFixed(0)})`);
  console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
}); 