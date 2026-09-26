-- Execute uma vez no SQL Editor do mesmo projeto Supabase do aplicativo.
-- Os dados antigos de alunos, pagamentos, planos e presenças não são alterados.
begin;

do $$
begin
  if to_regclass('public.alunos') is null then
    raise exception 'A tabela public.alunos precisa existir antes dos novos módulos';
  end if;
end;
$$;

create table if not exists public.gestao_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('exercicio', 'treino', 'nutricao', 'venda')),
  titulo text not null check (length(btrim(titulo)) > 0),
  categoria text not null default '',
  detalhes text not null default '',
  aluno_id uuid references public.alunos(id) on delete set null,
  valor numeric(12, 2),
  quantidade integer not null default 1 check (quantidade > 0),
  data_registro date not null default current_date,
  criado_em timestamptz not null default now(),
  constraint vendas_com_valor check (tipo <> 'venda' or (valor is not null and valor > 0)),
  constraint somente_vinculos_validos check (aluno_id is null or tipo in ('treino', 'nutricao', 'venda'))
);

create index if not exists gestao_registros_conta_tipo_data
  on public.gestao_registros (user_id, tipo, criado_em desc);
create index if not exists gestao_registros_aluno
  on public.gestao_registros (aluno_id) where aluno_id is not null;

alter table public.gestao_registros enable row level security;
revoke all on public.gestao_registros from public, anon, authenticated;
grant select, insert, update, delete on public.gestao_registros to authenticated;

drop policy if exists gestao_registros_access on public.gestao_registros;
create policy gestao_registros_access on public.gestao_registros
  for all to authenticated using (true) with check (true);

drop policy if exists gestao_registros_owner_guard on public.gestao_registros;
create policy gestao_registros_owner_guard on public.gestao_registros as restrictive
  for all to authenticated
  using (
    user_id = (select auth.uid()) and (
      aluno_id is null or exists (
        select 1 from public.alunos a
        where a.id = gestao_registros.aluno_id
          and (a.user_id is not null or a.academia_id is not null)
          and (a.user_id is null or a.user_id = (select auth.uid()))
          and (a.academia_id is null or a.academia_id = (select auth.uid()))
      )
    )
  )
  with check (
    user_id = (select auth.uid()) and (
      aluno_id is null or exists (
        select 1 from public.alunos a
        where a.id = gestao_registros.aluno_id
          and (a.user_id is not null or a.academia_id is not null)
          and (a.user_id is null or a.user_id = (select auth.uid()))
          and (a.academia_id is null or a.academia_id = (select auth.uid()))
      )
    )
  );

create table if not exists public.gestao_configuracoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_academia text not null check (length(btrim(nome_academia)) > 0),
  telefone text not null default '',
  observacoes text not null default '',
  atualizado_em timestamptz not null default now()
);

alter table public.gestao_configuracoes enable row level security;
revoke all on public.gestao_configuracoes from public, anon, authenticated;
grant select, insert, update on public.gestao_configuracoes to authenticated;

drop policy if exists gestao_configuracoes_access on public.gestao_configuracoes;
create policy gestao_configuracoes_access on public.gestao_configuracoes
  for all to authenticated using (true) with check (true);

drop policy if exists gestao_configuracoes_owner_guard on public.gestao_configuracoes;
create policy gestao_configuracoes_owner_guard on public.gestao_configuracoes as restrictive
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;

select
  to_regclass('public.gestao_registros') is not null as modulos_criados,
  to_regclass('public.gestao_configuracoes') is not null as configuracoes_criadas,
  (select relrowsecurity from pg_class where oid = to_regclass('public.gestao_registros'))
    and (select relrowsecurity from pg_class where oid = to_regclass('public.gestao_configuracoes'))
    as isolamento_ativado;
