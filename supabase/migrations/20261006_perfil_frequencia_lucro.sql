-- Perfil do aluno, upload privado de fotos e custo real das vendas.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
begin;

-- Repara uma instalação em que a migração antiga de vendas foi colada pela metade.
create table if not exists public.gestao_produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  categoria text not null default '',
  preco numeric(12, 2) not null check (preco > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.gestao_vendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  produto_id uuid references public.gestao_produtos(id) on delete set null,
  produto_nome text not null,
  categoria text not null default '',
  aluno_id uuid references public.alunos(id) on delete set null,
  aluno_nome text not null,
  valor_unitario numeric(12, 2) not null check (valor_unitario > 0),
  quantidade integer not null check (quantidade between 1 and 10000),
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data_venda date not null default (now() at time zone 'America/Sao_Paulo')::date,
  criado_em timestamptz not null default now(),
  constraint gestao_vendas_total_correto check (valor_total = valor_unitario * quantidade)
);

create index if not exists gestao_produtos_conta_ativos on public.gestao_produtos (user_id, ativo, nome);
create index if not exists gestao_vendas_conta_data on public.gestao_vendas (user_id, data_venda desc);
create index if not exists gestao_vendas_conta_aluno on public.gestao_vendas (user_id, aluno_id, data_venda desc);

alter table public.alunos
  add column if not exists observacoes text not null default '',
  add column if not exists foto_storage_path text;

alter table public.gestao_produtos
  add column if not exists custo numeric(12, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gestao_produtos_custo_nao_negativo'
      and conrelid = 'public.gestao_produtos'::regclass
  ) then
    alter table public.gestao_produtos
      add constraint gestao_produtos_custo_nao_negativo check (custo is null or custo >= 0);
  end if;
end;
$$;

alter table public.gestao_vendas
  add column if not exists custo_unitario numeric(12, 2);

alter table public.gestao_produtos enable row level security;
alter table public.gestao_vendas enable row level security;
revoke all on public.gestao_produtos, public.gestao_vendas from public, anon, authenticated;
grant select, insert, update, delete on public.gestao_produtos to authenticated;
grant select, insert on public.gestao_vendas to authenticated;

drop policy if exists gestao_produtos_owner on public.gestao_produtos;
create policy gestao_produtos_owner on public.gestao_produtos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists gestao_vendas_owner_read on public.gestao_vendas;
create policy gestao_vendas_owner_read on public.gestao_vendas
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists gestao_vendas_owner_insert on public.gestao_vendas;
create policy gestao_vendas_owner_insert on public.gestao_vendas
  for insert to authenticated
  with check (user_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gestao_vendas_custo_nao_negativo'
      and conrelid = 'public.gestao_vendas'::regclass
  ) then
    alter table public.gestao_vendas
      add constraint gestao_vendas_custo_nao_negativo check (custo_unitario is null or custo_unitario >= 0);
  end if;
end;
$$;

alter table public.alunos enable row level security;
grant update (observacoes, foto_storage_path) on public.alunos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fitgestao-alunos', 'fitgestao-alunos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists fitgestao_alunos_read_own on storage.objects;
create policy fitgestao_alunos_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fitgestao-alunos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists fitgestao_alunos_insert_own on storage.objects;
create policy fitgestao_alunos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fitgestao-alunos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists fitgestao_alunos_update_own on storage.objects;
create policy fitgestao_alunos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fitgestao-alunos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'fitgestao-alunos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists fitgestao_alunos_delete_own on storage.objects;
create policy fitgestao_alunos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fitgestao-alunos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
