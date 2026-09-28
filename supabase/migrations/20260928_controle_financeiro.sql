-- Lançamentos manuais de receitas e despesas para o controle financeiro.
begin;

create table if not exists public.gestao_lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null check (length(btrim(descricao)) between 1 and 140),
  categoria text not null default 'Outros' check (length(btrim(categoria)) between 1 and 80),
  valor numeric(12, 2) not null check (valor > 0),
  vencimento date not null,
  data_pagamento date,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  forma_pagamento text not null default 'Pix',
  aluno_id uuid references public.alunos(id) on delete set null,
  observacoes text not null default '' check (length(observacoes) <= 500),
  criado_em timestamptz not null default now(),
  constraint gestao_lancamentos_data_pagamento_check
    check (status <> 'pago' or data_pagamento is not null)
);

create index if not exists gestao_lancamentos_financeiros_user_vencimento
  on public.gestao_lancamentos_financeiros (user_id, vencimento desc);
create index if not exists gestao_lancamentos_financeiros_user_status
  on public.gestao_lancamentos_financeiros (user_id, status, tipo);

alter table public.gestao_lancamentos_financeiros enable row level security;
revoke all on public.gestao_lancamentos_financeiros from public, anon, authenticated;
grant select, insert, update, delete on public.gestao_lancamentos_financeiros to authenticated;

drop policy if exists gestao_lancamentos_financeiros_owner on public.gestao_lancamentos_financeiros;
create policy gestao_lancamentos_financeiros_owner
  on public.gestao_lancamentos_financeiros
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists gestao_lancamentos_financeiros_aluno_guard on public.gestao_lancamentos_financeiros;
create policy gestao_lancamentos_financeiros_aluno_guard
  on public.gestao_lancamentos_financeiros as restrictive
  for all to authenticated
  using (
    user_id = (select auth.uid()) and (
      aluno_id is null or exists (
        select 1 from public.alunos a
        where a.id = gestao_lancamentos_financeiros.aluno_id
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
        where a.id = gestao_lancamentos_financeiros.aluno_id
          and (a.user_id is not null or a.academia_id is not null)
          and (a.user_id is null or a.user_id = (select auth.uid()))
          and (a.academia_id is null or a.academia_id = (select auth.uid()))
      )
    )
  );

commit;

select to_regclass('public.gestao_lancamentos_financeiros') is not null as controle_financeiro_pronto;
