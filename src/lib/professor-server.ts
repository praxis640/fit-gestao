import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export class ErroProfessor extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const uuidValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

// O vínculo no banco é a fonte de autorização, inclusive depois da desativação da conta.
// O owner_id enviado pelo navegador ou salvo em um token antigo nunca escolhe a academia.
export async function autenticarProfessor(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new ErroProfessor('Sua sessão expirou. Entre novamente.', 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new ErroProfessor('O acesso dos professores ainda não está configurado no servidor.', 503);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: autenticacao, error: erroAutenticacao } = await admin.auth.getUser(token);
  if (erroAutenticacao || !autenticacao.user) throw new ErroProfessor('Sua sessão expirou. Entre novamente.', 401);

  const { data: professor, error } = await admin.from('gestao_professores')
    .select('id,owner_id,nome,ativo').eq('auth_user_id', autenticacao.user.id).maybeSingle();
  if (error) throw new ErroProfessor('Não foi possível consultar o vínculo do professor com a academia.', 503);
  if (!professor || !uuidValido(professor.owner_id) || professor.owner_id === autenticacao.user.id) {
    throw new ErroProfessor('Esta conta não tem vínculo válido com uma academia. Peça ao responsável para conferir seu cadastro em Professores.', 403);
  }
  if (!professor.ativo) throw new ErroProfessor('Seu acesso está desativado. Peça ao responsável pela academia para reativá-lo.', 403);
  return { admin, professor, ownerId: professor.owner_id as string };
}

export function respostaProfessor(dados: unknown, status = 200) {
  return NextResponse.json(dados, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function falhaProfessor(error: unknown) {
  return respostaProfessor({ error: error instanceof ErroProfessor ? error.message : 'Não foi possível concluir a operação. Tente novamente.' }, error instanceof ErroProfessor ? error.status : 500);
}

export async function lerCorpoProfessor(request: Request): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); } catch { throw new ErroProfessor('Dados inválidos.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroProfessor('Dados inválidos.');
  return corpo as Record<string, unknown>;
}
