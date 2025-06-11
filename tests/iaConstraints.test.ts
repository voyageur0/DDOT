import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
const iaConstraintsRouter = require('../src/routes/iaConstraints.js');
import './mocks/openai.mock.js';
import './mocks/geo.mock.js';
import axios from 'axios';

const app = express();
app.use(express.json());
app.post('/api/ia-constraints', iaConstraintsRouter);

describe('POST /api/ia-constraints', () => {
  it('retourne des contraintes et un temps de calcul', async () => {
    const res = await request(app)
      .post('/api/ia-constraints')
      .send({ lat: 46.2, lon: 7.3 });
    expect(res.status).toBe(200);
    expect(res.body.constraints).toMatch(/Indice/);
    expect(typeof res.body.elapsedMs).toBe('number');
  });
}); 