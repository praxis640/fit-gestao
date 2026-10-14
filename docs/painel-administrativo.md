# Painel administrativo do ProGestFit

## Onde acessar

Produção: https://fit-gestao-two.vercel.app/admin

Local: http://localhost:3000/admin

É uma área separada no mesmo aplicativo e usa a mesma autenticação Supabase. As academias continuam acessando a página inicial normalmente. Conhecer o endereço /admin não dá permissão. A autorização é conferida no banco em todas as consultas e gravações. Não há chave service_role no navegador nem senha administrativa fixa.

## 1. Instalar as tabelas e funções

1. Abra o projeto Supabase que já está conectado ao FitGestão/ProGestFit.
2. No menu esquerdo, abra **SQL Editor** e clique em **New query**.
3. No GitHub, abra `supabase/migrations/20261014_painel_administrativo.sql` e clique em **Raw** para copiar todo o conteúdo.
4. Cole o arquivo inteiro no SQL Editor e clique em **Run**.
5. O resultado deve mostrar `painel_instalado = true`.

Esta migração adiciona tabelas de assinaturas do software e pagamentos. Ela requer as tabelas existentes `alunos` e `gestao_configuracoes`; não execute em outro projeto vazio.

## 2. Autorizar sua conta

Escolha uma conta do sistema para ser seu administrador. Se ainda não existir, crie uma conta no login normal e confirme o e-mail quando solicitado. Prefira uma conta própria para administração: contas administrativas deixam de aparecer na lista de academias.

No SQL Editor, crie uma nova consulta e cole **todo** este bloco. Substitua apenas `SEU_EMAIL_AQUI` pelo e-mail da sua conta. Execute somente após instalar o SQL acima.

```sql
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users
  WHERE lower(email) = lower('SEU_EMAIL_AQUI');
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'E-mail não encontrado. Crie a conta no sistema primeiro.';
  END IF;
  INSERT INTO public.saas_administradores (user_id)
  VALUES (v_id) ON CONFLICT (user_id) DO NOTHING;
END;
$$;

SELECT u.email AS administrador_autorizado
FROM public.saas_administradores a
JOIN auth.users u ON u.id = a.user_id;
```

O resultado precisa mostrar seu e-mail. Não use o e-mail de um cliente: o administrador consegue ver a carteira inteira e registrar pagamentos.

## 3. Colocar o código no ar

Se o código já estiver na branch `main`, a Vercel conectada ao GitHub deve iniciar o deploy automaticamente. Abra **Vercel → projeto → Deployments** e aguarde o deployment correspondente ao commit do painel ficar **Ready** em Production.

Se a alteração estiver em uma pull request, abra-a no GitHub e use **Merge pull request → Confirm merge** antes de aguardar a Vercel. Em ambos os casos, a URL de produção permanece a mesma, com `/admin` no final.

Para atualizar a cópia no seu computador, no terminal do VS Code, dentro da pasta do projeto:

```bash
git pull origin main
npm ci
npm run dev
```

Acesse http://localhost:3000/admin. Sua instalação local usa o mesmo banco configurado no `.env.local`. Nenhuma variável nova é necessária: são usadas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que o sistema já utiliza.

## 4. Entrar

1. Abra https://fit-gestao-two.vercel.app/admin.
2. Use o e-mail autorizado no passo 2 e a senha dessa conta.
3. Se houver outra conta de academia conectada no navegador, clique em **Sair** no painel e entre com sua conta administrativa.
4. Salve a URL nos favoritos.

A recuperação de senha permanece no login normal, pelo link **Voltar ao sistema / recuperar senha**.

## 5. Configurar uma academia

As contas já cadastradas aparecem automaticamente. A lista representa uma academia por usuário, conforme a estrutura atual do aplicativo. Administradores são excluídos. Para um cliente novo, ele cria sua conta no sistema normalmente; depois você atualiza o painel.

1. Localize a academia e clique em **Editar assinatura**.
2. Preencha nome, responsável e WhatsApp.
3. Informe o nome do plano e o **valor mensal** que essa academia paga pelo software.
4. Escolha o próximo vencimento. Para teste, informe a data de encerramento do teste.
5. Escolha o status comercial e clique em **Salvar assinatura**.

Exemplo: Plano Mensal, R$ 99,90, Ativa, próximo vencimento 10/11/2026.

O valor é da assinatura do ProGestFit, separado das mensalidades dos alunos. Nesta versão, todos os planos são mensais. Nomear um plano como “Anual” não converte os indicadores em receita mensal equivalente.

## 6. Registrar um pagamento

Depois de salvar a assinatura e confirmar o recebimento no banco:

1. Clique em **Registrar pagamento** na academia.
2. Escolha a competência (o mês que foi pago), o valor efetivamente recebido, a data e a forma de pagamento.
3. Confira o novo vencimento. A sugestão avança um mês a partir do vencimento futuro ou de hoje, se o prazo estiver vencido. Ajuste à regra comercial combinada.
4. Clique em **Confirmar pagamento**.

O pagamento fica no histórico e a assinatura passa a Ativa, com o novo vencimento. O banco salva o pagamento e o vencimento juntos. Um segundo pagamento para a mesma academia e competência é recusado. O novo prazo precisa ser posterior ao pagamento e avançar o vencimento atual.

A versão inicial aceita um pagamento completo por mês, sem parcelamento, estorno ou edição de pagamento pela tela. Confira os dados antes de confirmar. Para corrigir um registro incorreto, solicite uma correção específica, preservando a identificação da academia e da competência.

## 7. Entender os indicadores

| Indicador | Significado |
|---|---|
| Receita mensal contratada | Soma dos valores mensais das assinaturas com status Ativa, incluindo as que estão em atraso |
| Recebido neste mês | Soma dos pagamentos pela data em que foram pagos, no mês atual de São Paulo |
| Academias ativas | Contas cujo status comercial é Ativa |
| Assinaturas em atraso | Assinaturas Ativas cujo vencimento é anterior a hoje |
| Alunos cadastrados | Contagem agregada de alunos das contas listadas, sem nomes, CPFs ou dados individuais |
| Último login | Última autenticação registrada pelo Supabase; não indica quem está on-line neste instante |

O vencimento de hoje ainda está em dia. Sem vencimento, a assinatura Ativa recebe o aviso “Sem vencimento”. Testes vencidos aparecem como “Teste encerrado”. Use **Atualizar** para buscar os dados mais recentes.

## Limites da primeira versão

- Pausada e Cancelada são classificações comerciais: não bloqueiam o cliente no sistema. O bloqueio precisa de uma integração completa com as permissões de todas as operações.
- Não há cobrança automática, envio de WhatsApp ou confirmação de Pix neste painel. A integração Asaas dos alunos permanece separada.
- O painel não troca de identidade nem permite entrar na conta de um cliente.
- As academias não podem consultar nem alterar as tabelas administrativas diretamente. As funções exigem sua conta administrativa no banco.

## Se algo não funcionar

- **Painel ainda não instalado:** execute o SQL do passo 1 no banco correto.
- **Sua conta não tem permissão:** execute o passo 2 com o mesmo e-mail usado no login.
- **Página /admin não encontrada:** confira se o deployment do commit está Ready em Production na Vercel.
- **Academia ainda sem pagamento:** salve a assinatura antes de registrar o primeiro recebimento.
- **Pagamento duplicado:** confira a competência e consulte a aba Pagamentos.
- **Nome de academia antigo ou genérico:** configure o nome em Editar assinatura. Isso altera a identificação comercial no painel, sem renomear o cadastro do cliente.

## Verificação técnica

Build: `npm run build`. As permissões e transações podem ser verificadas em um PostgreSQL isolado com `tests/saas-database.mjs`; a dependência de teste indicada no arquivo não é uma dependência do aplicativo.

Referência de segurança: https://supabase.com/docs/guides/database/functions
