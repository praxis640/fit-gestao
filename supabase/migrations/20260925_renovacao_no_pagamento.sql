-- Execute no SQL Editor depois de 20260924_ciclos_mensais_e_renovacoes.sql.
-- A baixa passa a renovar um plano expirado na mesma transacao do pagamento.
begin;

do $$
begin
  if to_regprocedure('public.registrar_pagamento(uuid)') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'alunos' and column_name = 'fim_plano') then
    raise exception 'Execute antes 20260924_ciclos_mensais_e_renovacoes.sql';
  end if;
end;
$$;

create or replace function public.registrar_pagamento(p_aluno_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := (select auth.uid());
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_competencia date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_valor numeric;
  v_fim date;
  v_plano_nome text;
  v_duracao integer;
  v_pagou_antes boolean;
begin
  if v_usuario is null then
    raise exception 'Autenticação necessária';
  end if;

  -- Bloqueia o aluno ate concluir pagamento e renovacao, inclusive em chamadas simultaneas.
  select a.valor_mensalidade, a.fim_plano, a.plano_nome
  into v_valor, v_fim, v_plano_nome
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

  update public.alunos a
  set status_pagamento = 'Em Dia',
      fim_plano = case
        when v_fim is null or v_fim <= v_hoje then v_hoje + v_duracao
        when v_pagou_antes and v_fim <= v_hoje + 7 then v_fim + v_duracao
        else v_fim
      end
  where a.id = p_aluno_id;
end;
$$;
revoke all on function public.registrar_pagamento(uuid) from public, anon;
grant execute on function public.registrar_pagamento(uuid) to authenticated;

-- Corrige somente planos ja vencidos com pagamento registrado neste mes.
-- Usa a data real do pagamento e preserva historico e planos ainda vigentes.
update public.alunos a
set fim_plano = greatest(
  coalesce(a.fim_plano, (p.pago_em at time zone 'America/Sao_Paulo')::date),
  (p.pago_em at time zone 'America/Sao_Paulo')::date
) + coalesce(d.duracao_dias, 30),
    status_pagamento = 'Em Dia'
from public.pagamentos p
left join lateral (
  select pl.duracao_dias
  from public.planos pl
  where pl.user_id = p.user_id and pl.duracao_dias > 0
    and pl.nome = (select a2.plano_nome from public.alunos a2 where a2.id::text = p.aluno_id)
  order by pl.criado_em desc nulls last
  limit 1
) d on true
where a.id::text = p.aluno_id
  and p.competencia = date_trunc('month', now() at time zone 'America/Sao_Paulo')::date
  and (a.user_id = p.user_id or a.academia_id = p.user_id)
  and (a.user_id is null or a.user_id = p.user_id)
  and (a.academia_id is null or a.academia_id = p.user_id)
  and (a.fim_plano is null or a.fim_plano <= (now() at time zone 'America/Sao_Paulo')::date);

commit;

select to_regprocedure('public.registrar_pagamento(uuid)') is not null as renovacao_ativa;
