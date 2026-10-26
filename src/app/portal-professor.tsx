'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { formatarDataBrasil } from '@/lib/alunos';
import { ModuloGestao, type AlunoResumo, type TipoModulo } from './modulos';

interface AlunoProfessor extends AlunoResumo {
  plano_nome: string | null;
  graduacao: string | null;
  total_presencas: number;
  presencas_mes: number;
  ultima_presenca: string | null;
}

const menu = [
  { nome: 'Início', icone: '🏠' }, { nome: 'Alunos', icone: '👤' }, { nome: 'Frequência', icone: '📅' },
  { nome: 'Exercícios', icone: '🏋️' }, { nome: 'Treinos', icone: '🏃' }, { nome: 'Nutrição', icone: '🥣' }
];
const modulo: Partial<Record<string, TipoModulo>> = { Exercícios: 'exercicio', Treinos: 'treino', Nutrição: 'nutricao' };
const painel: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.2rem' };
const control: React.CSSProperties = { minHeight: 42, padding: '.65rem', borderRadius: 7, border: '1px solid #3a3f55', background: '#13151f', color: '#fff' };

export function PortalProfessor({ ownerId, nome, onSair }: { ownerId: string; nome: string; onSair: () => void }) {
  const [aba, setAba] = useState('Início');
  const [alunos, setAlunos] = useState<AlunoProfessor[]>([]);
  const [alunoId, setAlunoId] = useState('');
  const [data, setData] = useState(() => dataEmSaoPaulo(new Date()));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data: resultado, error } = await supabase.rpc('professor_listar_alunos');
    if (error) {
      setAlunos([]);
      setErro(error.message.includes('inativa') ? 'Esta conta de professor está desativada. Peça ao responsável pela academia para reativá-la.' : `Não foi possível abrir o portal: ${error.message}. Confirme a migração de professores no Supabase.`);
    } else {
      const lista = (resultado || []) as AlunoProfessor[];
      setAlunos(lista);
      setErro('');
      if (!lista.some(a => a.id === alunoId)) setAlunoId(lista[0]?.id || '');
    }
    setCarregando(false);
  }, [alunoId]);

  useEffect(() => {
    // O carregamento consulta o Supabase e atualiza o estado após a resposta assíncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const ativos = useMemo(() => alunos.filter(a => a.status === 'Ativo').length, [alunos]);
  const presencasMes = useMemo(() => alunos.reduce((total, a) => total + Number(a.presencas_mes || 0), 0), [alunos]);

  async function registrarPresenca(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setMensagem(''); setSalvando(true);
    const { error } = await supabase.rpc('professor_registrar_presenca', { p_aluno_id: alunoId, p_data: data });
    setSalvando(false);
    if (error) setErro(error.message);
    else { setMensagem('Presença registrada.'); await carregar(); }
  }

  return <div className="fit-shell" style={{ minHeight: '100vh', background: '#13151f', color: '#fff', fontFamily: 'sans-serif' }}>
    <aside className="fit-sidebar" style={{ background: '#1a1d2b', borderRight: '1px solid #24283b', padding: '1.2rem .8rem', gap: '.4rem' }}>
      <div className="fit-sidebar-top"><h2 className="fit-brand" style={{ paddingLeft: '.8rem', fontSize: '1.2rem' }}>Área do professor</h2><button type="button" className="fit-signout-mobile" onClick={onSair}>Sair</button></div>
      <nav className="fit-nav" aria-label="Menu do professor">{menu.map(item => <button key={item.nome} type="button" aria-current={aba === item.nome ? 'page' : undefined} onClick={() => { setAba(item.nome); setErro(''); setMensagem(''); }} style={{ display: 'flex', gap: '.65rem', alignItems: 'center', padding: '.7rem .9rem', border: 0, borderRadius: 8, background: aba === item.nome ? '#635bfc' : 'transparent', color: aba === item.nome ? '#fff' : '#aeb5c6', textAlign: 'left', cursor: 'pointer' }}><span>{item.icone}</span>{item.nome}</button>)}</nav>
      <div className="fit-sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid #24283b', paddingTop: '1rem' }}><button type="button" onClick={onSair} style={{ width: '100%', padding: '.65rem', color: '#ff8585', background: 'transparent', border: '1px solid #3a3f55', borderRadius: 7, cursor: 'pointer' }}>Sair da conta</button></div>
    </aside>
    <main className="fit-main" style={{ display: 'grid', alignContent: 'start', gap: '1rem' }}>
      <header style={{ ...painel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><small style={{ color: '#a9a3ff' }}>FITGESTÃO · ACESSO OPERACIONAL</small><h1 style={{ margin: '.35rem 0 0', fontSize: '1.35rem' }}>{aba === 'Início' ? `Olá, ${nome || 'professor(a)'}` : aba}</h1></div><span style={{ color: '#aeb5c6', fontSize: '.88rem' }}>Acesso sem módulos financeiros</span></header>
      {erro && <div role="alert" style={{ ...painel, borderColor: '#7f1d1d', color: '#fecaca' }}>{erro}</div>}
      {mensagem && <div role="status" style={{ ...painel, borderColor: '#166534', color: '#bbf7d0' }}>{mensagem}</div>}
      {carregando && <div style={painel}>Carregando dados…</div>}
      {!carregando && !erro && aba === 'Início' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '.8rem' }}>
          {[['Alunos cadastrados', alunos.length], ['Matrículas ativas', ativos], ['Presenças neste mês', presencasMes]].map(([label, valor]) => <div key={String(label)} style={painel}><small style={{ color: '#aeb5c6' }}>{label}</small><strong style={{ display: 'block', fontSize: '1.7rem', marginTop: '.4rem' }}>{valor}</strong></div>)}
        </div>
        <section style={painel}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Alunos recentes</h2>{alunos.slice(0, 8).map(aluno => <div key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '.65rem 0', borderTop: '1px solid #30364a' }}><span>{aluno.nome}<small style={{ display: 'block', color: '#aeb5c6' }}>{aluno.plano_nome || 'Plano não informado'}</small></span><span style={{ color: '#aeb5c6', whiteSpace: 'nowrap' }}>{aluno.total_presencas} presenças</span></div>)}{!alunos.length && <p style={{ color: '#aeb5c6' }}>Ainda não há alunos cadastrados.</p>}</section>
      </>}
      {!carregando && !erro && aba === 'Alunos' && <section style={painel}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Alunos da academia</h2><div style={{ overflowX: 'auto' }}><table style={{ minWidth: 540, width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Nome','Matrícula','Plano','Presenças','Última presença'].map(t => <th key={t} style={th}>{t}</th>)}</tr></thead><tbody>{alunos.map(a => <tr key={a.id}><td style={td}>{a.nome}</td><td style={td}>{a.status}</td><td style={td}>{a.plano_nome || '—'}</td><td style={td}>{a.total_presencas}</td><td style={td}>{a.ultima_presenca ? formatarDataBrasil(a.ultima_presenca) : '—'}</td></tr>)}</tbody></table></div></section>}
      {!carregando && !erro && aba === 'Frequência' && <section style={{ ...painel, maxWidth: 760 }}><h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Registrar presença</h2><form onSubmit={registrarPresenca} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '.8rem', alignItems: 'end' }}><label style={label}>Aluno<select required style={control} value={alunoId} onChange={e => setAlunoId(e.target.value)}><option value="">Selecione um aluno</option>{alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label><label style={label}>Data<input required type="date" max={dataEmSaoPaulo(new Date())} style={control} value={data} onChange={e => setData(e.target.value)} /></label><button type="submit" disabled={!alunoId || salvando} style={{ ...control, background: '#635bfc', border: 0, fontWeight: 700 }}>{salvando ? 'Registrando…' : '✓ Registrar presença'}</button></form></section>}
      {!carregando && !erro && modulo[aba] && <ModuloGestao tipo={modulo[aba]!} userId={ownerId} alunos={alunos.map(a => ({ id: String(a.id), nome: a.nome, status: a.status, telefone: '' })) as AlunoResumo[]} />}
    </main>
  </div>;
}

const label: React.CSSProperties = { display: 'grid', gap: '.4rem', color: '#cbd5e1', fontSize: '.87rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '.7rem', color: '#aeb5c6', borderBottom: '1px solid #34394c' };
const td: React.CSSProperties = { padding: '.7rem', borderBottom: '1px solid #292e40' };
