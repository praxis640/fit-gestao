'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Unidade {
  id: string;
  user_id: string;
  nome: string;
  endereco: string;
  telefone: string;
  ativa: boolean;
}

interface AlunoUnidade {
  id?: string | number;
  nome: string;
  status: 'Ativo' | 'Inativo';
  unidade_id?: string | null;
  valor_mensalidade?: number;
}

interface PagamentoUnidade {
  aluno_id: string | number;
  valor: number;
  competencia: string;
}

interface FrequenciaUnidade {
  aluno_id: string | number;
  data: string;
}

interface Props {
  userId: string;
  unidades: Unidade[];
  alunos: AlunoUnidade[];
  pagamentos: PagamentoUnidade[];
  frequencias: FrequenciaUnidade[];
  hoje: string;
  onAtualizar: () => Promise<void>;
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cardStyle: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.2rem' };

function resumoUnidade(unidadeId: string | null, props: Props) {
  const alunos = props.alunos.filter(a => (a.unidade_id || null) === unidadeId);
  const ids = new Set(alunos.map(a => String(a.id)));
  const ativos = alunos.filter(a => a.status === 'Ativo');
  const recebimentos = props.pagamentos.filter(p => ids.has(String(p.aluno_id)) && p.competencia.startsWith(props.hoje.slice(0, 7)));
  const presencas = new Set(props.frequencias.filter(f => ids.has(String(f.aluno_id)) && f.data.slice(0, 7) === props.hoje.slice(0, 7)).map(f => `${f.aluno_id}-${f.data.slice(0, 10)}`));
  const adimplentes = new Set(recebimentos.map(p => String(p.aluno_id))).size;
  return {
    total: alunos.length,
    ativos: ativos.length,
    mensalidades: recebimentos.reduce((s, p) => s + Number(p.valor || 0), 0),
    presencas: presencas.size,
    pendentes: ativos.filter(a => !recebimentos.some(p => String(p.aluno_id) === String(a.id))).length,
    adimplencia: ativos.length ? Math.round(adimplentes / ativos.length * 100) : 0,
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div style={{ background: '#171a26', borderRadius: 10, padding: '0.9rem' }}><div style={{ color: '#a7aec0', fontSize: '0.78rem' }}>{label}</div><strong style={{ display: 'block', fontSize: '1.2rem', marginTop: '.3rem' }}>{value}</strong></div>;
}

export function Filiais(props: Props) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true); setErro(''); setMensagem('');
    const { error } = await supabase.from('gestao_unidades').insert({ user_id: props.userId, nome: nome.trim(), endereco: endereco.trim(), telefone: telefone.trim(), ativa: true });
    setSalvando(false);
    if (error) setErro(error.message.includes('duplicate') ? 'Já existe uma filial com esse nome.' : `Não foi possível cadastrar: ${error.message}`);
    else { setNome(''); setEndereco(''); setTelefone(''); setMensagem('Filial cadastrada.'); await props.onAtualizar(); }
  }

  async function alternar(unidade: Unidade) {
    const { error } = await supabase.from('gestao_unidades').update({ ativa: !unidade.ativa }).eq('id', unidade.id).eq('user_id', props.userId);
    if (error) setErro(`Não foi possível atualizar: ${error.message}`); else await props.onAtualizar();
  }

  return <section style={{ display: 'grid', gap: '1.2rem' }}>
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Filiais e unidades</h2>
      <p style={{ color: '#a7aec0' }}>Cadastre unidades da academia e acompanhe alunos, mensalidades recebidas, frequência e adimplência por local.</p>
      <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.8rem', alignItems: 'end' }}>
        <label>Nome da unidade *<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={100} placeholder="Ex.: Centro" style={inputStyle} /></label>
        <label>Endereço<input value={endereco} onChange={e => setEndereco(e.target.value)} maxLength={200} placeholder="Rua, bairro e cidade" style={inputStyle} /></label>
        <label>Telefone<input value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={30} placeholder="(00) 00000-0000" style={inputStyle} /></label>
        <button disabled={salvando} style={buttonStyle}>{salvando ? 'Salvando…' : '＋ Adicionar filial'}</button>
      </form>
      {erro && <p role="alert" style={{ color: '#fca5a5' }}>{erro}</p>}{mensagem && <p style={{ color: '#86efac' }}>{mensagem}</p>}
    </div>
    {props.unidades.map(unidade => {
      const resumo = resumoUnidade(unidade.id, props);
      return <article key={unidade.id} style={{ ...cardStyle, opacity: unidade.ativa ? 1 : .7 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
          <div><h3 style={{ margin: '0 0 .3rem' }}>{unidade.nome} {!unidade.ativa && <small>(inativa)</small>}</h3><span style={{ color: '#a7aec0' }}>{unidade.endereco || 'Endereço não informado'}{unidade.telefone ? ` · ${unidade.telefone}` : ''}</span></div>
          <button onClick={() => void alternar(unidade)} style={buttonStyle}>{unidade.ativa ? 'Desativar unidade' : 'Reativar unidade'}</button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: '.7rem', marginTop: '1rem' }}>
          <Metric label="Alunos" value={resumo.total} /><Metric label="Matrículas ativas" value={resumo.ativos} /><Metric label="Mensalidades recebidas no mês" value={moeda(resumo.mensalidades)} /><Metric label="Presenças no mês" value={resumo.presencas} /><Metric label="Adimplência" value={`${resumo.adimplencia}%`} /><Metric label="Ativos sem pagamento lançado" value={resumo.pendentes} />
        </div>
      </article>;
    })}
  </section>;
}

export function GestaoUnidades(props: Props) {
  const todosAlunos = props.alunos;
  const ids = new Set(todosAlunos.map(a => String(a.id)));
  const ativos = todosAlunos.filter(a => a.status === 'Ativo');
  const recebidos = props.pagamentos.filter(p => ids.has(String(p.aluno_id)) && p.competencia.startsWith(props.hoje.slice(0, 7)));
  const presencas = new Set(props.frequencias.filter(f => ids.has(String(f.aluno_id)) && f.data.slice(0, 7) === props.hoje.slice(0, 7)).map(f => `${f.aluno_id}-${f.data.slice(0, 10)}`)).size;
  const semUnidade = todosAlunos.filter(a => !a.unidade_id).length;
  const recebimentoTotal = recebidos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const pendentes = ativos.filter(a => !recebidos.some(p => String(p.aluno_id) === String(a.id))).length;
  const adimplencia = ativos.length ? Math.round((ativos.length - pendentes) / ativos.length * 100) : 0;
  return <section style={{ display: 'grid', gap: '1.2rem' }}>
    <div style={cardStyle}><h2 style={{ marginTop: 0 }}>Gestão geral da academia</h2><p style={{ color: '#a7aec0' }}>Resumo do mês atual e comparação entre unidades. “Recebido” considera pagamentos registrados neste mês.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.7rem' }}><Metric label="Alunos cadastrados" value={todosAlunos.length} /><Metric label="Matrículas ativas" value={ativos.length} /><Metric label="Mensalidades recebidas no mês" value={moeda(recebimentoTotal)} /><Metric label="Presenças no mês" value={presencas} /><Metric label="Adimplência registrada" value={`${adimplencia}%`} /><Metric label="Ativos sem pagamento lançado" value={pendentes} /></div>
    </div>
    {semUnidade > 0 && <div style={{ ...cardStyle, borderColor: '#b45309', color: '#fde68a' }}>{semUnidade} aluno(s) ainda sem unidade vinculada. Revise o cadastro para os indicadores por filial ficarem completos.</div>}
    <div style={cardStyle}><h3 style={{ marginTop: 0 }}>Comparativo por unidade</h3><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}><thead><tr>{['Unidade','Alunos','Ativos','Recebido no mês','Presenças','Adimplência','Sem baixa'].map(t => <th key={t} style={thStyle}>{t}</th>)}</tr></thead><tbody>{props.unidades.map(unidade => { const r = resumoUnidade(unidade.id, props); return <tr key={unidade.id} style={{ opacity: unidade.ativa ? 1 : .6 }}>{[unidade.nome + (unidade.ativa ? '' : ' (inativa)'), r.total, r.ativos, moeda(r.mensalidades), r.presencas, `${r.adimplencia}%`, r.pendentes].map((v, i) => <td key={i} style={tdStyle}>{v}</td>)}</tr>; })}<tr style={{ fontWeight: 700, background: '#171a26' }}>{['Geral', todosAlunos.length, ativos.length, moeda(recebimentoTotal), presencas, `${adimplencia}%`, pendentes].map((v, i) => <td key={i} style={tdStyle}>{v}</td>)}</tr></tbody></table></div></div>
    <div style={{ color: '#9299ab', fontSize: '.85rem' }}>Os indicadores são calculados a partir dos alunos, pagamentos e presenças registrados no FitGestão; despesas e vendas não estão incluídas neste resumo.</div>
  </section>;
}

const inputStyle: React.CSSProperties = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '.35rem', padding: '.7rem', borderRadius: 8, border: '1px solid #394057', background: '#171a26', color: '#fff' };
const buttonStyle: React.CSSProperties = { padding: '.7rem 1rem', borderRadius: 8, border: 0, background: '#5b63e6', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const thStyle: React.CSSProperties = { color: '#b8bfd0', textAlign: 'left', borderBottom: '1px solid #34394c', padding: '.75rem .6rem' };
const tdStyle: React.CSSProperties = { borderBottom: '1px solid #292e40', padding: '.75rem .6rem' };
