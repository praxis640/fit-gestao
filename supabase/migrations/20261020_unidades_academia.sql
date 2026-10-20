-- Unidades por conta, com alunos existentes associados à unidade principal.
begin;

create table if not exists public.gestao_unidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 100),
  endereco text not null default '',
  telefone text not null default '',
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint gestao_unidades_nome_conta unique (user_id, nome)
);

create index if not exists gestao_unidades_conta_ativas
  on public.gestao_unidades (user_id, ativa, nome);

alter table public.gestao_unidades enable row level security;
revoke all on public.gestao_unidades from public, anon, authenticated;
grant select, insert, update, delete on public.gestao_unidades to authenticated;

drop policy if exists gestao_unidades_owner on public.gestao_unidades;
create policy gestao_unidades_owner on public.gestao_unidades
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.alunos
  add column if not exists unidade_id uuid
  references public.gestao_unidades(id) on delete set null;

create index if not exists alunos_unidade_id on public.alunos (unidade_id);

create or replace function public.validar_unidade_do_aluno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dono_unidade uuid;
  v_dono_aluno uuid;
begin
  if new.unidade_id is null then
    return new;
  end if;
  v_dono_aluno := coalesce(new.user_id, new.academia_id);
  select unidade.user_id into v_dono_unidade
  from public.gestao_unidades as unidade
  where unidade.id = new.unidade_id;
  if v_dono_unidade is null or v_dono_aluno is distinct from v_dono_unidade then
    raise exception 'A unidade selecionada não pertence à conta deste aluno';
  end if;
  return new;
end;
$function$;

drop trigger if exists alunos_validar_unidade on public.alunos;
create trigger alunos_validar_unidade
  before insert or update of unidade_id, user_id, academia_id on public.alunos
  for each row execute function public.validar_unidade_do_aluno();

insert into public.gestao_unidades (user_id, nome)
select id, 'Unidade principal' from auth.users
on conflict (user_id, nome) do nothing;

update public.alunos as aluno
set unidade_id = unidade.id
from public.gestao_unidades as unidade
where aluno.unidade_id is null
  and unidade.nome = 'Unidade principal'
  and unidade.user_id = coalesce(aluno.user_id, aluno.academia_id);

commit;
