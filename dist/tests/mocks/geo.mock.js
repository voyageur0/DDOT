"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock('../../src/lib/geo.ts', async (importOriginal) => {
    const mod = await importOriginal();
    return {
        ...mod,
        fetchParcelZone: vitest_1.vi.fn().mockResolvedValue({
            label: 'Zone résidentielle R2',
            communeId: '6296',
        }),
    };
});
vitest_1.vi.mock('../../src/lib/reglement.ts', async (importOriginal) => {
    const mod = await importOriginal();
    return {
        ...mod,
        fetchCommuneReglement: vitest_1.vi.fn().mockResolvedValue('Règlement simulé : Indice brut max 0.8, hauteur max 12m'),
    };
});
