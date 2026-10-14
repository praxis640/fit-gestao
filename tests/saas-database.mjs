// Run: npm install --no-save --package-lock=false @electric-sql/pglite
// node tests/saas-database.mjs (test-only dependency; never used by the app)
const { PGlite } = await import(process.env.SAAS_TEST_PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const admin='00000000-0000-0000-0000-000000000001';
const gym='00000000-0000-0000-0000-000000000002';
const other='00000000-0000-0000-0000-000000000003';
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create table public.gestao_configuracoes(user_id uuid primary key,nome_academia text,telefone text);
create table public.alunos(id uuid primary key,user_id uuid,academia_id uuid,status text);
insert into auth.users(id,email) values ('${admin}','admin@test.com'),('${gym}','gym@test.com'),('${other}','other@test.com');
insert into gestao_configuracoes values('${gym}','Academia Teste','54999999999');
insert into alunos values(gen_random_uuid(),'${gym}','${gym}','Ativo'),(gen_random_uuid(),'${other}','${other}','Inativo');`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261014_painel_administrativo.sql',import.meta.url),'utf8'));
// Also test safe re-application.
await db.exec(readFileSync(new URL('../supabase/migrations/20261014_painel_administrativo.sql',import.meta.url),'utf8'));
await db.exec(`insert into saas_administradores(user_id) values('${admin}');`);
async function role(r,id='') { await db.exec(`reset role; set role ${r}; select set_config('request.jwt.claim.sub','${id}',false);`); }
async function denied(sql) { await assert.rejects(db.query(sql),/permission denied|Acesso exclusivo/); }
await role('anon'); await denied('select public.saas_painel()'); await denied('select * from public.saas_administradores');
await role('authenticated',gym);
assert.equal((await db.query('select public.saas_eh_admin() as admin')).rows[0].admin,false);
await denied('select public.saas_painel()'); await denied('select * from public.saas_assinaturas');
await denied(`select public.saas_salvar_assinatura('${gym}','hack','','','Mensal',1,'ativa','2026-11-10','')`);
await denied(`insert into public.saas_administradores(user_id) values('${gym}')`);
await role('authenticated',admin);
const panel=(await db.query('select public.saas_painel() as painel')).rows[0].painel;
assert.equal(panel.academias.length,2); assert.equal(panel.academias.find(a=>a.user_id===gym).alunos,1);
assert.equal(panel.academias.find(a=>a.user_id===gym).nome,'Academia Teste');
assert.equal(panel.academias.find(a=>a.user_id===other).alunos_ativos,0);
await db.query(`select public.saas_salvar_assinatura('${gym}','Academia Teste','Ana','54999999999','Mensal',99.90,'ativa','2026-11-10','')`);
const pay=(id,month,next='2026-12-10')=>`select public.saas_registrar_pagamento('${id}','${gym}','${month}',99.90,'2026-01-10','Pix','${next}','')`;
const id='10000000-0000-0000-0000-000000000001';
await db.query(pay(id,'2026-11-01')); await db.query(pay(id,'2026-11-01'));
assert.equal((await db.query('select public.saas_painel() as painel')).rows[0].painel.pagamentos.length,1);
await assert.rejects(db.query(pay('10000000-0000-0000-0000-000000000002','2026-11-01','2027-01-10')),/Já existe pagamento/);
await assert.rejects(db.query(pay('10000000-0000-0000-0000-000000000003','2026-12-01','2026-11-10')),/próximo vencimento/);
const after=(await db.query('select public.saas_painel() as painel')).rows[0].painel;
assert.equal(after.academias.find(a=>a.user_id===gym).vencimento,'2026-12-10');
assert.equal(after.pagamentos.length,1);
await role('authenticated',other); await denied('select public.saas_painel()');
console.log('PASS: anonymous access, tenant isolation, privilege escalation, aggregate metrics, migration reapplication, payment idempotency, duplicate competence and rollback.');
await db.close();
