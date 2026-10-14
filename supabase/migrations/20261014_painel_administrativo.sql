-- Execute inteiro no SQL Editor do projeto Supabase do ProGestFit.
begin;
create table if not exists public.saas_administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists public.saas_assinaturas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  responsavel text not null default '',
  telefone text not null default '',
  plano text not null default 'Mensal',
  valor numeric(12,2) not null default 0 check (valor >= 0),
  status text not null default 'teste' check (status in ('teste','ativa','pausada','cancelada')),
  vencimento date,
  observacoes text not null default '',
  atualizado_em timestamptz not null default now()
);
create table if not exists public.saas_pagamentos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  valor numeric(12,2) not null check (valor > 0),
  pago_em date not null,
  forma text not null check (forma in ('Pix','Cartão','Boleto','Dinheiro','Transferência')),
  observacoes text not null default '',
  registrado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  unique(user_id, competencia)
);
create index if not exists saas_pagamentos_data on public.saas_pagamentos(pago_em);
alter table public.saas_administradores enable row level security;
alter table public.saas_assinaturas enable row level security;
alter table public.saas_pagamentos enable row level security;
-- Sem acesso direto: somente funções verificadas abaixo.
revoke all on public.saas_administradores, public.saas_assinaturas, public.saas_pagamentos from public, anon, authenticated;

create or replace function public.saas_eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.saas_administradores where user_id = auth.uid());
$$;

create or replace function public.saas_painel() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.saas_eh_admin() then raise exception 'Acesso exclusivo do administrador' using errcode = '42501'; end if;
  return jsonb_build_object(
    'academias', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.cadastrado_em desc) from (
        select u.id as user_id, u.email, u.created_at as cadastrado_em, u.last_sign_in_at as ultimo_login,
          coalesce(nullif(s.nome,''), nullif(c.nome_academia,''), split_part(u.email,'@',1), 'Academia') as nome,
          coalesce(s.responsavel,'') as responsavel, coalesce(nullif(s.telefone,''),c.telefone,'') as telefone,
          coalesce(s.plano,'Mensal') as plano, coalesce(s.valor,0) as valor,
          coalesce(s.status,'teste') as status, s.vencimento, coalesce(s.observacoes,'') as observacoes,
          coalesce(a.total,0) as alunos, coalesce(a.ativos,0) as alunos_ativos
        from auth.users u
        left join public.saas_assinaturas s on s.user_id=u.id
        left join public.gestao_configuracoes c on c.user_id=u.id
        left join (
          select coalesce(user_id, academia_id) as dono, count(*) as total,
            count(*) filter (where lower(status)='ativo') as ativos
          from public.alunos group by coalesce(user_id, academia_id)
        ) a on a.dono=u.id
        where not exists(select 1 from public.saas_administradores adm where adm.user_id=u.id)
      ) t
    ),'[]'::jsonb),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(p) order by p.pago_em desc, p.criado_em desc) from public.saas_pagamentos p),'[]'::jsonb)
  );
end;
$$;

create or replace function public.saas_salvar_assinatura(
  p_user_id uuid, p_nome text, p_responsavel text, p_telefone text,
  p_plano text, p_valor numeric, p_status text, p_vencimento date, p_observacoes text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.saas_eh_admin() then raise exception 'Acesso exclusivo do administrador' using errcode = '42501'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) or exists(select 1 from public.saas_administradores where user_id=p_user_id) then
    raise exception 'Conta de academia inválida';
  end if;
  if p_nome is null or length(btrim(p_nome))=0 or length(p_nome)>160
    or p_plano is null or length(btrim(p_plano))=0 or length(p_plano)>80
    or p_valor is null or p_valor<0 or p_status is null or p_status not in ('teste','ativa','pausada','cancelada') then
    raise exception 'Revise nome, plano, valor e status';
  end if;
  insert into public.saas_assinaturas(user_id,nome,responsavel,telefone,plano,valor,status,vencimento,observacoes)
  values(p_user_id,btrim(p_nome),coalesce(p_responsavel,''),coalesce(p_telefone,''),btrim(p_plano),p_valor,p_status,p_vencimento,coalesce(p_observacoes,''))
  on conflict(user_id) do update set nome=excluded.nome, responsavel=excluded.responsavel,
    telefone=excluded.telefone, plano=excluded.plano, valor=excluded.valor,
    status=excluded.status, vencimento=excluded.vencimento, observacoes=excluded.observacoes, atualizado_em=now();
end;
$$;

create or replace function public.saas_registrar_pagamento(
  p_id uuid, p_user_id uuid, p_competencia date, p_valor numeric,
  p_pago_em date, p_forma text, p_proximo_vencimento date, p_observacoes text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_assinatura public.saas_assinaturas%rowtype; v_existente public.saas_pagamentos%rowtype;
begin
  if not public.saas_eh_admin() then raise exception 'Acesso exclusivo do administrador' using errcode = '42501'; end if;
  select * into v_assinatura from public.saas_assinaturas where user_id=p_user_id for update;
  if not found then raise exception 'Salve a assinatura antes de registrar o pagamento'; end if;
  select * into v_existente from public.saas_pagamentos where id=p_id;
  if found then
    if v_existente.user_id=p_user_id and v_existente.competencia=p_competencia and v_existente.valor=p_valor
      and v_existente.pago_em=p_pago_em and v_existente.forma=p_forma then return; end if;
    raise exception 'Identificador de pagamento já utilizado';
  end if;
  if p_id is null or p_valor is null or p_valor<=0 or p_competencia is null or extract(day from p_competencia)<>1
    or p_pago_em is null or p_pago_em > (now() at time zone 'America/Sao_Paulo')::date
    or p_proximo_vencimento is null or p_proximo_vencimento<=p_pago_em
    or (v_assinatura.vencimento is not null and p_proximo_vencimento<=v_assinatura.vencimento)
    or p_forma is null or p_forma not in ('Pix','Cartão','Boleto','Dinheiro','Transferência') then
    raise exception 'Revise os dados: o próximo vencimento deve avançar o prazo atual e ser posterior ao pagamento';
  end if;
  if exists(select 1 from public.saas_pagamentos where user_id=p_user_id and competencia=p_competencia) then
    raise exception 'Já existe pagamento para esta academia e competência';
  end if;
  insert into public.saas_pagamentos(id,user_id,competencia,valor,pago_em,forma,observacoes,registrado_por)
  values(p_id,p_user_id,p_competencia,p_valor,p_pago_em,p_forma,coalesce(p_observacoes,''),auth.uid());
  update public.saas_assinaturas set vencimento=p_proximo_vencimento, status='ativa', atualizado_em=now() where user_id=p_user_id;
end;
$$;
revoke all on function public.saas_eh_admin() from public, anon, authenticated;
revoke all on function public.saas_painel() from public, anon, authenticated;
revoke all on function public.saas_salvar_assinatura(uuid,text,text,text,text,numeric,text,date,text) from public, anon, authenticated;
revoke all on function public.saas_registrar_pagamento(uuid,uuid,date,numeric,date,text,date,text) from public, anon, authenticated;
grant execute on function public.saas_eh_admin(), public.saas_painel(),
  public.saas_salvar_assinatura(uuid,text,text,text,text,numeric,text,date,text),
  public.saas_registrar_pagamento(uuid,uuid,date,numeric,date,text,date,text) to authenticated;
commit;
select true as painel_instalado;
