import { dataEmSaoPaulo, dataISOValida } from '@/lib/faturamento';
import { lerFicha } from '@/lib/fichas';
import { autenticarProfessor, ErroProfessor, falhaProfessor, lerCorpoProfessor, respostaProfessor, uuidValido } from '@/lib/professor-server';
import type { TipoRegistroProfessor } from '@/lib/professores-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validarTipo(valor: unknown): TipoRegistroProfessor {
  if (valor !== 'exercicio' && valor !== 'treino' && valor !== 'nutricao') throw new ErroProfessor('Este recurso não faz parte do acesso do professor.', 403);
  return valor;
}

function texto(valor: unknown, tamanho: number, obrigatorio = false) {
  if (valor === undefined && !obrigatorio) return '';
  if (typeof valor !== 'string' || valor.length > tamanho || (obrigatorio && !valor.trim())) throw new ErroProfessor('Preencha os campos do registro com valores válidos.');
  return valor.trim();
}

function validarRegistro(corpo: Record<string, unknown>, ownerId: string, editando: boolean) {
  const tipo = validarTipo(corpo.tipo);
  if (corpo.valor != null) throw new ErroProfessor('Valores financeiros não podem ser alterados por professores.', 403);
  const alunoId = corpo.aluno_id || null;
  if ((tipo !== 'exercicio' && !uuidValido(alunoId)) || (tipo === 'exercicio' && alunoId !== null)) throw new ErroProfessor('Selecione um aluno válido para este registro.');
  const data = corpo.data_registro === undefined ? dataEmSaoPaulo(new Date()) : corpo.data_registro;
  if (typeof data !== 'string' || !dataISOValida(data)) throw new ErroProfessor('Informe uma data válida.');
  const ficha = lerFicha(corpo.ficha);
  if (tipo === 'treino' && (!Array.isArray(corpo.ficha) || ficha.length !== corpo.ficha.length || ficha.length > 100 || (!editando && !ficha.length) || ficha.some(item =>
    !item.nome.trim() || item.nome.length > 200 || item.grupo.length > 120 ||
    !item.repeticoes.trim() || item.repeticoes.length > 30 || !Number.isInteger(item.descanso) || item.descanso < 0 || item.descanso > 600 || item.observacoes.length > 2000
  ))) throw new ErroProfessor('Confira os exercícios, séries, repetições e descansos da ficha.');

  return {
    user_id: ownerId, tipo,
    titulo: texto(corpo.titulo, 200, true), categoria: texto(corpo.categoria, 120), detalhes: texto(corpo.detalhes, 20000),
    aluno_id: alunoId as string | null, valor: null, quantidade: 1, data_registro: data,
    ...(tipo === 'treino' ? { ficha: ficha.map(item => ({ exercicioId: item.exercicioId, nome: item.nome, grupo: item.grupo, series: item.series, repeticoes: item.repeticoes, descanso: item.descanso, observacoes: item.observacoes })) } : {})
  };
}

export async function GET(request: Request) {
  try {
    const { admin, ownerId } = await autenticarProfessor(request);
    const params = new URL(request.url).searchParams;
    const tipo = validarTipo(params.get('tipo'));
    const pagina = Number(params.get('pagina') || 0);
    const limite = Number(params.get('limite') || 20);
    if (!Number.isInteger(pagina) || pagina < 0 || pagina > 100000 || !Number.isInteger(limite) || limite < 1 || limite > 2000) throw new ErroProfessor('Paginação inválida.');
    const alunoId = params.get('aluno_id');
    if (alunoId && !uuidValido(alunoId)) throw new ErroProfessor('Aluno inválido.');
    const campos = tipo === 'treino'
      ? 'id,titulo,categoria,detalhes,aluno_id,data_registro,criado_em,ficha'
      : 'id,titulo,categoria,detalhes,aluno_id,data_registro,criado_em';
    let consulta = admin.from('gestao_registros').select(campos, { count: 'exact' })
      .eq('user_id', ownerId).eq('tipo', tipo);
    if (alunoId) consulta = consulta.eq('aluno_id', alunoId);
    if (tipo === 'exercicio') {
      const categoria = params.get('categoria');
      const busca = params.get('busca');
      if (categoria) consulta = consulta.eq('categoria', categoria.slice(0, 120));
      if (busca) consulta = consulta.ilike('titulo', `%${busca.slice(0, 200).replace(/[%_\\]/g, '')}%`);
    }
    const { data, count, error } = await consulta.order('criado_em', { ascending: false }).order('id')
      .range(pagina * limite, (pagina + 1) * limite - 1);
    if (error) throw new ErroProfessor('Não foi possível carregar os registros da academia.', 502);
    // A coluna valor não é consultada nem devolvida; o componente usa null nos módulos operacionais.
    const registros = (data || []) as unknown as { id: string; titulo: string; categoria: string; detalhes: string; aluno_id: string | null; data_registro: string; criado_em: string; ficha?: unknown }[];
    return respostaProfessor({ data: registros.map(r => ({ id: r.id, titulo: r.titulo, categoria: r.categoria, detalhes: r.detalhes, aluno_id: r.aluno_id, data_registro: r.data_registro, criado_em: r.criado_em, valor: null, quantidade: 1, ...(tipo === 'treino' ? { ficha: r.ficha } : {}) })), count: count || 0 });
  } catch (error) { return falhaProfessor(error); }
}

async function salvar(request: Request, editando: boolean) {
  try {
    const { admin, ownerId } = await autenticarProfessor(request);
    const corpo = await lerCorpoProfessor(request);
    if (editando && !uuidValido(corpo.id)) throw new ErroProfessor('Registro inválido.');
    const entradas = editando ? [corpo] : (Array.isArray(corpo.registros) ? corpo.registros : [corpo]);
    if (!entradas.length || entradas.length > 40) throw new ErroProfessor('Envie até 40 exercícios por vez.');
    const registros = entradas.map(entrada => {
      if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new ErroProfessor('Registro inválido.');
      return validarRegistro(entrada as Record<string, unknown>, ownerId, editando);
    });
    if (registros.length > 1 && registros.some(r => r.tipo !== 'exercicio')) throw new ErroProfessor('Somente exercícios podem ser importados em lote.');
    for (const alunoId of new Set(registros.map(r => r.aluno_id).filter((id): id is string => !!id))) {
      const { data, error } = await admin.from('alunos').select('id').eq('id', alunoId)
        .or(`user_id.eq.${ownerId},academia_id.eq.${ownerId}`).maybeSingle();
      if (error) throw new ErroProfessor('Não foi possível conferir o aluno.', 502);
      if (!data) throw new ErroProfessor('Aluno não encontrado nesta academia.', 404);
    }
    const { data, error } = editando
      ? await admin.from('gestao_registros').update(registros[0]).eq('id', corpo.id).eq('user_id', ownerId).eq('tipo', registros[0].tipo).select('id')
      : await admin.from('gestao_registros').insert(registros).select('id');
    if (error) throw new ErroProfessor('Não foi possível salvar o registro na academia.', 502);
    if (!data?.length) throw new ErroProfessor('Registro não encontrado nesta academia.', 404);
    return respostaProfessor({ data }, editando ? 200 : 201);
  } catch (error) { return falhaProfessor(error); }
}

export async function POST(request: Request) { return salvar(request, false); }
export async function PATCH(request: Request) { return salvar(request, true); }

export async function DELETE(request: Request) {
  try {
    const { admin, ownerId } = await autenticarProfessor(request);
    const params = new URL(request.url).searchParams;
    const tipo = validarTipo(params.get('tipo'));
    const id = params.get('id');
    if (!uuidValido(id)) throw new ErroProfessor('Registro inválido.');
    const { data, error } = await admin.from('gestao_registros').delete().eq('id', id).eq('user_id', ownerId).eq('tipo', tipo).select('id');
    if (error) throw new ErroProfessor('Não foi possível excluir o registro.', 502);
    if (!data?.length) throw new ErroProfessor('Registro não encontrado nesta academia.', 404);
    return respostaProfessor({ data });
  } catch (error) { return falhaProfessor(error); }
}
