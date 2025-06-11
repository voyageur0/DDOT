"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const iaConstraints_js_1 = __importDefault(require("../src/routes/iaConstraints.js"));
require("./mocks/openai.mock.js");
require("./mocks/geo.mock.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post('/api/ia-constraints', iaConstraints_js_1.default);
(0, vitest_1.describe)('POST /api/ia-constraints', () => {
    (0, vitest_1.it)('retourne des contraintes et un temps de calcul', async () => {
        const res = await (0, supertest_1.default)(app)
            .post('/api/ia-constraints')
            .send({ lat: 46.2, lon: 7.3 });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.constraints).toMatch(/Indice/);
        (0, vitest_1.expect)(typeof res.body.elapsedMs).toBe('number');
    });
});
