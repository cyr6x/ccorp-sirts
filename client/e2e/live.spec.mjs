import { test, expect } from '@playwright/test';

const password = process.env.SIRTS_UAT_PASSWORD;
if (!password) throw new Error('SIRTS_UAT_PASSWORD is required');

const emails = {
  admin: process.env.SIRTS_UAT_ADMIN_EMAIL || 'sarah@ccorp.local',
  lead: process.env.SIRTS_UAT_LEAD_EMAIL || 'cyril@ccorp.local',
  l1: process.env.SIRTS_UAT_L1_EMAIL || 'allan@ccorp.local',
  l3: process.env.SIRTS_UAT_L3_EMAIL || 'david@ccorp.local',
};

async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Staff email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name:'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('SIRTS', { exact:true }).first()).toBeVisible();
}

async function openMenu(page) {
  await page.getByRole('button', { name:'Open navigation menu' }).click();
  await expect(page.getByRole('complementary', { name:'Primary navigation' })).toBeVisible();
}

test('admin login, navigation, search, dashboard and privileged routes work', async ({ page }) => {
  await login(page, emails.admin);
  await expect(page.getByRole('heading', { name:'SIRTS' })).toBeVisible();

  await openMenu(page);
  await expect(page.getByRole('link', { name:'Reports' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Users' })).toBeVisible();
  await page.getByRole('button', { name:'Close menu panel' }).click();

  const search = page.getByRole('textbox', { name:'Quick navigation search' });
  await search.fill('assets');
  await expect(page.getByRole('button', { name:/Assets/ })).toBeVisible();
  await page.getByRole('button', { name:/Assets/ }).click();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(page.getByRole('link', { name:'Home' })).toBeVisible();

  await page.getByRole('link', { name:'Home' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openMenu(page);
  await page.getByRole('link', { name:'Incidents', exact:true }).click();
  await expect(page.getByText('Suspicious PowerShell execution')).toBeVisible();
  await expect(page.getByText('Phishing credential capture')).toBeVisible();
});

test('SOC Lead sees reports and audit but not user administration', async ({ page }) => {
  await login(page, emails.lead);
  await openMenu(page);
  await expect(page.getByRole('link', { name:'Reports' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);
});

test('L1 sees operational navigation without privileged modules', async ({ page }) => {
  await login(page, emails.l1);
  await openMenu(page);
  await expect(page.getByRole('link', { name:'Reports' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Audit' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);
  await page.getByRole('link', { name:'Incidents', exact:true }).click();
  await expect(page.getByText('Incident').first()).toBeVisible();
  await expect(page.getByText(/incidents/).first()).toBeVisible();
});

test('L3 can reach knowledge and assets management surfaces', async ({ page }) => {
  await login(page, emails.l3);
  await openMenu(page);
  await page.getByRole('link', { name:'Knowledge' }).click();
  await expect(page.getByRole('button', { name:'New Article' })).toBeVisible();
  await openMenu(page);
  await page.getByRole('link', { name:'Assets' }).click();
  await expect(page.getByRole('button', { name:'Add Asset' })).toBeVisible();
});

test('invalid password is rejected without leaving login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Staff email').fill(emails.admin);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name:'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await expect(page).toHaveURL(/\/login$/);
});
