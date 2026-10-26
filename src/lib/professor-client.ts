import { supabase } from './supabase';
import type { RegistroProfessor } from './professores-shared';

export async function requisitarProfessor<T>(caminho: 'portal' | 'registros', opcoes: RequestInit = {}, params?: URLSearchParams): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sua sessão expirou. Entre novamente.');
  const headers = new Headers(opcoes.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (opcoes.body) headers.set('Content-Type', 'application/json');
  const resposta = await fetch(`/api/professores/${caminho}${params ? `?${params}` : ''}`, { ...opcoes, headers, cache: 'no-store' });
  const resultado = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(resultado.error || 'Não foi possível carregar os dados da academia.');
  return resultado as T;
}

const falha = (error: unknown) => ({ message: error instanceof Error ? error.message : 'Falha de conexão com a academia.' });

export async function listarRegistrosProfessor(params: Record<string, string | number>) {
  try {
    const resultado = await requisitarProfessor<{ data: RegistroProfessor[]; count: number }>('registros', {}, new URLSearchParams(Object.entries(params).map(([chave, valor]) => [chave, String(valor)])));
    return { ...resultado, error: null };
  } catch (error) { return { data: null, count: null, error: falha(error) }; }
}

export async function salvarRegistrosProfessor(registros: object[], id?: string) {
  try {
    const resultado = await requisitarProfessor<{ data: { id: string }[] }>('registros', {
      method: id ? 'PATCH' : 'POST', body: JSON.stringify(id ? { ...registros[0], id } : { registros })
    });
    return { ...resultado, error: null };
  } catch (error) { return { data: null, error: falha(error) }; }
}

export async function excluirRegistroProfessor(tipo: string, id: string) {
  try {
    const resultado = await requisitarProfessor<{ data: { id: string }[] }>('registros', { method: 'DELETE' }, new URLSearchParams({ tipo, id }));
    return { ...resultado, error: null };
  } catch (error) { return { data: null, error: falha(error) }; }
}
