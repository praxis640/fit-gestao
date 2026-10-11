-- Remove a RPC antiga com argumento text que deixa a chamada ambígua no PostgREST.
begin;

drop function if exists public.registrar_pagamento(text);

commit;

notify pgrst, 'reload schema';

select p.oid::regprocedure as funcao_registrar_pagamento
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'registrar_pagamento';
