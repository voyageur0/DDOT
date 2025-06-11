"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const perf_hooks_1 = require("perf_hooks");
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const iaConstraintsRouter = require('./routes/iaConstraints');
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '1mb' }));
// Configuration CORS pour production
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://your-domain.infomaniak.ch']
        : ['http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
}));
// Configuration de sécurité avec Helmet pour production
if (process.env.NODE_ENV === 'production') {
    app.use((0, helmet_1.default)({
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
}
else {
    // Mode développement - sécurité minimale
    console.log('🔧 Mode développement - sécurité désactivée');
}
// Servir les fichiers statiques depuis public/
app.use(express_1.default.static('public'));
app.use('/api', iaConstraintsRouter);
// Route proxy pour GeoAdmin (résout les problèmes CORS)
app.get('/api/geoadmin-search', async (req, res) => {
    try {
        const { searchText, type = 'locations', origins = 'parcel,address,gg25', limit = '8', sr = '2056' } = req.query;
        if (!searchText) {
            return res.status(400).json({ error: 'searchText parameter is required' });
        }
        const response = await axios_1.default.get(`https://api3.geo.admin.ch/rest/services/api/SearchServer`, {
            params: {
                searchText,
                type,
                origins,
                limit,
                sr
            },
            timeout: 10000,
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: false
            })
        });
        res.json(response.data);
    }
    catch (error) {
        console.error('Erreur proxy GeoAdmin:', error);
        res.status(500).json({ error: 'Erreur lors de la recherche GeoAdmin' });
    }
});
// Route de santé pour le monitoring
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Middleware d'erreur générique
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne, réessayez plus tard.' });
});
const port = process.env.PORT ?? 3001;
app.listen(port, () => {
    console.log(`🚀 Serveur DDOT lancé sur port ${port} (${perf_hooks_1.performance.timeOrigin.toFixed(0)})`);
    console.log(`📍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});
