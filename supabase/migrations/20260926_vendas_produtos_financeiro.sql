-- Produtos cadastrados e vendas com aluno, integradas ao financeiro.
begin;

do $$
begin
  if to_regclass('public.alunos') is null or to_regclass('public.gestao_registros') is null then
    raise exception 'Execute antes as migrações de alunos e módulos operacionais';
  end if;
end;
$$;

create table if not exists public.gestao_produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  categoria text not null default '',
  preco numeric(12, 2) not null check (preco > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists gestao_produtos_conta_ativos
  on public.gestao_produtos (user_id, ativo, nome);

create table if not exists public.gestao_vendas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  produto_id uuid references public.gestao_produtos(id) on delete set null,
  produto_nome text not null check (length(btrim(produto_nome)) > 0),
  categoria text not null default '',
  aluno_id uuid references public.alunos(id) on delete set null,
  aluno_nome text not null,
  valor_unitario numeric(12, 2) not null check (valor_unitario > 0),
  quantidade integer not null check (quantidade between 1 and 10000),
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data_venda date not null default (now() at time zone 'America/Sao_Paulo')::date,
  origem_registro uuid unique references public.gestao_registros(id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint gestao_vendas_total_correto check (valor_total = valor_unitario * quantidade)
);

create index if not exists gestao_vendas_conta_data
  on public.gestao_vendas (user_id, data_venda desc);
create index if not exists gestao_vendas_conta_aluno
  on public.gestao_vendas (user_id, aluno_id, data_venda desc);

alter table public.gestao_produtos enable row level security;
alter table public.gestao_vendas enable row level security;
revoke all on public.gestao_produtos, public.gestao_vendas from public, anon, authenticated;
grant select, insert, update, delete on public.gestao_produtos to authenticated;
grant select on public.gestao_vendas to authenticated;

drop policy if exists gestao_produtos_owner on public.gestao_produtos;
create policy gestao_produtos_owner on public.gestao_produtos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists gestao_vendas_owner_read on public.gestao_vendas;
create policy gestao_vendas_owner_read on public.gestao_vendas
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.registrar_venda(
  p_produto_id uuid,
  p_aluno_id uuid,
  p_quantidade integer,
  p_data_venda date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_nome text;
  v_categoria text;
  v_preco numeric(12, 2);
  v_aluno_nome text;
  v_venda_id uuid;
begin
  if v_usuario is null then
    raise exception 'Autenticação necessária';
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 10000 then
    raise exception 'Informe uma quantidade entre 1 e 10000';
  end if;

  select produto.nome, produto.categoria, produto.preco
  into v_nome, v_categoria, v_preco
  from public.gestao_produtos produto
  where produto.id = p_produto_id
    and produto.user_id = v_usuario
    and produto.ativo