-- Campos usados para preencher e imprimir o contrato do aluno.
-- Execute o arquivo inteiro no SQL Editor do Supabase.
begin;
alter table public.alunos
  add column if not exists cpf text,
  add column if not exists endereco text,
  add column if not exists contrato_responsavel_nome text not null default '',
  add column if not exists contrato_responsavel_cpf text not null default '',
  add column if not exists contrato_responsavel_telefone text not null default '',
  add column if not exists contrato_responsavel_parentesco text not null default '',
  add column if not exists contrato_texto text not null default '',
  add column if not exists contrato_personalizado boolean not null default false;
alter table public.gestao_configuracoes
  add column if not exists cnpj_cpf text not null default '',
  add column if not exists endereco text not null default '',
  add column if not exists modelo_contrato text not null default '',
  add column if not exists modelo_contrato_adulto text not null default '',
  add column if not exists modelo_contrato_menor text not null default '';
commit;
