-- Corrige o erro "structure of query does not match function result type".
-- Campos varchar da tabela de alunos precisam retornar text conforme a assinatura da função.
begin;

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
as $professor$
declare
  v_owner uuid;
  v_inicio_mes date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  select professor.owner_id into v_owner
  from public.gestao_professores professor
  where professor.auth_user_id = (select auth.uid()) and professor.ativo;

  if v_owner is null then
    raise exception 'Conta de professor inativa ou não vinculada';
  end if;

  return query
    select aluno.id::uuid, aluno.nome::text, aluno.status::text,
      aluno.plano_nome::text, aluno.graduacao::text,
      count(frequencia.id)::bigint,
      (count(frequencia.id) filter (where frequencia.data >= v_inicio_mes))::bigint,
      max(frequencia.data)::date
    from public.alunos aluno
    left join public.frequencias frequencia
      on frequencia.aluno_id = aluno.id and frequencia.user_id = v_owner
    where aluno.user_id = v_owner or aluno.academia_id = v_owner
    group by aluno.id, aluno.nome, aluno.status, aluno.plano_nome, aluno.graduacao
    order by aluno.nome;
end;
$professor$;

revoke all on function public.professor_listar_alunos() from public, anon;
grant execute on function public.professor_listar_alunos() to authenticated;
notify pgrst, 'reload schema';
commit;

select 'Função de professores corrigida' as resultado;
