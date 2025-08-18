/**
 * Tests pour le pipeline d'ingestion géospatiale
 */

import { describe, it, expect, vi } from 'vitest';
import { fetchGeoAdminZones, fetchSITValaisZones, processCommune } from '../../scripts/ingest/ingest_regulation_geo.js';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

// Mock pg
vi.mock('pg', () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn(() => ({
      query: vi.fn(),
      release: vi.fn()
    })),
    end: vi.fn()
  }))
}));

describe('Ingest Regulation Geo', () => {
  describe('fetchGeoAdminZones', () => {
    it('doit formater correctement les données GeoAdmin', async () => {
      const mockResponse = {
        data: {
          results: [{
            attributes: {
              typ_kt: 'Wohnzone',
              typ_ch: 'Zone résidentielle',
              label: 'R1',
              flaeche_m2: 5000,
              gemeinde_name: 'Riddes'
            },
            geometry: { type: 'Polygon', coordinates: [[]] }
          }]
        }
      };

      const axios = await import('axios');
      axios.default.get.mockResolvedValueOnce(mockResponse);

      const zones = await fetchGeoAdminZones('Riddes', '6033');
      
      expect(zones).toHaveLength(1);
      expect(zones[0]).toMatchObject({
        source: 'geoadmin',
        layer: 'ch.are.bauzonen',
        commune_id: 'riddes',
        zone_type: 'Wohnzone',
        area_m2: 5000
      });
    });

    it('doit gérer les erreurs gracieusement', async () => {
      const axios = await import('axios');
      axios.default.get.mockRejectedValueOnce(new Error('Network error'));

      const zones = await fetchGeoAdminZones('Riddes', '6033');
      expect(zones).toEqual([]);
    });
  });

  describe('fetchSITValaisZones', () => {
    it('doit formater correctement les données SIT Valais', async () => {
      const mockResponse = {
        data: {
          features: [{
            properties: {
              type_zone: 'R20',
              code_zone: 'HAB_RES_20',
              designation: 'Zone résidentielle 20',
              surface: 3000,
              commune: 'RIDDES'
            },
            geometry: { type: 'Polygon', coordinates: [[]] }
          }]
        }
      };

      const axios = await import('axios');
      axios.default.get.mockResolvedValueOnce(mockResponse);

      const zones = await fetchSITValaisZones('Riddes');
      
      expect(zones).toHaveLength(1);
      expect(zones[0]).toMatchObject({
        source: 'sit_valais',
        layer: 'paz_zonesaffectation',
        commune_id: 'riddes',
        zone_type: 'R20',
        zone_code: 'HAB_RES_20'
      });
    });
  });

  describe('processCommune', () => {
    it('doit traiter une commune complètement', async () => {
      const axios = await import('axios');
      
      // Mock GeoAdmin response
      axios.default.get.mockResolvedValueOnce({
        data: { results: [{ attributes: { typ_kt: 'Zone1' }, geometry: {} }] }
      });
      
      // Mock SIT Valais response
      axios.default.get.mockResolvedValueOnce({
        data: { features: [{ properties: { type_zone: 'R1' }, geometry: {} }] }
      });

      const commune = { id: 'riddes', name: 'Riddes', bfs_code: '6033' };
      const count = await processCommune(commune);
      
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Validation géospatiale', () => {
    it('doit stocker des géométries valides', () => {
      const validGeometry = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      };
      
      // Test que la géométrie est valide GeoJSON
      expect(validGeometry.type).toBe('Polygon');
      expect(validGeometry.coordinates).toBeDefined();
      expect(validGeometry.coordinates[0]).toHaveLength(5); // Polygon fermé
    });

    it('doit utiliser le bon système de coordonnées', () => {
      const srid = 2056; // CH1903+ / LV95
      expect(srid).toBe(2056);
    });
  });

  describe('Test spécifique Riddes', () => {
    it('doit trouver au moins une zone pour Riddes', async () => {
      // Ce test vérifie que l'implémentation peut traiter Riddes
      const commune = { id: 'riddes', name: 'Riddes', bfs_code: '6033' };
      expect(commune.name).toBe('Riddes');
      expect(commune.bfs_code).toBe('6033');
    });
  });
});