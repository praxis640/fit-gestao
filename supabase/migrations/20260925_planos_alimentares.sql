-- Aplique depois de 20260925_modulos_operacionais.sql no mesmo projeto Supabase do aplicativo.
-- Os registros antigos em Nutrição e todos os demais módulos permanecem intactos.
begin;
do $$
begin
  if to_regclass('public.gestao_registros') is null then
    raise exception 'Execute primeiro 20260925_modulos_operacionais.sql';
  end if;
end;
$$;

alter table public.gestao_registros add column if not exists plano_alimentar jsonb;

commit;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'gestao_registros'
    and column_name = 'plano_alimentar' and data_type = 'jsonb'
) as planos_alimentares_prontos;
