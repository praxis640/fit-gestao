# Cobranças de mensalidades

## Preparar o banco

No Supabase do projeto FitGestão, abra **SQL Editor**, cole todo o conteúdo de `supabase/migrations/20261008_cobrancas_asaas.sql` e execute uma vez. A migração cria o histórico de cobranças, aplica RLS e instala o processador autenticado do webhook.

## Configurar variáveis no Vercel

Em **Settings → Environment Variables**, configure para o ambiente de teste:

- `ASAAS_ENV` = `sandbox`
- `ASAAS_API_KEY` = chave de API da conta Sandbox do Asaas
- `ASAAS_WEBHOOK_TOKEN` = token aleatório seguro, com pelo menos 32 caracteres; use o mesmo valor no webhook do Asaas
- `SUPABASE_SERVICE_ROLE_KEY` = chave `service_role` do projeto Supabase

As variáveis privadas devem ficar somente no servidor. Não use o prefixo `NEXT_PUBLIC_` nelas. Depois de salvar, faça um novo deploy.

## Configurar webhook do Asaas

Cadastre um webhook para `https://fit-gestao-two.vercel.app/api/webhooks/asaas`, com o mesmo `ASAAS_WEBHOOK_TOKEN`. Selecione os eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED` e `PAYMENT_REFUNDED`.

O app cria uma cobrança Pix por aluno e competência, mostra a fatura e permite preparar uma mensagem com o link no WhatsApp. O operador revisa e envia a mensagem manualmente. O pagamento só entra no financeiro depois do evento autenticado do Asaas.

Para produção, use uma chave da conta de produção e altere `ASAAS_ENV` para `production`. Cadastros de clientes do Sandbox não são reaproveitados em produção.
