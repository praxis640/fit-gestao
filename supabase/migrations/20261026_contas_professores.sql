-- Contas de professores, portal operacional e bloqueio financeiro no banco.
begin;

create table if not exists public.gestao_professores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  email text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (owner_id, email)
);

create index if not exists gestao_professores_conta
  on public.gestao_professores (owner_id, ativo, nome);

alter table public.gestao_professores enable row level security;
revoke all on public.gestao_professores from public, anon, authenticated;
grant select on public.gestao_professores to authenticated;

drop policy if exists gestao_professores_owner_read on public.gestao_professores;
create policy gestao_professores_owner_read on public.gestao_professores
  for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.fitgestao_eh_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.gestao_professores professor
    where professor.auth_user_id = (select auth.uid())
  );
$function$;

create or replace function public.fitgestao_dono_academia()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when exists (
      select 1 from public.gestao_professores professor
      where professor.auth_user_id = (select auth.uid())
    ) then (
      select professor.owner_id from public.gestao_professores professor
      where professor.auth_user_id = (select auth.uid()) and professor.ativo
      limit 1
    )
    else (select auth.uid())
  end;
$function$;

create or replace function public.fitgestao_aluno_da_conta(p_aluno_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.alunos aluno
    where aluno.id = p_aluno_id
      and p_owner_id = (select public.fitgestao_dono_academia())
      and (aluno.user_id = p_owner_id or aluno.academia_id = p_owner_id)
  );
$function$;

revoke all on function public.fitgestao_eh_professor() from public, anon;
revoke all on function public.fitgestao_dono_academia() from public, anon;
revoke all on function public.fitgestao_aluno_da_conta(uuid, uuid) from public, anon;
grant execute on function public.fitgestao_eh_professor() to authenticated;
grant execute on function public.fitgestao_dono_academia() to authenticated;
grant execute on function public.fitgestao_aluno_da_conta(uuid, uuid) to authenticated;

-- Professores não consultam a tabela completa de alunos; recebem apenas campos operacionais pelo RPC.
alter table public.alunos enable row level security;
grant select, insert, update, delete on public.alunos to authenticated;
drop policy if exists fitgestao_alunos_owner_access on public.alunos;
create policy fitgestao_alunos_owner_access on public.alunos
  for all to authenticated
  using (user_id = (select auth.uid()) or academia_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) or academia_id = (select auth.uid()));
drop policy if exists fitgestao_alunos_owner_guard on public.alunos;
create policy fitgestao_alunos_owner_guard on public.alunos as restrictive
  for all to authenticated
  using (not (select public.fitgestao_eh_professor()) and (user_id = (select auth.uid()) or academia_id = (select auth.uid())))
  with check (not (select public.fitgestao_eh_professor()) and (user_id = (select auth.uid()) or academia_id = (select auth.uid())));

create or replace function public.professor_listar_alunos()
returns table (
  id uuid,
  nome text,
  status text,
  plano_nome text,
  graduacao text,
  total_presencas bigint,
  presencas_mes bigint,
  ultima_presenca date
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_inicio_mes date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  select professor.owner_id into v_owner
  from public.gestao_professores professor
  where professor.auth_user_id = (select auth.uid()) and professor.ativo;
  if v_owner is null then raise exception 'Conta de professor inativa ou não vinculada'; end if;

  return query
    select aluno.id, aluno.nome, aluno.status, aluno.plano_nome, aluno.graduacao,
      count(frequencia.id),
      count(frequencia.id) filter (where frequencia.data >= v_inicio_mes),
      max(frequencia.data)
    from public.alunos aluno
    left join public.frequencias frequencia
      on frequencia.aluno_id = aluno.id and frequencia.user_id = v_owner
    where aluno.user_id = v_owner or aluno.academia_id = v_owner
    group by aluno.id, aluno.nome, aluno.status, aluno.plano_nome, aluno.graduacao
    order by aluno.nome;
end;
$function$;

create or replace function public.professor_registrar_presenca(p_aluno_id uuid, p_data date default current_date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
begin
  select professor.owner_id into v_owner
  from public.gestao_professores professor
  where professor.auth_user_id = (select auth.uid()) and professor.ativo;
  if v_owner is null then raise exception 'Conta de professor inativa ou não vinculada'; end if;
  if p_data is null or p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A presença precisa ter uma data válida, até hoje';
  end if;
  if not public.fitgestao_aluno_da_conta(p_aluno_id, v_owner) then
    raise exception 'Aluno não encontrado nesta academia';
  end if;
  if exists (select 1 from public.frequencias f where f.user_id = v_owner and f.aluno_id = p_aluno_id and f.data = p_data) then
    raise exception 'Já existe uma presença desse aluno nessa data';
  end if;
  insert into public.frequencias (user_id, aluno_id, data)
  values (v_owner, p_aluno_id, p_data);
  return true;
end;
$function$;

revoke all on function public.professor_listar_alunos() from public, anon;
revoke all on function public.professor_registrar_presenca(uuid, date) from public, anon;
grant execute on function public.professor_listar_alunos() to authenticated;
grant execute on function public.professor_registrar_presenca(uuid, date) to authenticated;

-- O acesso direto a presença e plano continua exclusivo do dono; o portal usa RPC validado.
alter table public.frequencias enable row level security;
grant select, insert, update, delete on public.frequencias to authenticated;
drop policy if exists fitgestao_frequencias_owner_access on public.frequencias;
create policy fitgestao_frequencias_owner_access on public.frequencias
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists fitgestao_frequencias_owner_guard on public.frequencias;
create policy fitgestao_frequencias_owner_guard on public.frequencias as restrictive
  for all to authenticated
  using (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid()))
  with check (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid()));

alter table public.planos enable row level security;
grant select, insert, update, delete on public.planos to authenticated;
drop policy if exists fitgestao_planos_owner_access on public.planos;
create policy fitgestao_planos_owner_access on public.planos
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists fitgestao_planos_owner_guard on public.planos;
create policy fitgestao_planos_owner_guard on public.planos as restrictive
  for all to authenticated
  using (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid()))
  with check (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid()));

-- Professores só gerenciam exercícios, treinos e nutrição; vendas e seus valores ficam bloqueados.
drop policy if exists gestao_registros_owner_guard on public.gestao_registros;
create policy gestao_registros_owner_guard on public.gestao_registros as restrictive
  for all to authenticated
  using (
    user_id = (select public.fitgestao_dono_academia())
    and (not (select public.fitgestao_eh_professor()) or (tipo in ('exercicio','treino','nutricao') and valor is null))
    and (aluno_id is null or public.fitgestao_aluno_da_conta(aluno_id, (select public.fitgestao_dono_academia())))
  )
  with check (
    user_id = (select public.fitgestao_dono_academia())
    and (not (select public.fitgestao_eh_professor()) or (tipo in ('exercicio','treino','nutricao') and valor is null))
    and (aluno_id is null or public.fitgestao_aluno_da_conta(aluno_id, (select public.fitgestao_dono_academia())))
  );

-- Registros financeiros sempre exigem uma sessão do próprio dono, nunca uma conta de professor.
do $block$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['pagamentos','gestao_lancamentos_financeiros','gestao_vendas','gestao_produtos','gestao_cobrancas','gestao_unidades'] loop
    if to_regclass(format('public.%I', v_tabela)) is not null then
      execute format('alter table public.%I enable row level security', v_tabela);
      execute format('drop policy if exists fitgestao_owner_access on public.%I', v_tabela);
      execute format('create policy fitgestao_owner_access on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', v_tabela);
      execute format('drop policy if exists fitgestao_owner_guard on public.%I', v_tabela);
      execute format('create policy fitgestao_owner_guard on public.%I as restrictive for all to authenticated using (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid())) with check (not (select public.fitgestao_eh_professor()) and user_id = (select auth.uid()))', v_tabela);
    end if;
  end loop;
end;
$block$;

-- Força a API do Supabase a atualizar a lista de tabelas e funções expostas.
notify pgrst, 'reload schema';
commit;

select to_regclass('public.gestao_professores') is not null as contas_professores_prontas,
       to_regprocedure('public.professor_listar_alunos()') is not null as portal_professor_pronto;
