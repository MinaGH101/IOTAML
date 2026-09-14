import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const api = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8000';
const credentials = process.env.E2E_USERNAME && process.env.E2E_PASSWORD
  ? { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD }
  : JSON.parse(readFileSync(new URL('../../.e2e-credentials.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

test('upload → train selected ancestors → save version → reopen', async ({ page, request }) => {
  const login = await request.post(`${api}/api/auth/login`, { data: credentials });
  expect(login.ok()).toBeTruthy();
  const { access_token } = (await login.json()).data;
  const headers = { Authorization: `Bearer ${access_token}` };
  const created = await request.post(`${api}/api/projects`, { headers, data: { name: `Browser regression ${Date.now()}` } });
  expect(created.ok()).toBeTruthy();
  const project = (await created.json()).data;
  try {
    await page.goto('/');
    await page.locator('input[autocomplete="username"]').fill(credentials.username);
    await page.locator('input[type="password"]').fill(credentials.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/projects/);
    await page.goto(`/projects/${project.id}`);
    const uploaded = page.waitForResponse((r) => r.url().includes('/api/datasets/upload') && r.request().method() === 'POST');
    await page.locator('input[type="file"][accept*=".csv"]').setInputFiles({ name: 'training.csv', mimeType: 'text/csv',
      buffer: Buffer.from('x,y\n' + Array.from({ length: 30 }, (_, i) => `${i},${2 * i + 3}`).join('\n')) });
    const uploadResponse = await uploaded;
    expect(uploadResponse.ok()).toBeTruthy();
    const dataset = (await uploadResponse.json()).data;
    await expect(page.locator('b').filter({ hasText: /^training\.csv$/ })).toBeVisible();
    // Only graph setup uses the API. Upload, train, save and reopen use the browser.
    const node = (id: string, registryId: string, params = {}, index = 0) => ({ id, type: 'mlNode', position: { x: 80 + index * 230, y: 160 }, data: { registryId, label: id, params } });
    const graph = { nodes: [node('Input', 'DI-002', { dataset_id: dataset.id }), node('Split', 'MP-001', { test_size: 0.2 }, 1),
      node('Preprocess', 'MP-005', { imputation: 'median', scaling: 'standard' }, 2), node('Train', 'MR-001', {}, 3),
      node('Unconnected', 'UT-001', {}, 4)], edges: [
      { id: 'e1', source: 'Input', target: 'Split', sourceHandle: 'dataframe', targetHandle: 'data' },
      { id: 'e2', source: 'Split', target: 'Preprocess', sourceHandle: 'split', targetHandle: 'training' },
      { id: 'e3', source: 'Preprocess', target: 'Train', sourceHandle: 'training', targetHandle: 'training' },
    ], meta: { datasetId: dataset.id, targetColumn: 'y', taskType: 'regression' } };
    const response = await request.post(`${api}/api/workflows`, { headers, data: { name: 'Browser Training', project_id: project.id, graph } });
    expect(response.ok()).toBeTruthy();
    const workflow = (await response.json()).data;
    const url = `/projects/${project.id}/workspace?workflow=${workflow.id}`;
    await page.goto(url);
    const train = page.locator('.react-flow__node[data-id="Train"]');
    await expect(train).toBeVisible();
    const expandPalette = page.getByRole('button', { name: 'باز کردن منوی چپ', exact: true });
    if (await expandPalette.isVisible()) await expandPalette.click();
    const search = page.getByPlaceholder('جستجوی نود، دسته یا توضیح...');
    for (const name of ['Training Preprocessor', 'Persian Numbers / Dates', 'Remove Duplicate Rows', 'Group Summary']) {
      await search.fill(name);
      await expect(page.locator('.palette-node-name').getByText(name, { exact: true })).toBeVisible();
    }
    await search.fill('');
    await page.getByRole('button', { name: 'بستن منوی چپ', exact: true }).click();
    await train.click();
    const queued = page.waitForResponse((r) => /\/api\/runs$/.test(r.url()) && r.request().method() === 'POST');
    await page.getByTitle('اجرای نود انتخاب‌شده و ورودی‌های آن', { exact: true }).click();
    const runResponse = await queued;
    expect(runResponse.ok()).toBeTruthy();
    const run = (await runResponse.json()).data;
    await expect.poll(async () => {
      const result = await request.get(`${api}/api/runs/${run.id}`, { headers });
      return ['succeeded', 'failed', 'cancelled'].includes((await result.json()).data.status);
    }, { timeout: 120000 }).toBe(true);
    const completed = (await (await request.get(`${api}/api/runs/${run.id}`, { headers })).json()).data;
    expect(completed.status, completed.error || 'workflow failed').toBe('succeeded');
    expect(completed.artifacts.execution_plan.order).toEqual(['Input', 'Split', 'Preprocess', 'Train']);
    await expect(train.locator('.ml-node')).toHaveClass(/runtime-succeeded|runtime-cached/);
    await page.getByTitle('ذخیره نسخه نام‌گذاری‌شده', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').fill('Verified training');
    const saved = page.waitForResponse((r) => r.url().endsWith(`/workflows/${workflow.id}/versions`) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'ذخیره نسخه', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(dialog).not.toBeVisible();
    await page.goto(`/projects/${project.id}`);
    await page.goto(url);
    await expect(page.locator('.react-flow__node[data-id="Train"]')).toBeVisible();
    const persisted = (await (await request.get(`${api}/api/workflows/${workflow.id}`, { headers })).json()).data;
    expect(persisted.last_run_id).toBe(run.id);
    const versions = (await (await request.get(`${api}/api/workflows/${workflow.id}/versions`, { headers })).json()).data;
    expect(versions.some((v: { name: string }) => v.name === 'Verified training')).toBeTruthy();
  } finally {
    const deleted = await request.delete(`${api}/api/projects/${project.id}`, { headers });
    expect(deleted.ok()).toBeTruthy();
  }
});
