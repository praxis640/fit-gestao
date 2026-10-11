-- Próximo vencimento mensal separado da validade do plano.
-- Execute no SQL Editor do Supabase após as migrações existentes de alunos e pagamentos.
begin;

alter table public.alunos
  add column if not exists proximo_vencimento date;

-- Remove a versão antiga para que o PostgREST não encontre duas RPCs homônimas.
drop function if exists public.registrar_pagamento(text);

create or replace function public.registrar_pagamento(p_aluno_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_competencia date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_valor numeric;
  v_fim date;
  v_proximo_vencimento date;
  v_dia_vencimento integer;
  v_plano_nome text;
  v_duracao integer;
  v_pagou_antes boolean;
  v_novo_proximo_vencimento date;
begin
  if v_usuario is null then
    raise exception 'Autenticação necessária';
  end if;

  select a.valor_mensalidade, a.fim_plano, a.proximo_vencimento,
         a.dia_vencimento, a.plano_nome
  into v_valor, v_fim, v_proximo_vencimento, v_dia_vencimento, v_plano_nome
  from public.alunos a
  where a.id = p_aluno_id
    and (a.user_id is not null or a.academia_id is not null)
    and (a.user_id is null or a.user_id = v_usuario)
    and (a.academia_id is null or a.academia_id = v_usuario)
  for update;

  if not found then
    raise exception 'Aluno indisponível para esta conta';
  end if;
  if v_valor is null or v_valor <= 0 then
    raise exception 'Informe um valor mensal positivo antes de registrar o pagamento';
  end if;

  select p.duracao_dias into v_duracao
  from public.planos p
  where p.user_id = v_usuario and p.nome = v_plano_nome and p.duracao_dias > 0
  order by p.criado_em desc nulls last
  limit 1;
  v_duracao := coalesce(v_duracao, 30);

  select exists (
    select 1 from public.pagamentos p
    where p.user_id = v_usuario and p.aluno_id = p_aluno_id::text
  ) into v_pagou_antes;

  insert into public.pagamentos (user_id, aluno_id, valor, competencia)
  values (v_usuario, p_aluno_id::text, v_valor, v_competencia)
  on conflict (user_id, aluno_id, competencia) do nothing;
  if not found then
    raise exception 'Pagamento já registrado para este aluno neste mês';
  end if;

  if v_proximo_vencimento is not null and v_proximo_vencimento >= v_hoje then
    v_novo_proximo_vencimento := (
      date_trunc('month', v_proximo_vencimento + interval '1 month')
      + make_interval(days => least(
          extract(day from v_proximo_vencimento)::integer,
          extract(day from (date_trunc('month', v_proximo_vencimento + interval '2 months') - interval '1 day'))::integer
        ) - 1)
    )::date;
  else
    v_novo_proximo_vencimento := (
      date_trunc('month', v_hoje + interval '1 month')
      + make_interval(days => least(
          coalesce(v_dia_vencimento, extract(day from v_hoje)::integer),
          extract(day from (date_trunc('month', v_hoje + interval '2 months') - interval '1 day'))::integer
        ) - 1)
    )::date;
  end if;

  update public.alunos a
  set status_pagamento = 'Em Dia',
      fim_plano = case
        when v_fim is null or v_fim <= v_hoje then v_hoje + v_duracao
        when v_pagou_antes and v_fim <= v_hoje + 7 then v_fim + v_duracao
        else v_fim
      end,
      proximo_vencimento = v_novo_proximo_vencimento
  where a.id = p_aluno_id;
end;
$$;

revoke all on function public.registrar_pagamento(uuid) from public, anon;
grant execute on function public.registrar_pagamento(uuid) to authenticated;

commit;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'alunos'
    and column_name = 'proximo_vencimento' and data_type = 'date'
) as coluna_proximo_vencimento_criada;
