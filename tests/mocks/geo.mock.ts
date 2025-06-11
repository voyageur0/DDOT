import { vi } from 'vitest';

vi.mock('../../src/lib/geo.ts', async (importOriginal: any) => {
  const mod = await importOriginal();
  return {
    ...mod,
    fetchParcelZone: vi.fn().mockResolvedValue({
      label: 'Zone résidentielle R2',
      communeId: '6296',
    }),
  };
});

vi.mock('../../src/lib/reglement.ts', async (importOriginal: any) => {
  const mod = await importOriginal();
  return {
    ...mod,
    fetchCommuneReglement: vi.fn().mockResolvedValue('Règlement simulé : Indice brut max 0.8, hauteur max 12m'),
  };
}); 