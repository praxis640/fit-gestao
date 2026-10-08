-- Cobranças de mensalidades por Asaas, com confirmação somente por webhook.
begin;

create table if not exists public.gestao_cobrancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  competencia date not null,
  vencimento date not null,
  provedor text not null default 'asaas',
  ambiente_provedor text not null default 'sandbox' check (ambiente_provedor in ('sandbox','production')),
  status text not null default 'processando'
    check (status in ('processando','pendente','recebido','atrasado','cancelado','estornado','falha')),
  cliente_provedor_id text,
  pagamento_provedor_id text unique,
  url_fatura text,
  codigo_pix text,
  evento_webhook_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, aluno_id, competencia)
);

create index if not exists gestao_cobrancas_conta_data
  on public.gestao_cobrancas (user_id, vencimento desc);
create index if not exists gestao_cobrancas_aluno_data
  on public.gestao_cobrancas (user_id, aluno_id, vencimento desc);

alter table public.gestao_cobrancas enable row level security;
revoke all on public.gestao_cobrancas from public, anon;
grant select on public.gestao_cobrancas to authenticated;

drop policy if exists gestao_cobrancas_owner_read on public.gestao_cobrancas;
create policy gestao_cobrancas_owner_read on public.gestao_cobrancas
  for select to authenticated using (user_id = (select auth.uid()));

-- Cria uma cobrança no próprio servidor; evita escrita direta pelo navegador.
revoke all on public.gestao_cobrancas from authenticated;
grant select on public.gestao_cobrancas to authenticated;

create or replace function public.processar_evento_cobranca_asaas(
  p_referencia uuid,
  p_status text,
  p_pagamento_provedor_id text,
  p_evento_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cobranca public.gestao_cobrancas%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_novo_vencimento date;
  v_inseridos integer := 0;
  v_aluno record;
begin
  select * into v_cobranca
  from public.gestao_cobrancas
  where id = p_referencia
    and pagamento_provedor_id = p_pagamento_provedor_id
  for update;

  if not found then return; end if;
  if v_cobranca.status = 'recebido' and p_status <> 'estornado' then return; end if;

  update public.gestao_cobrancas
  set status = p_status,
      evento_webhook_id = coalesce(p_evento_id, evento_webhook_id),
      atualizado_em = now()
  where id = v_cobranca.id;

  if p_status <> 'recebido' then return; end if;

  insert into public.pagamentos (user_id, aluno_id, valor, competencia)
  values (v_cobranca.user_id, v_cobranca.aluno_id::text, v_cobranca.valor, v_cobranca.competencia)
  on conflict (user_id, aluno_id, competencia) do nothing;
  get diagnostics v_inseridos = row_count;
  if v_inseridos = 0 then return; end if;

  select a.valor_mensalidade, a.fim_plano, a.proximo_vencimento,
         a.dia_vencimento, a.plano_nome
  into v_aluno
  from public.alunos a
  where a.id = v_cobranca.aluno_id
    and (a.user_id = v_cobranca.user_id or a.academia_id = v_cobranca.user_id)
  for update;
  if not found then return; end if;

  if v_aluno.proximo_vencimento is not null and v_aluno.proximo_vencimento >= v_hoje then
    v_novo_vencimento := (date_trunc('month', v_aluno.proximo_vencimento + interval '1 month')
      + make_interval(days => least(
        extract(day from v_aluno.proximo_vencimento)::integer,
        extract(day from (date_trunc('month', v_aluno.proximo_vencimento + interval '2 months') - interval '1 day'))::integer
      ) - 1))::date;
  else
    v_novo_vencimento := (date_trunc('month', v_hoje + interval '1 month')
      + make_interval(days => least(
        coalesce(v_aluno.dia_vencimento, extract(day from v_hoje)::integer),
        extract(day from (date_trunc('month', v_hoje + interval '2 months') - interval '1 day'))::integer
      ) - 1))::date;
  end if;

  update public.alunos a
  set status_pagamento = 'Em Dia',
      proximo_vencimento = v_novo_vencimento
  where a.id = v_cobranca.aluno_id;
end;
$$;

revoke all on function public.processar_evento_cobranca_asaas(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.processar_evento_cobranca_asaas(uuid,text,text,text) to service_role;

commit;
