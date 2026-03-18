import { test, expect } from "@playwright/test";

/**
 * E2E testy modulu Výroba – kritické flow
 * Pro plné testy s přihlášením nastavte TEST_USER_EMAIL a TEST_USER_PASSWORD
 * Pro spuštění: npm run test:e2e
 */
test.describe("Modul Výroba", () => {
  test("login stránka se načte", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("stránka /vyroba je dostupná (redirect na login bez auth)", async ({ page }) => {
    await page.goto("/vyroba");
    await expect(page).toHaveURL(/\/(vyroba|login)/);
  });

  test("stránka /vyroba/nastaveni je dostupná", async ({ page }) => {
    await page.goto("/vyroba/nastaveni");
    await expect(page).toHaveURL(/\/(vyroba\/nastaveni|login)/);
  });
});
