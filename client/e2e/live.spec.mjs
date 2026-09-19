import { test, expect } from '@playwright/test';

const password = process.env.SIRTS_UAT_PASSWORD;
if (!password) throw new Error('SIRTS_UAT_PASSWORD is required');

const emails = {
  admin: process.env.SIRTS_UAT_ADMIN_EMAIL || 'sarah.sirts.260919.f7a9@gmail.com',
  lead: process.env.SIRTS_UAT_LEAD_EMAIL || 'cyril.sirts.260919.f7a9@gmail.com',
  l1: process.env.SIRTS_UAT_L1_EMAIL || 'allan.sirts.260919.f7a9@gmail.com',
  l2: process.env.SIRTS_UAT_L2_EMAIL || 'tony.sirts.260919.f7a9@gmail.com',
  l3: process.env.SIRTS_UAT_L3_EMAIL || 'david.sirts.260919.f7a9@gmail.com',
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
  await expect(page.getByRole('link', { name:'Home', exact:true })).toBeVisible();

  await page.getByRole('link', { name:'Home', exact:true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await openMenu(page);
  await page.getByRole('link', { name:'Incidents', exact:true }).click();
  await expect(page.getByText('Suspicious PowerShell execution')).toBeVisible();
  await expect(page.getByText('Phishing credential capture')).toBeVisible();
});


test('admin can create an incident, open detail, and add an investigation note', async ({ page }) => {
  await login(page, emails.admin);
  await openMenu(page);
  await page.getByRole('link', { name:'Create', exact:true }).click();
  await expect(page).toHaveURL(/\/incidents\/new$/);

  await page.getByLabel(/Title/).fill('Browser UAT network scan');
  await page.getByLabel(/Description/).fill('Repeated scanning traffic was observed against a protected application segment during browser UAT.');
  await page.getByLabel('Category').selectOption('OTHER');
  await page.getByLabel('Severity').selectOption('LOW');
  await page.getByLabel('Source IP').fill('10.40.20.90');
  await page.getByLabel('Affected Asset').fill('APP-UAT-01');
  await page.getByRole('button', { name:'Create Incident' }).click();

  await expect(page).toHaveURL(/\/incidents\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name:'Browser UAT network scan' })).toBeVisible();

  const note = page.getByPlaceholder('Add investigation note...');
  await note.fill('Browser UAT note verifies comment creation and server-side attribution.');
  await page.getByRole('button', { name:'Post' }).click();
  await expect(page.getByText('Browser UAT note verifies comment creation and server-side attribution.')).toBeVisible();
});

test('admin user-management view loads staff and role controls', async ({ page }) => {
  await login(page, emails.admin);
  await openMenu(page);
  await page.getByRole('link', { name:'Users', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Staff access' })).toBeVisible();
  await expect(page.getByText('Sarah N.')).toBeVisible();
  await expect(page.locator('select').first()).toBeVisible();
});

test('L2 receives operational incident access without management modules', async ({ page }) => {
  await login(page, emails.l2);
  await openMenu(page);
  await expect(page.getByRole('link', { name:'Reports' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Audit' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);
  await page.getByRole('link', { name:'Incidents', exact:true }).click();
  await expect(page.getByRole('heading', { name:/Incident Registry/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { name:/Incident Registry/i })).toBeVisible();
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
