import { NextRequest, NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function erro(mensagem: string, status: number) {
  return NextResponse.json({ error: mensagem }, { status });
}

async function autenticarDono(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anonKey || !serviceKey) return { error: 'Configure as chaves Supabase no ambiente da Vercel.', status: 503 as const };
  if (!token) return { error: 'Sessão inválida. Entre novamente.', status: 401 as const };

  const auth = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error: authError } = await auth.auth.getUser(token);
  if (authError || !data.user) return { error: 'Sessão inválida. Entre novamente.', status: 401 as const };
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const user = data.user as User;
  const { data: vinculo, error: vinculoError } = await admin.from('gestao_professores')
    .select('id').eq('auth_user_id', user.id).maybeSingle();
  if (vinculoError) return { error: 'Não foi possível verificar as permissões. Confira a migração de professores no Supabase.', status: 503 as const };
  if (vinculo || user.app_metadata?.fitgestao_role === 'professor') {
    return { error: 'Somente o responsável pela academia pode gerenciar professores.', status: 403 as const };
  }
  return { admin, user };
}

export async function POST(request: NextRequest) {
  const contexto = await autenticarDono(request);
  if ('status' in contexto) return erro(contexto.error || 'Acesso não autorizado.', contexto.status || 500);
  let corpo: { nome?: string; email?: string; senha?: string };
  try { corpo = await request.json(); } catch { return erro('Dados inválidos.', 400); }

  const nome = corpo.nome?.trim() || '';
  const email = corpo.email?.trim().toLowerCase() || '';
  const senha = corpo.senha || '';
  if (nome.length < 2 || nome.length > 120) return erro('Informe o nome do professor.', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return erro('Informe um e-mail válido.', 400);
  if (senha.length < 10 || senha.length > 72) return erro('A senha inicial deve ter entre 10 e 72 caracteres.', 400);

  const { admin, user: dono } = contexto;
  const { data: criado, error: criarErro } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome },
    app_metadata: { fitgestao_role: 'professor', fitgestao_owner_id: dono.id }
  });
  if (criarErro || !criado.user) {
    const conflito = criarErro?.message.toLowerCase().includes('already') || criarErro?.message.toLowerCase().includes('registered');
    return erro(conflito ? 'Este e-mail já possui uma conta. Use outro e-mail.' : `Não foi possível criar a conta: ${criarErro?.message || 'erro desconhecido'}`, conflito ? 409 : 400);
  }

  const { error: salvarErro } = await admin.from('gestao_professores').insert({
    owner_id: dono.id, auth_user_id: criado.user.id, nome, email, ativo: true
  });
  if (salvarErro) {
    await admin.auth.admin.deleteUser(criado.user.id);
    return erro(`Não foi possível vincular o professor: ${salvarErro.message}`, 400);
  }
  return NextResponse.json({ id: criado.user.id, nome, email, ativo: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const contexto = await autenticarDono(request);
  if ('status' in contexto) return erro(contexto.error || 'Acesso não autorizado.', contexto.status || 500);
  let corpo: { id?: string; ativo?: boolean };
  try { corpo = await request.json(); } catch { return erro('Dados inválidos.', 400); }
  if (!corpo.id || typeof corpo.ativo !== 'boolean') return erro('Professor ou situação inválida.', 400);
  const { data, error: salvarErro } = await contexto.admin.from('gestao_professores')
    .update({ ativo: corpo.ativo }).eq('id', corpo.id).eq('owner_id', contexto.user.id).select('id').maybeSingle();
  if (salvarErro) return erro(`Não foi possível atualizar o professor: ${salvarErro.message}`, 400);
  if (!data) return erro('Professor não encontrado nesta academia.', 404);
  return NextResponse.json({ ok: true, ativo: corpo.ativo });
}
