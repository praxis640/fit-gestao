import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const estados: Record<string, string> = {
  PAYMENT_RECEIVED: 'recebido',
  // Pix pode permanecer CONFIRMED durante análise; só RECEIVED entra no financeiro.
  PAYMENT_CONFIRMED: 'pendente',
  PAYMENT_OVERDUE: 'atrasado',
  PAYMENT_DELETED: 'cancelado',
  PAYMENT_REFUNDED: 'estornado'
};

export async function POST(request: NextRequest) {
  const secret = process.env.ASAAS_WEBHOOK_TOKEN;
  const received = request.headers.get('asaas-access-token');
  if (!secret || !received || received !== secret) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  let event: { id?: string; event?: string; payment?: { id?: string; externalReference?: string } };
  try { event = await request.json(); } catch { return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 }); }
  const status = event.event ? estados[event.event] : undefined;
  const reference = event.payment?.externalReference;
  const paymentId = event.payment?.id;
  if (!status || !reference || !paymentId) return NextResponse.json({ received: true, ignored: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: 'Integração do webhook indisponível.' }, { status: 503 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.rpc('processar_evento_cobranca_asaas', {
    p_referencia: reference,
    p_status: status,
    p_pagamento_provedor_id: paymentId,
    p_evento_id: event.id || null
  });
  if (error) return NextResponse.json({ error: 'Não foi possível processar o evento.' }, { status: 500 });
  return NextResponse.json({ received: true });
}
