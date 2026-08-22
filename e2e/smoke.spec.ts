import { test, expect } from '@playwright/test';

/**
 * Fumaça: sobe o dev server real e confirma que rotas públicas renderizam
 * sem erro de console e que o middleware bloqueia rotas autenticadas sem
 * sessão. Não depende de credenciais — serve de smoke test de infraestrutura
 * (build/roteamento) e de referência para novos specs de UI.
 */
test.describe('smoke', () => {
  test('/login renderiza sem erros de console', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('rota autenticada (/conversations) redireciona para /login sem sessão', async ({ page }) => {
    await page.goto('/conversations');
    await expect(page).toHaveURL(/\/login/);
  });
});
