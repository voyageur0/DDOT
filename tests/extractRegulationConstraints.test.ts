// @ts-ignore - vitest types disponibles via devDependency
import { describe, it, expect, vi } from 'vitest';
import { extractRegulationConstraints } from '../src/lib/regulationExtractor';
import * as openaiUtil from '../src/utils/openai';

// Mock de callOpenAI pour éviter un vrai appel réseau
vi.spyOn(openaiUtil, 'callOpenAI').mockResolvedValue({
  choices: [
    {
      message: {
        content: '[{"zone":"R3","theme":"Destination de zone","rule":"≥ 80 % logements collectifs"}]'
      }
    }
  ]
} as any);

describe('extractRegulationConstraints', () => {
  it('should parse JSON list of constraints', async () => {
    const rawText = 'Zone R3: au moins 80 % de logements collectifs...';
    const result = await extractRegulationConstraints(rawText);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].zone).toBe('R3');
    expect(result[0].theme).toBeDefined();
  });
}); 