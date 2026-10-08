import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Aluno = {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string | null;
  valor_mensalidade: number | string | null;
  proximo_vencimento: string | null;
  dia_vencimento: number | null;
  plano_nome: string | null;
};

function respostaErro(mensagem: string, status = 400) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = process.env.ASAAS_API_KEY;
  if (!token || !url || !anonKey) return respostaErro('Sessão inválida. Entre novamente.', 401);
  if (!apiKey) return respostaErro('Integração de pagamentos ainda não configurada: falta ASAAS_API_KEY no servidor.', 503);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return respostaErro('Sessão inválida. Entre novamente.', 401);
  const userId = authData.user.id;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return respostaErro('Integração de pagamentos ainda não configurada: falta SUPABASE_SERVICE_ROLE_KEY no servidor.', 503);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: { alunoId?: string };
  try { body = await request.json(); } catch { return respostaErro('Dados da cobrança inválidos.'); }
  if (!body.alunoId || !/^[0-9a-f-]{36}$/i.test(body.alunoId)) return respostaErro('Selecione um aluno válido.');

  const { data: alunoData, error: alunoError } = await supabase.from('alunos')
    .select('id,nome,telefone,cpf,valor_mensalidade,proximo_vencimento,dia_vencimento,plano_nome')
    .eq('id', body.alunoId)
    .or(`user_id.eq.${userId},academia_id.eq.${userId}`).maybeSingle();
  if (alunoError || !alunoData) return respostaErro('Aluno não encontrado ou sem acesso.', 404);
  const aluno = alunoData as Aluno;
  const valor = Number(aluno.valor_mensalidade);
  if (!Number.isFinite(valor) || valor <= 0) return respostaErro('Cadastre um valor mensal positivo para este aluno.');

  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const diaDoMes = Number(aluno.dia_vencimento || 10);
  const ultimoDia = new Date(`${hoje.slice(0, 7)}-01T12:00:00-03:00`);
  ultimoDia.setMonth(ultimoDia.getMonth() + 1);
  ultimoDia.setDate(0);
  const vencimento = aluno.proximo_vencimento?.slice(0, 10) || `${hoje.slice(0, 7)}-${String(Math.min(Math.max(diaDoMes, 1), ultimoDia.getDate())).padStart(2, '0')}`;
  const competencia = `${vencimento.slice(0, 7)}-01`;
  const ambiente = process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';

  const { data: existente } = await supabase.from('gestao_cobrancas').select('id,status,url_fatura,codigo_pix')
    .eq('user_id', userId).eq('aluno_id', aluno.id).eq('competencia', competencia).maybeSingle();
  if (existente?.url_fatura && ['pendente', 'processando'].includes(existente.status)) {
    return NextResponse.json({ id: existente.id, url: existente.url_fatura, pix: existente.codigo_pix, reused: true });
  }
  if (existente) return respostaErro(`Já existe uma cobrança nesta competência com status ${existente.status}.`, 409);

  const { data: clienteAnterior } = await supabase.from('gestao_cobrancas').select('cliente_provedor_id')
    .eq('user_id', userId).eq('aluno_id', aluno.id).eq('ambiente_provedor', ambiente).not('cliente_provedor_id', 'is', null)
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();

  const { data: cobranca, error: insertError } = await supabase.from('gestao_cobrancas').insert({
    user_id: userId, aluno_id: aluno.id, valor, competencia, vencimento, ambiente_provedor: ambiente, status: 'processando'
  }).select('id').single();
  if (insertError || !cobranca) return respostaErro(insertError?.message || 'Não foi possível preparar a cobrança.', 500);

  const baseUrl = process.env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  const headers = { 'Content-Type': 'application/json', access_token: apiKey };
  let customerId: string | undefined = clienteAnterior?.cliente_provedor_id || undefined;
  try {
    if (!customerId) {
      const custResp = await fetch(`${baseUrl}/customers`, {
        method: 'POST', headers,
        body: JSON.stringify({
          name: aluno.nome,
          ...(aluno.cpf ? { cpfCnpj: aluno.cpf.replace(/\D/g, '') } : {}),
          ...(aluno.telefone ? { mobilePhone: aluno.telefone.replace(/\D/g, '').replace(/^55/, '') } : {}),
          externalReference: `fitgestao-aluno-${aluno.id}`,
          notificationDisabled: true
        }), cache: 'no-store'
      });
      const customer = await custResp.json();
      if (!custResp.ok || !customer.id) throw new Error(customer.errors?.[0]?.description || 'O Asaas não aceitou o cadastro do pagador.');
      customerId = customer.id;
      await supabase.from('gestao_cobrancas').update({ cliente_provedor_id: customerId }).eq('id', cobranca.id).eq('user_id', userId);
    }

    const paymentResp = await fetch(`${baseUrl}/payments`, {
      method: 'POST', headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: Number(valor.toFixed(2)),
        dueDate: vencimento,
        description: `Mensalidade ${aluno.plano_nome || 'da academia'} - ${aluno.nome}`,
        externalReference: cobranca.id
      }), cache: 'no-store'
    });
    const payment = await paymentResp.json();
    if (!paymentResp.ok || !payment.id || !payment.invoiceUrl) throw new Error(payment.errors?.[0]?.description || 'Não foi possível criar a cobrança Pix.');

    let pix: string | null = null;
    const qrResp = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, { headers, cache: 'no-store' });
    if (qrResp.ok) {
      const qr = await qrResp.json();
      pix = typeof qr.payload === 'string' ? qr.payload : null;
    }
    const { error: saveError } = await supabase.from('gestao_cobrancas').update({
      status: 'pendente', cliente_provedor_id: customerId, pagamento_provedor_id: payment.id,
      url_fatura: payment.invoiceUrl, codigo_pix: pix
    }).eq('id', cobranca.id).eq('user_id', userId);
    if (saveError) throw new Error('Cobrança criada, mas não foi possível salvar o retorno. Recarregue antes de criar outra.');
    return NextResponse.json({ id: cobranca.id, url: payment.invoiceUrl, pix, reused: false });
  } catch (error) {
    await supabase.from('gestao_cobrancas').update({ status: 'falha' }).eq('id', cobranca.id).eq('user_id', userId);
    return respostaErro(error instanceof Error ? error.message : 'Falha ao criar cobrança no Asaas.', 502);
  }
}
