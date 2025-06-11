import { test, expect } from '@playwright/test';

test('bouton IA renvoie les contraintes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /IA/i }).click();
  await expect(page.getByText(/Indice brut/)).toBeVisible({ timeout: 10_000 });
}); 