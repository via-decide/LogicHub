import { test, expect } from '@playwright/test';
test('builder preservation', async ({ page }) => { await page.goto('/builder/'); await expect(page.locator('body')).toBeVisible(); await expect(page.locator('text=/Make App|AI App Builder|Builder Operating System/i').first()).toBeVisible(); });
