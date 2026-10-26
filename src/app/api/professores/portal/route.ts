import { dataEmSaoPaulo, dataISOValida } from '@/lib/faturamento';
import { autenticarProfessor, ErroProfessor, falhaProfessor, lerCorpoProfessor, respostaProfessor, uuidValido } from '@/lib/professor-server';
import type { DadosPortalProfessor } from '@/lib/professores-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pagina também as presenças antigas: o limite padrão do Supabase não pode zerar ou truncar os totais.
async function lerPaginas<T>(consultar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>, mensagem: string) {
  const registros: T[] = [];
  let total = Infinity;
  while (registros.length < total) {
    const { data, error, count } = await consultar(registros.length, registros.length + 999);
    if (error) throw new ErroProfessor(mensagem, 502);
    if (count !== null) total = count;
    if (!data?.length) {
      if (registros.length < total && Number.isFinite(total)) throw new ErroProfessor(mensagem, 502);
      break;
    }
    registros.push(...data);
    if (count === null && data.length < 1000) break;
  }
  return registros;
}

export async function GET(request: Request) {
  try {
    const { admin, professor, ownerId } = await autenticarProfessor(request);
    const [alunos, presencas, configuracao] = await Promise.all([
      lerPaginas((inicio, fim) => admin.from('alunos')
        .select('id,nome,status,plano_nome,graduacao', { count: 'exact' })
        .or(`user_id.eq.${ownerId},academia_id.eq.${ownerId}`)
        .order('criado_em', { ascending: false }).order('id').range(inicio, fim), 'Não foi possível carregar os alunos da academia.'),
      lerPaginas((inicio, fim) => admin.from('frequencias')
        .select('aluno_id,data', { count: 'exact' }).eq('user_id', ownerId)
        .order('id').range(inicio, fim), 'Não foi possível carregar as presenças da academia.'),
      admin.from('gestao_configuracoes').select('nome_academia').eq('user_id', ownerId).maybeSingle()
    ]);
    const hoje = dataEmSaoPaulo(new Date());
    const inicioMes = `${hoje.slice(0, 7)}-01`;
    const totais = new Map<string, { total: number; mes: number; ultima: string | null }>();
    for (const presenca of presencas) {
      const dia = String(presenca.data).slice(0, 10);
      const id = String(presenca.aluno_id);
      const contagem = totais.get(id) || { total: 0, mes: 0, ultima: null };
      contagem.total++;
      if (dia >= inicioMes && dia <= hoje) contagem.mes++;
      if (!contagem.ultima || dia > contagem.ultima) contagem.ultima = dia;
      totais.set(id, contagem);
    }
    // A resposta inclui somente campos operacionais, mesmo usando uma consulta autorizada no servidor.
    const resposta: DadosPortalProfessor = {
      academia: { owner_id: ownerId, nome: configuracao.data?.nome_academia || 'Academia vinculada' },
      professor: { id: String(professor.id), nome: String(professor.nome) },
      alunos: alunos.map(aluno => ({
        id: String(aluno.id), nome: String(aluno.nome), status: String(aluno.status),
        plano_nome: aluno.plano_nome, graduacao: aluno.graduacao,
        total_presencas: totais.get(String(aluno.id))?.total || 0,
        presencas_mes: totais.get(String(aluno.id))?.mes || 0,
        ultima_presenca: totais.get(String(aluno.id))?.ultima || null
      }))
    };
    return respostaProfessor(resposta);
  } catch (error) { return falhaProfessor(error); }
}

export async function POST(request: Request) {
  try {
    const { admin, ownerId } = await autenticarProfessor(request);
    const corpo = await lerCorpoProfessor(request);
    if (!uuidValido(corpo.aluno_id) || typeof corpo.data !== 'string' || !dataISOValida(corpo.data) || corpo.data > dataEmSaoPaulo(new Date())) {
      throw new ErroProfessor('Selecione um aluno e uma data válida, até hoje.');
    }
    const { data: aluno, error: erroAluno } = await admin.from('alunos').select('id')
      .eq('id', corpo.aluno_id).or(`user_id.eq.${ownerId},academia_id.eq.${ownerId}`).maybeSingle();
    if (erroAluno) throw new ErroProfessor('Não foi possível conferir o aluno.', 502);
    if (!aluno) throw new ErroProfessor('Aluno não encontrado nesta academia.', 404);
    const { data: existente, error: erroConsulta } = await admin.from('frequencias').select('id')
      .eq('user_id', ownerId).eq('aluno_id', aluno.id).eq('data', corpo.data).limit(1).maybeSingle();
    if (erroConsulta) throw new ErroProfessor('Não foi possível conferir a presença.', 502);
    if (existente) throw new ErroProfessor('Já existe uma presença desse aluno nessa data.', 409);
    const { error } = await admin.from('frequencias').insert({ user_id: ownerId, aluno_id: aluno.id, data: corpo.data });
    if (error) throw new ErroProfessor(error.code === '23505' ? 'Já existe uma presença desse aluno nessa data.' : 'Não foi possível registrar a presença.', error.code === '23505' ? 409 : 502);
    return respostaProfessor({ ok: true }, 201);
  } catch (error) { return falhaProfessor(error); }
}
