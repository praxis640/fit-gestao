'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { formatarDataBrasil } from '@/lib/alunos';
import { requisitarProfessor } from '@/lib/professor-client';
import type { DadosPortalProfessor } from '@/lib/professores-shared';
import { ModuloGestao, type TipoModulo } from './modulos';

const menu = [
  { nome: 'Início', icone: '🏠' }, { nome: 'Alunos', icone: '👤' }, { nome: 'Frequência', icone: '📅' },
  { nome: 'Exercícios', icone: '🏋️' }, { nome: 'Treinos', icone: '🏃' }, { nome: 'Nutrição', icone: '🥣' }
];
const modulo: Partial<Record<string, TipoModulo>> = { Exercícios: 'exercicio', Treinos: 'treino', Nutrição: 'nutricao' };
const painel: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.2rem' };
const control: React.CSSProperties = { minHeight: 42, padding: '.65rem', borderRadius: 7, border: '1px solid #3a3f55', background: '#13151f', color: '#fff' };
const label: React.CSSProperties = { display: 'grid', gap: '.4rem', color: '#cbd5e1', fontSize: '.87rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '.7rem', color: '#aeb5c6', borderBottom: '1px solid #34394c' };
const td: React.CSSProperties = { padding: '.7rem', borderBottom: '1px solid #292e40' };

export function PortalProfessor({ nome, onSair }: { nome: string; onSair: () => void }) {
  const [aba, setAba] = useState('Início');
  const [dados, setDados] = useState<DadosPortalProfessor | null>(null);
  const [alunoId, setAlunoId] = useState('');
  const [data, setData] = useState(() => dataEmSaoPaulo(new Date()));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroDados, setErroDados] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const consultaAtual = useRef(0);

  const carregar = useCallback(async (silencioso = false) => {
    const consulta = ++consultaAtual.current;
    if (!silencioso) setCarregando(true);
    try {
      const resultado = await requisitarProfessor<DadosPortalProfessor>('portal');
      if (consulta !== consultaAtual.current) return;
      setDados(resultado);
      setAlunoId(atual => resultado.alunos.some(a => a.id === atual) ? atual : resultado.alunos[0]?.id || '');
      setErroDados('');
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      if (consulta !== consultaAtual.current) return;
      // Falha de autorização/conexão não é apresentada como academia com zero alunos.
      setDados(null);
      setErroDados(error instanceof Error ? error.message : 'Não foi possível carregar os dados da academia.');
    } finally {
      if (consulta === consultaAtual.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // A consulta carrega a academia vinculada depois da autenticação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const atualizarAoVoltar = () => { if (!document.hidden) void carregar(true); };
    window.addEventListener('focus', atualizarAoVoltar);
    return () => {
      // Este ref é um contador de consultas: invalida respostas pendentes ao sair do portal.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      consultaAtual.current++;
      window.removeEventListener('focus', atualizarAoVoltar);
    };
  }, [carregar]);

  const ativos = useMemo(() => dados?.alunos.filter(a => a.status === 'Ativo').length || 0, [dados]);
  const presencasMes = useMemo(() => dados?.alunos.reduce((total, a) => total + a.presencas_mes, 0) || 0, [dados]);

  async function registrarPresenca(e: React.FormEvent) {
    e.preventDefault();
    setErroAcao(''); setMensagem(''); setSalvando(true);
    try {
      await requisitarProfessor('portal', { method: 'POST', body: JSON.stringify({ aluno_id: alunoId, data }) });
      setMensagem('Presença registrada na academia. O responsável também verá esse registro.');
      await carregar(true);
    } catch (error) { setErroAcao(error instanceof Error ? error.message : 'Não foi possível registrar a presença.'); }
    finally { setSalvando(false); }
  }

  return <div className="fit-shell" style={{ minHeight: '100vh', background: '#13151f', color: '#fff', fontFamily: 'sans-serif' }}>
    <aside className="fit-sidebar" style={{ background: '#1a1d2b', borderRight: '1px solid #24283b', padding: '1.2rem .8rem', gap: '.4rem' }}>
      <div className="fit-sidebar-top"><h2 className="fit-brand" style={{ paddingLeft: '.8rem', fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{dados?.academia.nome || 'Área do professor'}</h2><button type="button" className="fit-signout-mobile" onClick={onSair}>Sair</button></div>
      <nav className="fit-nav" aria-label="Menu do professor">{menu.map(item => <button key={item.nome} type="button" aria-current={aba === item.nome ? 'page' : undefined} onClick={() => { setAba(item.nome); setErroAcao(''); setMensagem(''); }} style={{ display: 'flex', gap: '.65rem', alignItems: 'center', padding: '.7rem .9rem', border: 0, borderRadius: 8, background: aba === item.nome ? '#635bfc' : 'transparent', color: aba === item.nome ? '#fff' : '#aeb5c6', textAlign: 'left', cursor: 'pointer' }}><span>{item.icone}</span>{item.nome}</button>)}</nav>
      <div className="fit-sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid #24283b', paddingTop: '1rem' }}><button type="button" onClick={onSair} style={{ width: '100%', padding: '.65rem', color: '#ff8585', background: 'transparent', border: '1px solid #3a3f55', borderRadius: 7, cursor: 'pointer' }}>Sair da conta</button></div>
    </aside>
    <main className="fit-main" style={{ display: 'grid', alignContent: 'start', gap: '1rem' }}>
      <header style={{ ...painel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><small style={{ color: '#a9a3ff' }}>ÁREA DO PROFESSOR{dados ? ` · ${dados.academia.nome}` : ''}</small><h1 style={{ margin: '.35rem 0 0', fontSize: '1.35rem' }}>{aba === 'Início' ? `Olá, ${dados?.professor.nome || nome || 'professor(a)'}` : aba}</h1>{dados && <p style={{ margin: '.5rem 0 0', color: '#aeb5c6', fontSize: '.85rem' }}>Alunos, presenças e fichas compartilhados com a academia · atualizado às {atualizadoEm}</p>}</div>
        <button type="button" disabled={carregando} onClick={() => void carregar()} style={{ ...control, cursor: 'pointer' }}>{carregando ? 'Atualizando…' : '↻ Atualizar dados'}</button>
      </header>
      {(erroDados || erroAcao) && <div role="alert" style={{ ...painel, borderColor: '#7f1d1d', color: '#fecaca' }}>{erroDados || erroAcao}</div>}
      {mensagem && <div role="status" style={{ ...painel, borderColor: '#166534', color: '#bbf7d0' }}>{mensagem}</div>}
      {carregando && <div style={painel}>Carregando dados da academia…</div>}
      {!carregando && dados && !dados.alunos.length && <div role="status" style={{ ...painel, borderColor: '#854d0e', color: '#fde68a' }}>Nenhum aluno foi encontrado na conta de “{dados.academia.nome}”. Se a academia já possui alunos, peça ao responsável para conferir se cadastrou este professor na mesma conta em que os alunos aparecem.</div>}
      {!carregando && dados && aba === 'Início' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '.8rem' }}>
          {[['Alunos cadastrados', dados.alunos.length], ['Matrículas ativas', ativos], ['Presenças neste mês', presencasMes]].map(([titulo, valor]) => <div key={String(titulo)} style={painel}><small style={{ color: '#aeb5c6' }}>{titulo}</small><strong style={{ display: 'block', fontSize: '1.7rem', marginTop: '.4rem' }}>{valor}</strong></div>)}
        </div>
        <section style={painel}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Alunos recentes</h2>{dados.alunos.slice(0, 8).map(aluno => <div key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '.65rem 0', borderTop: '1px solid #30364a' }}><span>{aluno.nome}<small style={{ display: 'block', color: '#aeb5c6' }}>{aluno.plano_nome || 'Plano não informado'}</small></span><span style={{ color: '#aeb5c6', whiteSpace: 'nowrap' }}>{aluno.total_presencas} presenças</span></div>)}</section>
      </>}
      {!carregando && dados && aba === 'Alunos' && <section style={painel}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Alunos de {dados.academia.nome}</h2><div style={{ overflowX: 'auto' }}><table style={{ minWidth: 540, width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Nome','Matrícula','Plano','Presenças','Última presença'].map(t => <th key={t} style={th}>{t}</th>)}</tr></thead><tbody>{dados.alunos.map(a => <tr key={a.id}><td style={td}>{a.nome}</td><td style={td}>{a.status}</td><td style={td}>{a.plano_nome || '—'}</td><td style={td}>{a.total_presencas}</td><td style={td}>{a.ultima_presenca ? formatarDataBrasil(a.ultima_presenca) : '—'}</td></tr>)}</tbody></table></div></section>}
      {!carregando && dados && aba === 'Frequência' && <section style={{ ...painel, maxWidth: 760 }}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Registrar presença na academia</h2><form onSubmit={registrarPresenca} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '.8rem', alignItems: 'end' }}><label style={label}>Aluno<select required style={control} value={alunoId} onChange={e => setAlunoId(e.target.value)}><option value="">Selecione um aluno</option>{dados.alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label><label style={label}>Data<input required type="date" max={dataEmSaoPaulo(new Date())} style={control} value={data} onChange={e => setData(e.target.value)} /></label><button type="submit" disabled={!alunoId || salvando} style={{ ...control, background: '#635bfc', border: 0, fontWeight: 700 }}>{salvando ? 'Registrando…' : '✓ Registrar presença'}</button></form></section>}
      {!carregando && dados && modulo[aba] && <ModuloGestao key={`${dados.academia.owner_id}-${aba}`} modoProfessor tipo={modulo[aba]!} userId={dados.academia.owner_id} alunos={dados.alunos.map(a => ({ id: a.id, nome: a.nome, status: a.status }))} />}
    </main>
  </div>;
}
