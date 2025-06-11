"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)('bouton IA renvoie les contraintes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /IA/i }).click();
    await (0, test_1.expect)(page.getByText(/Indice brut/)).toBeVisible({ timeout: 10_000 });
});
