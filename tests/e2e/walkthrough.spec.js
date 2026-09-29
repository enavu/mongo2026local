import { expect, test } from '@playwright/test';

test('shell walkthrough changes the decision through supersession', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Memory that keeps up');
  await expect(page.getByText('Legacy mongo shell')).toBeVisible();
  await expect(page.locator('.record.superseded')).toHaveCount(0);

  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await expect(page.getByText('MongoDB Shell (mongosh)')).toBeVisible();
  await expect(page.locator('.record.superseded')).toHaveCount(1);

  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await expect(page.locator('.decision-after')).toContainText('mongosh');
  await expect(page.locator('.tone-resolved')).toBeVisible();
});

test('newer related feature does not supersede the shell choice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  const related = page.locator('.record.related');
  await expect(related).toContainText('editor mode');
  await expect(related).not.toHaveClass(/superseded/);
});

test('vector search version conflict requires review', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Vector Search' }).click();
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await expect(page.locator('.tone-conflict')).toBeVisible();
  await expect(page.locator('.decision-head')).toContainText('Review required');
});

test('reset clears progression and query dialog closes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.stage.current strong')).toHaveText('Recall');

  await page.getByRole('button', { name: 'View query' }).click();
  await expect(page.getByText('$vectorSearch')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('$vectorSearch')).toHaveCount(0);
});

test('free-text question resolves to the superseding source', async ({ page }) => {
  await page.goto('/');
  await page.fill('.ask input', 'what replaced the old mongo shell');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.question-lead h2')).toHaveText(/old mongo shell/i);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await expect(page.locator('.decision-after')).toContainText('mongosh');
});

test('vector map renders points and highlights the query', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Legacy mongo shell')).toBeVisible();
  await page.getByRole('button', { name: 'Show vectors' }).click();
  await expect(page.locator('.vectormap')).toBeVisible();
  await expect(page.locator('.vectormap .vpoint')).toHaveCount(13);

  await page.fill('.ask input', 'what replaced the old mongo shell');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.vquery')).toBeVisible();
});

test('off-topic question returns an honest no-source state', async ({ page }) => {
  await page.goto('/');
  await page.fill('.ask input', 'how do I shard a collection');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('.hint.warn')).toContainText(/No confidently related source/i);
});

test('drift check reports version 9 as provisional', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Drift check' }).click();
  await expect(page.locator('.driftform')).toBeVisible();
  await page.getByRole('button', { name: 'Check drift', exact: true }).click();
  await expect(page.locator('.driftresult.provisional')).toBeVisible();
  await expect(page.locator('.driftverdict')).toHaveText(/provisional/i);
});

test('drift check flags an outdated stack', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Drift check' }).click();
  const inputs = page.locator('.driftform input');
  await inputs.nth(0).fill('6.0.9');   // server version
  await inputs.nth(1).fill('6.4.0');   // driver version
  await page.getByRole('button', { name: 'Check drift', exact: true }).click();
  await expect(page.locator('.driftresult.drift')).toBeVisible();
  await expect(page.locator('.driftreasons')).toContainText(/below the ANN minimum/i);
});

test('source inspector shows the verified source URL and evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByText('MongoDB Shell (mongosh)').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('mongodb.com/docs/mongodb-shell')).toBeVisible();
  await expect(dialog.getByText(/deprecated in MongoDB v5.0/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
