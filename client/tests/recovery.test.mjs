import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateBackendConfig, RETIRED_PROJECTS } from '../src/lib/backendConfig.js';
import { allowedStatuses } from '../src/lib/permissions.js';

test('backend isolation rejects missing, mismatched, retired, and secret configurations', () => {
  const env = { VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', VITE_SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.equal(validateBackendConfig(env).projectRef, env.VITE_SUPABASE_PROJECT_REF);
  assert.throws(() => validateBackendConfig({}));
  assert.throws(() => validateBackendConfig({ ...env, VITE_SUPABASE_PROJECT_REF: 'bcdefghijklmnopqrstu' }));
  assert.throws(() => validateBackendConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' }));
  for (const ref of RETIRED_PROJECTS) assert.throws(() => validateBackendConfig({ ...env, VITE_SUPABASE_URL: `https://${ref}.supabase.co`, VITE_SUPABASE_PROJECT_REF: ref }));
});

test('clean migration chain: SQL execution and direct role/row authorization', async t => {
  const db = new PGlite();
  try {
    // Local-only Auth fixture; no real passwords or remote Auth users are created.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create publication supabase_realtime;`);
    const dir = new URL('../../supabase/migrations/', import.meta.url);
    const files = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
    assert(files.length > 0, 'the clean migration chain is present');
    for (const file of files) await db.exec(await readFile(new URL(file, dir), 'utf8'));
    const roles = ['ADMIN','SOC_LEAD','SOC_ANALYST_L1','SOC_ANALYST_L2','SOC_ANALYST_L3'];
    const ids = roles.map((_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
    for (let i = 0; i < roles.length; i++) {
      await db.query(`insert into auth.users values ($1,$2,$3,$4)`, [ids[i], `${i}@example.test`, {first_name:'Test',last_name:roles[i]}, {sirts_staff:true,sirts_role:roles[i]}]);
      await db.query('update public.users set role_id=$1 where id=$2', [roles[i], ids[i]]);
    }
    const as = async (index, sql, params = []) => {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[index]]);
      try { return await db.query(sql, params); }
      finally { await db.exec('reset role'); }
    };
    await t.test('profile lookup succeeds without recursive RLS for all five roles', async () => {
      for (let i = 0; i < roles.length; i++) {
        const result = await as(i, 'select u.role_id, r.name from public.users u join public.roles r on r.id=u.role_id where u.id=$1', [ids[i]]);
        assert.equal(result.rows[0].name, roles[i]);
      }
    });
    await t.test('public signup cannot choose a staff role using editable metadata', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000009';
      await db.query('insert into auth.users values ($1,$2,$3,$4)', [fakeId,'fake@example.test',{first_name:'Fake',last_name:'Admin',sirts_staff:true,sirts_role:'ADMIN'},{}]);
      assert.equal((await db.query('select role_id from public.users where id=$1', [fakeId])).rows[0].role_id, null);
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [fakeId]);
      try {
        assert.equal((await db.query('select id from public.roles')).rows.length, 0);
        await assert.rejects(db.query("insert into public.incidents(title,created_by) values ('Denied',$1)", [fakeId]), /row-level security/);
      } finally {
        await db.exec('reset role');
      }
    });
    await t.test('all tables deny anonymous reads', async () => {
      await db.exec('set role anon');
      for (const name of ['users','roles','incidents','comments','incident_updates','notifications','audit_log','kb_articles','assets','incident_assets']) {
        await assert.rejects(db.query(`select * from public.${name}`), /permission denied/);
      }
      await db.exec('reset role');
    });
    const incidentIds = [];
    for (let i = 0; i < roles.length; i++) {
      const result = await as(i, "insert into public.incidents(title,created_by) values ('Test incident',$1) returning id", [ids[i]]);
      incidentIds.push(result.rows[0].id);
    }
    await t.test('analysts see own incidents; managers see all; unrelated comments are denied', async () => {
      for (let i = 0; i < roles.length; i++) {
        const visible = await as(i, 'select id from public.incidents');
        assert.equal(visible.rows.length, i < 2 ? 5 : 1);
        const profileChange = await as(i, 'update public.users set role_id=$1 where id=$2 returning id', ['ADMIN',ids[i]]);
        assert.equal(profileChange.rows.length, 0, 'self promotion is denied');
      }
      await assert.rejects(as(2, 'insert into public.comments(incident_id,user_id,body) values($1,$2,$3)', [incidentIds[0], ids[2], 'unauthorised']), /row-level security/);
      assert.equal((await as(2, "update public.incidents set title='stolen' where id=$1 returning id", [incidentIds[0]])).rows.length,0);
    });
    await t.test('direct operations enforce tiers, assignment restrictions, and truthful audit history', async () => {
      for (let i=0;i<roles.length;i++) {
        const id=incidentIds[i];
        await as(i, "insert into public.comments(incident_id,user_id,body) values($1,$2,'Test comment')", [id,ids[i]]);
        await assert.rejects(as(i, "insert into public.audit_log(incident_id,user_id,action) values($1,$2,'FORGED')", [id,ids[i]]), /permission denied/);
        await assert.rejects(as(i, "update public.incidents set created_by=$1 where id=$2", [ids[0],id]), /permission denied/);
        if (i>=2) await assert.rejects(as(i, 'update public.incidents set assigned_to=$1 where id=$2', [ids[0],id]), /Only administrators/);
        await as(i, "update public.incidents set status='In Progress' where id=$1",[id]);
        if (i===2) {
          assert(!allowedStatuses(roles[i],{status:'In Progress'}).includes('Resolved'));
          await assert.rejects(as(i,"update public.incidents set status='Resolved' where id=$1",[id]), /L2 or higher/);
        } else {
          assert(allowedStatuses(roles[i],{status:'In Progress'}).includes('Resolved'));
          const result=await as(i,"update public.incidents set status='Resolved' where id=$1 returning resolved_at",[id]);
          assert(result.rows[0].resolved_at);
          if (i===3) await assert.rejects(as(i,"update public.incidents set status='Closed' where id=$1",[id]), /L3 or higher/);
          else await as(i,"update public.incidents set status='Closed' where id=$1",[id]);
        }
        if(i>=2) assert.equal((await as(i,'select * from public.audit_log')).rows.length,0);
        else assert((await as(i,'select * from public.audit_log')).rows.length>0);
        assert((await as(i,'select * from public.incident_updates where incident_id=$1',[id])).rows.length>0);
      }
      await as(1,'update public.incidents set assigned_to=$1 where id=$2',[ids[2],incidentIds[1]]);
      assert.equal((await as(2,'select * from public.incidents where id=$1',[incidentIds[1]])).rows.length,1);
    });
    await t.test('KB and assets are readable by all staff and writable only by management', async () => {
      for(let i=0;i<roles.length;i++) {
        if(i<2) {
          await as(i,"insert into public.kb_articles(title,content) values('Test article','Test content')");
          await as(i,"insert into public.assets(name,ip_address) values('Test asset',null)");
        } else {
          await assert.rejects(as(i,"insert into public.kb_articles(title,content) values('Denied','Denied')"),/row-level security/);
          await assert.rejects(as(i,"insert into public.assets(name) values('Denied')"),/row-level security/);
        }
        assert((await as(i,'select * from public.kb_articles')).rows.length>0);
        assert((await as(i,'select * from public.assets')).rows.length>0);
      }
    });
    await t.test('live asset links, KB traceability, comment auditing, and deadline trackers stay authorized', async () => {
      const assetId = (await as(0, 'select id from public.assets order by created_at limit 1')).rows[0].id;
      await as(2, 'insert into public.incident_assets(incident_id,asset_id,added_by) values($1,$2,$3)', [incidentIds[2], assetId, ids[2]]);
      assert.equal((await as(2, 'select asset_id from public.incident_assets where incident_id=$1', [incidentIds[2]])).rows[0].asset_id, assetId);
      await assert.rejects(
        as(2, 'insert into public.incident_assets(incident_id,asset_id,added_by) values($1,$2,$3)', [incidentIds[0], assetId, ids[2]]),
        /row-level security/
      );

      await as(0, "insert into public.kb_articles(title,summary,content,source_incident_id,tags) values('Traceable','Source linked','Operational notes',$1,array['CRITICAL'])", [incidentIds[0]]);
      const article = (await as(0, 'select source_incident_id,tags from public.kb_articles where source_incident_id=$1', [incidentIds[0]])).rows[0];
      assert.equal(article.source_incident_id, incidentIds[0]);
      assert.deepEqual(article.tags, ['CRITICAL']);
      await assert.rejects(
        as(1, "insert into public.kb_articles(title,content,source_incident_id) values('Duplicate','Denied',$1)", [incidentIds[0]]),
        /unique constraint/
      );

      const commentAudit = await as(0, "select id from public.audit_log where incident_id=$1 and action='COMMENT_ADDED'", [incidentIds[2]]);
      assert(commentAudit.rows.length > 0);

      const activeIncident = (await as(0, "insert into public.incidents(title,severity,created_by) values('Deadline tracker','CRITICAL',$1) returning id", [ids[0]])).rows[0].id;
      const initialTrackers = await as(0, "select type,state,deadline_at from public.notifications where incident_id=$1 order by type", [activeIncident]);
      assert.deepEqual(initialTrackers.rows.map(row => row.type), ['KDPA_NOTIFICATION','SLA_DEADLINE']);
      assert(initialTrackers.rows.every(row => row.state === 'PENDING' && row.deadline_at));

      await as(0, "update public.incidents set status='In Progress' where id=$1", [activeIncident]);
      await as(0, "update public.incidents set status='Resolved' where id=$1", [activeIncident]);
      const cancelledTrackers = await as(0, "select state from public.notifications where incident_id=$1", [activeIncident]);
      assert(cancelledTrackers.rows.every(row => row.state === 'CANCELLED'));

      await as(0, "update public.incidents set status='In Progress' where id=$1", [activeIncident]);
      const reopenedTrackers = await as(0, "select type,state from public.notifications where incident_id=$1 order by type", [activeIncident]);
      assert.deepEqual(reopenedTrackers.rows, [
        { type:'KDPA_NOTIFICATION', state:'PENDING' },
        { type:'SLA_DEADLINE', state:'PENDING' },
      ]);
    });
    await t.test('role, asset, KB, link, and deletion activity is audited', async () => {
      const assetId = (await as(0, "insert into public.assets(name) values('Audited asset') returning id")).rows[0].id;
      const articleId = (await as(0, "insert into public.kb_articles(title,content) values('Audited article','Audited content') returning id")).rows[0].id;
      await as(0, 'delete from public.assets where id=$1', [assetId]);
      await as(0, 'delete from public.kb_articles where id=$1', [articleId]);
      await as(0, 'update public.users set role_id=$1 where id=$2', ['SOC_ANALYST_L2', ids[4]]);

      const actions = (await as(0, "select action,details from public.audit_log where action in ('ASSET_CREATED','ASSET_DELETED','KB_ARTICLE_CREATED','KB_ARTICLE_DELETED','USER_ROLE_CHANGED','INCIDENT_ASSET_LINKED') order by created_at")).rows;
      for (const action of ['ASSET_CREATED','ASSET_DELETED','KB_ARTICLE_CREATED','KB_ARTICLE_DELETED','USER_ROLE_CHANGED']) {
        const entry = actions.find(row => row.action === action && JSON.parse(row.details).actor_role === 'ADMIN');
        assert(entry, `${action} is recorded`);
      }
      assert(actions.some(row => row.action === 'INCIDENT_ASSET_LINKED' && JSON.parse(row.details).actor_role === 'SOC_ANALYST_L1'));

      const deletableIncident = (await as(0, "insert into public.incidents(title,created_by) values('Maintenance deletion',$1) returning id", [ids[0]])).rows[0].id;
      await assert.rejects(as(0, 'delete from public.incidents where id=$1', [deletableIncident]), /permission denied/);
      await db.exec('set role service_role');
      try {
        await db.query('delete from public.incidents where id=$1', [deletableIncident]);
      } finally {
        await db.exec('reset role');
      }
      const deletionAudit = await as(0, "select details from public.audit_log where action='INCIDENT_DELETED' order by created_at desc limit 1");
      assert.equal(JSON.parse(deletionAudit.rows[0].details).incident_id, deletableIncident);
    });
    await t.test('incident creation keeps selected assets atomic and assignment rejects locked profiles', async () => {
      const assetId = (await as(0, 'select id from public.assets order by created_at limit 1')).rows[0].id;
      const created = await as(0, "select public.create_incident_with_assets($1,$2,$3,$4,$5,$6,array[$7]::uuid[]) as id", ['Atomic incident','Required narrative','OTHER','HIGH','192.168.10.10',null,assetId]);
      const incidentId = created.rows[0].id;
      const linked = await as(0, 'select asset_id from public.incident_assets where incident_id=$1', [incidentId]);
      assert.deepEqual(linked.rows.map(row => row.asset_id), [assetId]);
      await assert.rejects(as(0, "update public.incidents set assigned_to=$1 where id=$2", [ids[5] || '00000000-0000-4000-8000-000000000009', incidentId]), /valid role/);
    });
  } finally { await db.close(); }
});
