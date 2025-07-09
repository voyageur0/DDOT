import { describe, it, expect } from 'vitest';
import { 
  calculerDensiteValais, 
  convertirUVersIBUS, 
  TABLEAU_CONVERSION_U_IBUS,
  extraireIndicesReglement,
  formaterResultatsValais,
  type ValaisDensityCalculation 
} from '../src/lib/valaisDensityCalculator';

describe('Calculateur de densité constructible du Valais', () => {
  
  describe('Tableau de conversion U vers IBUS', () => {
    it('devrait convertir les indices U exacts selon le tableau officiel', () => {
      expect(convertirUVersIBUS(0.35)).toBe(0.5);
      expect(convertirUVersIBUS(0.50)).toBe(0.67);
      expect(convertirUVersIBUS(0.70)).toBe(0.93);
      expect(convertirUVersIBUS(0.85)).toBe(1.13);
    });

    it('devrait faire une interpolation linéaire pour les valeurs intermédiaires', () => {
      // Test interpolation entre 0.50 (0.67) et 0.55 (0.73)
      const result = convertirUVersIBUS(0.525); // Milieu entre 0.50 et 0.55
      expect(result).toBeCloseTo(0.70, 2); // Milieu entre 0.67 et 0.73
    });

    it('devrait gérer les valeurs en dehors des limites', () => {
      expect(convertirUVersIBUS(0.30)).toBe(0.5); // Valeur minimale
      expect(convertirUVersIBUS(0.90)).toBe(1.13); // Valeur maximale
    });
  });

  describe('Calculs de surface constructible', () => {
    const terrainExemple = {
      terrainSurface: 1000,
      commune: 'Sion',
      indiceU: 0.5
    };

    it('devrait calculer correctement la surface avec indice U', () => {
      const result = calculerDensiteValais(terrainExemple);
      
      expect(result.surfaceUtileU).toBe(500); // 1000 m² × 0.5
      expect(result.indiceU).toBe(0.5);
      expect(result.commune).toBe('Sion');
    });

    it('devrait convertir automatiquement U vers IBUS', () => {
      const result = calculerDensiteValais(terrainExemple);
      
      expect(result.indiceIBUS).toBeCloseTo(0.67, 2); // Conversion automatique
      expect(result.surfaceUtileIBUS).toBeCloseTo(670, 1); // 1000 m² × 0.67
      expect(result.tableauConversionUtilise).toBe(true);
      expect(result.warnings).toContain('Indice IBUS calculé automatiquement depuis U (0.5) = 0.67');
    });

    it('devrait calculer avec indice IBUS directement fourni', () => {
      const params = {
        terrainSurface: 800,
        commune: 'Martigny',
        indiceIBUS: 0.8
      };

      const result = calculerDensiteValais(params);
      
      expect(result.surfaceUtileIBUS).toBe(640); // 800 m² × 0.8
      expect(result.indiceIBUS).toBe(0.8);
      expect(result.tableauConversionUtilise).toBe(false);
    });
  });

  describe('Bonus énergétique', () => {
    const terrainBase = {
      terrainSurface: 1000,
      commune: 'Vétroz',
      indiceU: 0.6
    };

    it('devrait appliquer un bonus de 10% pour CECB', () => {
      const result = calculerDensiteValais({
        ...terrainBase,
        projetCECB: true
      });

      expect(result.bonusCECB).toBe(true);
      expect(result.bonusPercentage).toBe(10);
      expect(result.surfaceUtileU).toBe(600); // Surface de base
      expect(result.surfaceUtileUAvecBonus).toBe(660); // 600 × 1.1
      expect(result.warnings).toContain('Bonus énergétique appliqué (+10%) pour certification CECB');
    });

    it('devrait appliquer un bonus de 10% pour MINERGIE', () => {
      const result = calculerDensiteValais({
        ...terrainBase,
        projetMINERGIE: true
      });

      expect(result.bonusMINERGIE).toBe(true);
      expect(result.bonusPercentage).toBe(10);
      expect(result.surfaceUtileUAvecBonus).toBe(660); // 600 × 1.1
      expect(result.warnings).toContain('Bonus énergétique appliqué (+10%) pour certification MINERGIE');
    });

    it('devrait appliquer un bonus de 10% pour CECB + MINERGIE', () => {
      const result = calculerDensiteValais({
        ...terrainBase,
        projetCECB: true,
        projetMINERGIE: true
      });

      expect(result.bonusCECB).toBe(true);
      expect(result.bonusMINERGIE).toBe(true);
      expect(result.bonusPercentage).toBe(10); // Toujours 10% même avec les deux
      expect(result.surfaceUtileUAvecBonus).toBe(660);
      expect(result.warnings).toContain('Bonus énergétique appliqué (+10%) pour certification CECB et MINERGIE');
    });

    it('ne devrait pas appliquer de bonus par défaut', () => {
      const result = calculerDensiteValais(terrainBase);

      expect(result.bonusCECB).toBe(false);
      expect(result.bonusMINERGIE).toBe(false);
      expect(result.bonusPercentage).toBe(0);
      expect(result.surfaceUtileUAvecBonus).toBeUndefined();
    });
  });

  describe('Extraction d\'indices depuis règlement', () => {
    it('devrait extraire l\'indice U depuis un texte de règlement', () => {
      const texte = 'Dans cette zone, l\'indice U est de 0.6 et la hauteur maximale est de 12 mètres.';
      const indices = extraireIndicesReglement(texte);
      
      expect(indices.indiceU).toBe(0.6);
    });

    it('devrait extraire l\'indice IBUS depuis un texte de règlement', () => {
      const texte = 'L\'IBUS applicable est de 0.85 pour cette zone résidentielle.';
      const indices = extraireIndicesReglement(texte);
      
      expect(indices.indiceIBUS).toBe(0.85);
    });

    it('devrait extraire les deux indices depuis un texte complexe', () => {
      const texte = `
        Article 45: Zone résidentielle R2
        - Indice U: 0.7
        - IBUS correspondant: 0.93
        - Hauteur maximum: 15 mètres
      `;
      const indices = extraireIndicesReglement(texte);
      
      expect(indices.indiceU).toBe(0.7);
      expect(indices.indiceIBUS).toBe(0.93);
    });

    it('devrait gérer les virgules comme séparateurs décimaux', () => {
      const texte = 'Indice U: 0,75 et IBUS: 1,0';
      const indices = extraireIndicesReglement(texte);
      
      expect(indices.indiceU).toBe(0.75);
      expect(indices.indiceIBUS).toBe(1.0);
    });

    it('devrait retourner un objet vide si aucun indice trouvé', () => {
      const texte = 'Cette zone ne contient aucune information sur les indices.';
      const indices = extraireIndicesReglement(texte);
      
      expect(indices.indiceU).toBeUndefined();
      expect(indices.indiceIBUS).toBeUndefined();
    });
  });

  describe('Formatage des résultats', () => {
    it('devrait formater correctement un calcul complet', () => {
      const calcul: ValaisDensityCalculation = {
        terrainSurface: 1200,
        indiceU: 0.5,
        indiceIBUS: 0.67,
        surfaceUtileU: 600,
        surfaceUtileIBUS: 804,
        bonusCECB: true,
        bonusMINERGIE: false,
        bonusPercentage: 10,
        surfaceUtileUAvecBonus: 660,
        surfaceUtileIBUSAvecBonus: 884.4,
        tableauConversionUtilise: true,
        commune: 'Conthey',
        warnings: [
          'Indice IBUS calculé automatiquement depuis U (0.5) = 0.67',
          'Bonus énergétique appliqué (+10%) pour certification CECB'
        ]
      };

      const resultat = formaterResultatsValais(calcul);
      
      expect(resultat).toContain('📏 Analyse de la densité constructible (Valais)');
      expect(resultat).toContain('1\'200 m² (Conthey)');
      expect(resultat).toContain('🏠 Indice U (parties chauffées uniquement)');
      expect(resultat).toContain('🏢 Indice IBUS (toutes surfaces)');
      expect(resultat).toContain('🌱 Bonus énergétique');
      expect(resultat).toContain('📋 Conversion automatique');
      expect(resultat).toContain('💡 Exemple concret');
      expect(resultat).toContain('⚠️ Notes importantes');
    });

    it('devrait gérer un calcul sans bonus énergétique', () => {
      const calcul: ValaisDensityCalculation = {
        terrainSurface: 800,
        indiceU: 0.4,
        surfaceUtileU: 320,
        bonusCECB: false,
        bonusMINERGIE: false,
        bonusPercentage: 0,
        tableauConversionUtilise: false,
        commune: 'Riddes',
        warnings: []
      };

      const resultat = formaterResultatsValais(calcul);
      
      expect(resultat).not.toContain('🌱 Bonus énergétique');
      expect(resultat).not.toContain('📋 Conversion automatique');
      expect(resultat).not.toContain('⚠️ Notes importantes');
    });
  });

  describe('Validation des entrées', () => {
    it('devrait générer des warnings pour des entrées invalides', () => {
      const result = calculerDensiteValais({
        terrainSurface: 0,
        commune: 'Test'
      });

      expect(result.warnings).toContain('Surface de terrain invalide');
      expect(result.warnings).toContain('Aucun indice de construction fourni - impossible de calculer la densité');
    });

    it('devrait gérer un terrain négatif', () => {
      const result = calculerDensiteValais({
        terrainSurface: -100,
        commune: 'Test',
        indiceU: 0.5
      });

      expect(result.warnings).toContain('Surface de terrain invalide');
    });
  });

  describe('Cas d\'usage réels', () => {
    it('devrait calculer un exemple concret: villa individuelle', () => {
      // Exemple: Terrain de 800 m² en zone résidentielle 0.5 à Sion
      const result = calculerDensiteValais({
        terrainSurface: 800,
        indiceU: 0.5,
        commune: 'Sion',
        projetCECB: true
      });

      expect(result.surfaceUtileU).toBe(400); // 800 × 0.5
      expect(result.surfaceUtileUAvecBonus).toBe(440); // 400 × 1.1
      expect(result.indiceIBUS).toBeCloseTo(0.67); // Conversion automatique
      expect(result.surfaceUtileIBUS).toBeCloseTo(536); // 800 × 0.67
      expect(result.surfaceUtileIBUSAvecBonus).toBeCloseTo(589.6); // 536 × 1.1
    });

    it('devrait calculer un exemple concret: immeuble collectif', () => {
      // Exemple: Terrain de 1500 m² en zone résidentielle 0.7 à Martigny
      const result = calculerDensiteValais({
        terrainSurface: 1500,
        indiceU: 0.7,
        commune: 'Martigny',
        projetMINERGIE: true
      });

      expect(result.surfaceUtileU).toBe(1050); // 1500 × 0.7
      expect(result.surfaceUtileUAvecBonus).toBe(1155); // 1050 × 1.1
      expect(result.indiceIBUS).toBeCloseTo(0.93); // Conversion selon tableau
      expect(result.surfaceUtileIBUS).toBeCloseTo(1395); // 1500 × 0.93
      expect(result.surfaceUtileIBUSAvecBonus).toBeCloseTo(1534.5); // 1395 × 1.1
    });
  });
}); 