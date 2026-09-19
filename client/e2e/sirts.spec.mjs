import { test, expect } from '@playwright/test';

const SUPABASE = 'https://tvjyllnfuptdcbirjvev.supabase.co';

const STAFF = {
  ADMIN: { id:'admin-1', name:'Sarah Namusoke', email:'sarah@ccorp.local', role:'ADMIN' },
  SOC_LEAD: { id:'lead-1', name:'Cyril', email:'cyril@ccorp.local', role:'SOC_LEAD' },
  SOC_ANALYST_L1: { id:'l1-1', name:'Allan Kato', email:'allan@ccorp.local', role:'SOC_ANALYST_L1' },
  SOC_ANALYST_L2: { id:'l2-1', name:'Tony Okello', email:'tony@ccorp.local', role:'SOC_ANALYST_L2' },
  SOC_ANALYST_L3: { id:'l3-1', name:'David Mugisha', email:'david@ccorp.local', role:'SOC_ANALYST_L3' },
};

const ROLE_ROWS = Object.values(STAFF).map(user => ({
  id: user.role,
  name: user.role,
  permissions: {},
}));

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'content-range',
};

const makeToken = user => {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg:'none', typ:'JWT' })}.${enc({
    sub:user.id,
    role:'authenticated',
    email:user.email,
    exp:Math.floor(Date.now()/1000)+3600,
  })}.test`;
};

const authUser = user => ({
  id:user.id,
  aud:'authenticated',
  role:'authenticated',
  email:user.email,
  email_confirmed_at:new Date().toISOString(),
  app_metadata:{ provider:'email', providers:['email'] },
  user_metadata:{ name:user.name },
  identities:[],
  created_at:new Date().toISOString(),
});

const profile = user => ({
  id:user.id,
  name:user.name,
  email:user.email,
  role_id:user.role,
  created_at:'2026-09-01T08:00:00Z',
  role:{ id:user.role, name:user.role, permissions:{} },
});

async function installMockBackend(page, role, options = {}) {
  const active = STAFF[role];
  const mutations = [];
  let articleRows = [];
  let assetRows = [];
  let incident = {
    id:'incident-1',
    title:'Suspicious PowerShell execution',
    description:'Encoded PowerShell was observed on a managed endpoint.',
    category:'MALWARE',
    severity:'HIGH',
    status: role === 'SOC_ANALYST_L1' ? 'New' : 'In Progress',
    created_by:STAFF.SOC_LEAD.id,
    assigned_to: role === 'SOC_ANALYST_L1' ? null : (
      role === 'SOC_ANALYST_L2' ? active.id : STAFF.SOC_ANALYST_L2.id
    ),
    source_ip:'10.10.20.5',
    affected_asset:'WS-FIN-014',
    created_at:'2026-09-18T08:00:00Z',
    updated_at:'2026-09-18T09:00:00Z',
    resolved_at:null,
  };

  const userRows = Object.values(STAFF).map(profile);

  await page.route(`${SUPABASE}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === 'OPTIONS') {
      return route.fulfill({
        status:204,
        headers:{
          ...jsonHeaders,
          'access-control-allow-headers':'authorization, apikey, content-type, x-client-info, prefer',
          'access-control-allow-methods':'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
        },
        body:'',
      });
    }

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      if (body.password === 'wrong-password') {
        return route.fulfill({
          status:400,
          headers:jsonHeaders,
          body:JSON.stringify({ error:'invalid_grant', error_description:'Invalid login credentials' }),
        });
      }

      return route.fulfill({
        status:200,
        headers:jsonHeaders,
        body:JSON.stringify({
          access_token:makeToken(active),
          token_type:'bearer',
          expires_in:3600,
          expires_at:Math.floor(Date.now()/1000)+3600,
          refresh_token:'mock-refresh-token',
          user:authUser(active),
        }),
      });
    }

    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(authUser(active)) });
    }

    if (url.pathname === '/auth/v1/logout') {
      return route.fulfill({ status:204, headers:jsonHeaders, body:'' });
    }

    if (url.pathname === '/rest/v1/roles' && method === 'GET') {
      return route.fulfill({ status:200, headers:{...jsonHeaders,'content-range':'0-4/5'}, body:JSON.stringify(ROLE_ROWS) });
    }

    if (url.pathname === '/rest/v1/users') {
      if (method === 'GET') {
        const idFilter = url.searchParams.get('id');
        const objectResponse = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
        if (idFilter || objectResponse) {
          const id = idFilter?.replace('eq.','') || active.id;
          const found = userRows.find(user => user.id === id) || profile(active);
          return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(found) });
        }
        return route.fulfill({ status:200, headers:{...jsonHeaders,'content-range':'0-4/5'}, body:JSON.stringify(userRows) });
      }

      if (method === 'PATCH') {
        mutations.push({ table:'users', method, body:JSON.parse(request.postData() || '{}') });
        return route.fulfill({ status:204, headers:jsonHeaders, body:'' });
      }
    }

    if (url.pathname === '/rest/v1/incidents') {
      if (method === 'HEAD') {
        return route.fulfill({ status:200, headers:{...jsonHeaders,'content-range':'0-0/1'}, body:'' });
      }

      if (method === 'GET') {
        const idFilter = url.searchParams.get('id');
        const objectResponse = request.headers()['accept']?.includes('application/vnd.pgrst.object+json');
        const row = {
          ...incident,
          assigned_to_user: incident.assigned_to
            ? { name:userRows.find(user => user.id === incident.assigned_to)?.name || 'Analyst' }
            : null,
          created_by_user:{ name:STAFF.SOC_LEAD.name },
        };

        if (idFilter || objectResponse) {
          return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(row) });
        }

        return route.fulfill({ status:200, headers:{...jsonHeaders,'content-range':'0-0/1'}, body:JSON.stringify([row]) });
      }

      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}');
        incident = {
          ...incident,
          ...body,
          id:'incident-new',
          created_at:new Date().toISOString(),
          updated_at:new Date().toISOString(),
        };
        mutations.push({ table:'incidents', method, body });
        return route.fulfill({ status:201, headers:jsonHeaders, body:JSON.stringify(incident) });
      }

      if (method === 'PATCH') {
        const body = JSON.parse(request.postData() || '{}');
        incident = { ...incident, ...body, updated_at:new Date().toISOString() };
        mutations.push({ table:'incidents', method, body });
        return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(incident) });
      }

      if (method === 'DELETE') {
        mutations.push({ table:'incidents', method });
        return route.fulfill({ status:204, headers:jsonHeaders, body:'' });
      }
    }

    if (url.pathname === '/rest/v1/comments') {
      if (method === 'GET') {
        return route.fulfill({ status:200, headers:jsonHeaders, body:'[]' });
      }
      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}');
        mutations.push({ table:'comments', method, body });
        return route.fulfill({
          status:201,
          headers:jsonHeaders,
          body:JSON.stringify({
            id:'comment-1',
            ...body,
            created_at:new Date().toISOString(),
            author:{ name:active.name },
          }),
        });
      }
    }

    if (url.pathname === '/rest/v1/audit_log') {
      return route.fulfill({ status:200, headers:{...jsonHeaders,'content-range':'0-0/0'}, body:'[]' });
    }

    if (url.pathname === '/rest/v1/incident_updates') {
      return route.fulfill({ status:200, headers:jsonHeaders, body:'[]' });
    }

    if (url.pathname === '/rest/v1/notifications') {
      return route.fulfill({ status:200, headers:jsonHeaders, body:'[]' });
    }

    if (url.pathname === '/rest/v1/kb_articles') {
      if (method === 'GET') {
        return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(articleRows) });
      }
      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}');
        const row = { id:'article-1', ...body, created_at:new Date().toISOString(), author:{name:active.name} };
        articleRows = [row];
        mutations.push({ table:'kb_articles', method, body });
        return route.fulfill({ status:201, headers:jsonHeaders, body:'[]' });
      }
    }

    if (url.pathname === '/rest/v1/assets') {
      if (method === 'GET') {
        return route.fulfill({ status:200, headers:jsonHeaders, body:JSON.stringify(assetRows) });
      }
      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}');
        const row = { id:'asset-1', ...body, created_at:new Date().toISOString() };
        assetRows = [row];
        mutations.push({ table:'assets', method, body });
        return route.fulfill({ status:201, headers:jsonHeaders, body:'[]' });
      }
      if (method === 'PATCH') {
        const body = JSON.parse(request.postData() || '{}');
        assetRows = assetRows.map(row => ({ ...row, ...body }));
        mutations.push({ table:'assets', method, body });
        return route.fulfill({ status:204, headers:jsonHeaders, body:'' });
      }
    }

    if (url.pathname.includes('/functions/v1/admin-create-user') && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      mutations.push({ table:'admin-create-user', method, body });
      return route.fulfill({
        status:200,
        headers:jsonHeaders,
        body:JSON.stringify({
          user:{ id:'created-user', email:body.email, name:body.name, role_id:body.role_id },
        }),
      });
    }

    return route.fulfill({ status:200, headers:jsonHeaders, body:'[]' });
  });

  return { active, mutations, getIncident:() => incident };
}

async function signIn(page, user) {
  await page.goto('/login');
  await page.getByLabel('Staff email').fill(user.email);
  await page.getByLabel('Password').fill('ValidPass!123');
  await page.getByRole('button', { name:'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('login is clean and rejects invalid credentials', async ({ page }) => {
  await installMockBackend(page, 'ADMIN');
  await page.goto('/login');

  await expect(page.getByRole('heading', { name:'SIRTS' })).toBeVisible();
  await expect(page.getByText(/Demo@1234|demo access/i)).toHaveCount(0);

  await page.getByLabel('Staff email').fill(STAFF.ADMIN.email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name:'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await expect(page).toHaveURL(/\/login$/);
});

test('administrator can traverse privileged modules and perform core actions', async ({ page }) => {
  const backend = await installMockBackend(page, 'ADMIN');
  await signIn(page, STAFF.ADMIN);

  await expect(page.getByRole('link', { name:'Reports' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Users' })).toBeVisible();

  await page.getByRole('link', { name:'Users' }).click();
  await page.getByRole('button', { name:'Add staff user' }).click();
  await page.locator('input[name="name"]').fill('Janet Nanyonga');
  await page.locator('input[name="email"]').fill('janet@ccorp.local');
  await page.locator('input[name="password"]').fill('TempSecure!123');
  await page.locator('select[name="role_id"]').selectOption('SOC_ANALYST_L1');
  await page.getByRole('button', { name:'Create staff user' }).click();
  await expect.poll(() => backend.mutations.some(mutation => mutation.table === 'admin-create-user')).toBeTruthy();
  await expect(page.getByText('Janet Nanyonga was created successfully.')).toBeVisible();

  await page.getByRole('link', { name:'Create' }).click();
  await page.locator('input[name="title"]').fill('Endpoint malware alert');
  await page.locator('textarea[name="description"]').fill('EDR detected a malicious executable and isolated the host.');
  await page.locator('select[name="severity"]').selectOption('HIGH');
  await page.getByRole('button', { name:'Create incident' }).click();
  await expect(page).toHaveURL(/\/incidents\/incident-new$/);

  await page.getByRole('link', { name:'Knowledge' }).click();
  await page.getByRole('button', { name:'New Article' }).click();
  await page.locator('input[name="title"]').fill('Malware containment checklist');
  await page.locator('input[name="summary"]').fill('Rapid containment steps');
  await page.locator('textarea[name="content"]').fill('1. Isolate host\n2. Preserve evidence\n3. Escalate.');
  await page.getByRole('button', { name:'Publish' }).click();
  await expect(page.getByText('Malware containment checklist')).toBeVisible();

  await page.getByRole('link', { name:'Assets' }).click();
  await page.getByRole('button', { name:'Add Asset' }).click();
  await page.locator('input[name="name"]').fill('WEB-PROD-01');
  await page.locator('input[name="ip_address"]').fill('10.0.0.10');
  await page.getByRole('button', { name:'Register Asset' }).click();
  await expect(page.getByText('WEB-PROD-01')).toBeVisible();

  await page.getByRole('link', { name:'Reports' }).click();
  await expect(page.getByRole('heading', { name:'Reports & analytics' })).toBeVisible();

  await page.getByRole('link', { name:'Audit' }).click();
  await expect(page.getByRole('heading', { name:'Audit log' })).toBeVisible();

  expect(backend.mutations.some(mutation => mutation.table === 'admin-create-user')).toBeTruthy();
  expect(backend.mutations.some(mutation => mutation.table === 'incidents' && mutation.method === 'POST')).toBeTruthy();
  expect(backend.mutations.some(mutation => mutation.table === 'kb_articles')).toBeTruthy();
  expect(backend.mutations.some(mutation => mutation.table === 'assets')).toBeTruthy();

  await page.getByRole('button', { name:'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('L1 view exposes claim/progress workflow but no privileged modules', async ({ page }) => {
  const backend = await installMockBackend(page, 'SOC_ANALYST_L1');
  await signIn(page, STAFF.SOC_ANALYST_L1);

  await expect(page.getByRole('link', { name:'Reports' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Audit' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);

  await page.goto('/incidents/incident-1');
  await page.getByRole('button', { name:'Claim incident' }).click();
  await expect.poll(() => backend.getIncident().assigned_to).toBe(STAFF.SOC_ANALYST_L1.id);
  await expect(page.getByText('Allan Kato · MALWARE')).toBeVisible();

  await page.locator('select').filter({ has: page.locator('option[value="In Progress"]') }).selectOption('In Progress');
  await page.getByRole('button', { name:'Update status' }).click();
  await expect.poll(() => backend.getIncident().status).toBe('In Progress');

  await expect(page.getByText('HIGH', { exact:true })).toBeVisible();
  await expect(page.getByRole('button', { name:'Update severity' })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Escalate' })).toHaveCount(0);
});

test('L2 analyst can resolve and escalate to L3 or Lead', async ({ page }) => {
  const backend = await installMockBackend(page, 'SOC_ANALYST_L2');
  await signIn(page, STAFF.SOC_ANALYST_L2);

  await page.goto('/incidents/incident-1');
  await expect(page.getByText('Escalate to L3 / Lead')).toBeVisible();

  const selects = page.locator('select');
  await selects.filter({ has:page.locator('option[value="Resolved"]') }).selectOption('Resolved');
  await page.getByRole('button', { name:'Update status' }).click();
  await expect.poll(() => backend.getIncident().status).toBe('Resolved');

  await selects.filter({ has:page.locator(`option[value="${STAFF.SOC_ANALYST_L3.id}"]`) }).selectOption(STAFF.SOC_ANALYST_L3.id);
  await page.getByRole('button', { name:'Escalate' }).click();
  await expect.poll(() => backend.getIncident().assigned_to).toBe(STAFF.SOC_ANALYST_L3.id);

  await expect(page.getByRole('button', { name:'Update severity' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Audit' })).toHaveCount(0);
});

test('L3 analyst gets senior incident, KB and asset controls without lead/admin pages', async ({ page }) => {
  await installMockBackend(page, 'SOC_ANALYST_L3');
  await signIn(page, STAFF.SOC_ANALYST_L3);

  await expect(page.getByRole('link', { name:'Reports' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Audit' })).toHaveCount(0);
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);

  await page.goto('/incidents/incident-1');
  await expect(page.getByRole('button', { name:'Update severity' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Update assignment' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Escalate' })).toHaveCount(0);

  await page.getByRole('link', { name:'Knowledge' }).click();
  await expect(page.getByRole('button', { name:'New Article' })).toBeVisible();

  await page.getByRole('link', { name:'Assets' }).click();
  await expect(page.getByRole('button', { name:'Add Asset' })).toBeVisible();
});

test('SOC Lead gets reporting, audit and closure but not user administration', async ({ page }) => {
  const backend = await installMockBackend(page, 'SOC_LEAD');
  await signIn(page, STAFF.SOC_LEAD);

  await expect(page.getByRole('link', { name:'Reports' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Audit' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Users' })).toHaveCount(0);

  await page.goto('/incidents/incident-1');
  const statusSelect = page.locator('select').filter({ has:page.locator('option[value="Closed"]') });
  await statusSelect.selectOption('Closed');
  await page.getByRole('button', { name:'Update status' }).click();
  await expect.poll(() => backend.getIncident().status).toBe('Closed');
});
