'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { csvSeguro } from '@/lib/alunos';
import { dataEmSaoPaulo, situacaoPagamento } from '@/lib/faturamento';
import { supabase } from '@/lib/supabase';

type TipoLancamento = 'entrada' | 'saida';
type SituacaoLancamento = 'pendente' | 'pago';
type CategoriaLancamento = { id: string; user_id: string; tipo: TipoLancamento; descricao: string; categoria: string; valor: number; vencimento: string; data_pagamento: string | null; status: SituacaoLancamento; forma_pagamento: string; aluno_id: string | null; observacoes: string; criado_em: string };
type AlunoFinanceiro = { id?: string | number; nome: string; status: 'Ativo' | 'Inativo'; valor_mensalidade?: number; dia_vencimento?: number; proximo_vencimento?: string | null; status_pagamento?: 'Em Dia' | 'Pendente' | 'Atrasado'; fim_plano?: string | null };
type PagamentoFinanceiro = { id: number; aluno_id: string; valor: number; competencia: string };
type VendaFinanceira = { id: string; valor_total: number; data_venda: string; produto_nome?: string; aluno_nome?: string; quantidade?: number | null; custo_unitario?: number | null };
type LinhaFinanceira = { id: string; tipo: TipoLancamento; descricao: string; categoria: string; valor: number; data: string; situacao: SituacaoLancamento; origem: string; aluno: string; forma: string; custo?: number | null; lucroBruto?: number | null; editavel?: CategoriaLancamento };

const categoriasEntrada = ['Outras receitas', 'Matrícula', 'Aula avulsa', 'Aluguel de espaço', 'Patrocínio', 'Outros'];
const categoriasSaida = ['Aluguel', 'Salários e encargos', 'Água, luz e internet', 'Equipamentos', 'Manutenção', 'Materiais', 'Marketing', 'Impostos e taxas', 'Limpeza', 'Outros'];
const formasPagamento = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Outro'];
const painel: CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.25rem', minWidth: 0 };
const campo: CSSProperties = { width: '100%', minHeight: 42, padding: '0.65rem 0.75rem', border: '1px solid #3a3f55', borderRadius: 7, background: '#13151f', color: '#fff', font: 'inherit' };
const botao: CSSProperties = { minHeight: 40, padding: '0.55rem 0.8rem', border: '1px solid #3a3f55', borderRadius: 7, background: '#13151f', color: '#fff', cursor: 'pointer', font: 'inherit' };
const reais = (valor: number) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const chaveMes = (data: Date) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
const dataBrasil = (data: string) => data ? data.slice(0, 10).split('-').reverse().join('/') : '—';
const dataHoje = () => dataEmSaoPaulo(new Date());

function somar(valores: number[]) { return valores.reduce((total, valor) => total + Number(valor || 0), 0); }

function adicionarMeses(data: string, quantidade: number) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const destino = new Date(ano, mes - 1 + quantidade, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

export function Financeiro({
  userId, alunos, pagamentos, vendas, erroVendas, mes, onMesChange
}: {
  userId: string;
  alunos: AlunoFinanceiro[];
  pagamentos: PagamentoFinanceiro[];
  vendas: VendaFinanceira[];
  erroVendas?: string | null;
  mes: Date;
  onMesChange: (mes: Date) => void;
}) {
  const [lancamentos, setLancamentos] = useState<CategoriaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [tipo, setTipo] = useState<TipoLancamento>('saida');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Aluguel');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(dataHoje());
  const [situacao, setSituacao] = useState<SituacaoLancamento>('pendente');
  const [dataPagamento, setDataPagamento] = useState(dataHoje());
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [alunoId, setAlunoId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [repetirMeses, setRepetirMeses] = useState(1);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoLancamento>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | SituacaoLancamento>('todos');
  const [busca, setBusca] = useState('');

  const carregarLancamentos = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('gestao_lancamentos_financeiros').select('*')
      .eq('user_id', userId).order('vencimento', { ascending: false });
    if (error) {
      setErro(`Não foi possível carregar lançamentos manuais. Execute a migração 20260928_controle_financeiro.sql no Supabase. Detalhe: ${error.message}`);
      setLancamentos([]);
    } else {
      setErro('');
      setLancamentos((data || []) as CategoriaLancamento[]);
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregarLancamentos(); }, 0);
    return () => window.clearTimeout(timer);
  }, [carregarLancamentos]);

  const mesChave = chaveMes(mes);
  const hoje = dataHoje();
  const mapaAlunos = useMemo(() => new Map(alunos.filter(a => a.id != null).map(a => [String(a.id), a])), [alunos]);
  const alunosPagosNoMes = useMemo(() => new Set(pagamentos.filter(p => p.competencia.startsWith(mesChave)).map(p => String(p.aluno_id))), [pagamentos, mesChave]);

  const linhas = useMemo<LinhaFinanceira[]>(() => {
    const automaticas: LinhaFinanceira[] = [
      ...pagamentos.filter(p => p.competencia.startsWith(mesChave)).map(p => ({
        id: `pagamento-${p.id}`, tipo: 'entrada' as const, descricao: `Mensalidade · ${mapaAlunos.get(String(p.aluno_id))?.nome || 'Aluno'}`,
        categoria: 'Mensalidades', valor: Number(p.valor), data: p.competencia.slice(0, 10), situacao: 'pago' as const,
        origem: 'Pagamento de aluno', aluno: mapaAlunos.get(String(p.aluno_id))?.nome || '—', forma: '—'
      })),
      ...vendas.filter(v => v.data_venda.startsWith(mesChave)).map(v => {
        const custo = v.custo_unitario == null ? null : Number(v.custo_unitario) * Number(v.quantidade || 1);
        return {
          id: `venda-${v.id}`, tipo: 'entrada' as const, descricao: v.produto_nome || 'Venda de produto',
          categoria: 'Vendas', valor: Number(v.valor_total), data: v.data_venda, situacao: 'pago' as const,
          origem: 'Venda', aluno: v.aluno_nome || '—', forma: '—', custo,
          lucroBruto: custo === null ? null : Number(v.valor_total) - custo
        };
      })
    ];
    const manuais: LinhaFinanceira[] = lancamentos.filter(l => {
      const data = l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento;
      return data.startsWith(mesChave);
    }).map(l => ({
      id: `manual-${l.id}`, tipo: l.tipo, descricao: l.descricao, categoria: l.categoria, valor: Number(l.valor),
      data: l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento, situacao: l.status,
      origem: 'Lançamento manual', aluno: l.aluno_id ? mapaAlunos.get(String(l.aluno_id))?.nome || 'Aluno removido' : '—',
      forma: l.forma_pagamento || '—', editavel: l
    }));
    return [...automaticas, ...manuais].sort((a, b) => b.data.localeCompare(a.data));
  }, [pagamentos, vendas, lancamentos, mesChave, mapaAlunos]);

  const resumo = useMemo(() => {
    const entradas = somar(linhas.filter(l => l.tipo === 'entrada' && l.situacao === 'pago').map(l => l.valor));
    const saidas = somar(linhas.filter(l => l.tipo === 'saida' && l.situacao === 'pago').map(l => l.valor));
    const receberManual = somar(lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pendente' && l.vencimento.startsWith(mesChave)).map(l => Number(l.valor)));
    const pagar = somar(lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pendente' && l.vencimento.startsWith(mesChave)).map(l => Number(l.valor)));
    const mensalidadesAReceber = mesChave === hoje.slice(0, 7)
      ? somar(alunos.filter(a => a.status === 'Ativo' && a.id != null && !alunosPagosNoMes.has(String(a.id))).map(a => Number(a.valor_mensalidade || 0)))
      : 0;
    const vendasDoMes = vendas.filter(v => v.data_venda.startsWith(mesChave));
    const vendasComCusto = vendasDoMes.filter(v => v.custo_unitario != null);
    const lucroVendas = somar(vendasComCusto.map(v => Number(v.valor_total) - Number(v.custo_unitario) * Number(v.quantidade || 1)));
    const atrasados = lancamentos.filter(l => l.status === 'pendente' && l.vencimento < hoje);
    const atrasoTotal = somar(atrasados.map(l => Number(l.valor))) + (mesChave === hoje.slice(0, 7)
      ? somar(alunos.filter(a => a.status === 'Ativo' && a.id != null && situacaoPagamento(a, alunosPagosNoMes, hoje) === 'Atrasado').map(a => Number(a.valor_mensalidade || 0))) : 0);
    const potencial = somar(alunos.filter(a => a.status === 'Ativo').map(a => Number(a.valor_mensalidade || 0)));
    return { entradas, saidas, saldo: entradas - saidas, receber: receberManual + mensalidadesAReceber, pagar, atrasoTotal, potencial, lucroVendas, vendasSemCusto: vendasDoMes.length - vendasComCusto.length };
  }, [linhas, lancamentos, alunos, vendas, mesChave, hoje, alunosPagosNoMes]);

  const ultimosMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const data = new Date(mes.getFullYear(), mes.getMonth() - 5 + i, 1);
    const chave = chaveMes(data);
    const recebimentos = somar(pagamentos.filter(p => p.competencia.startsWith(chave)).map(p => Number(p.valor))) +
      somar(vendas.filter(v => v.data_venda.startsWith(chave)).map(v => Number(v.valor_total))) +
      somar(lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago' && (l.data_pagamento || l.vencimento).startsWith(chave)).map(l => Number(l.valor)));
    const despesas = somar(lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago' && (l.data_pagamento || l.vencimento).startsWith(chave)).map(l => Number(l.valor)));
    return { chave, rotulo: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), recebimentos, despesas };
  }), [mes, pagamentos, vendas, lancamentos]);
  const tetoGrafico = Math.max(1, ...ultimosMeses.flatMap(m => [m.recebimentos, m.despesas]));

  const categorias = useMemo(() => {
    const totais = new Map<string, number>();
    linhas.filter(l => l.tipo === 'saida' && l.situacao === 'pago').forEach(l => totais.set(l.categoria || 'Outros', (totais.get(l.categoria || 'Outros') || 0) + l.valor));
    return [...totais.entries()].sort((a, b) => b[1] - a[1]);
  }, [linhas]);

  const linhasFiltradas = linhas.filter(l => {
    const texto = `${l.descricao} ${l.categoria} ${l.aluno}`.toLocaleLowerCase('pt-BR');
    return (filtroTipo === 'todos' || l.tipo === filtroTipo) && (filtroStatus === 'todos' || l.situacao === filtroStatus) && (!busca.trim() || texto.includes(busca.trim().toLocaleLowerCase('pt-BR')));
  });

  function limparFormulario() {
    setEditandoId(null); setDescricao(''); setValor(''); setObservacoes(''); setAlunoId(''); setSituacao('pendente');
    setVencimento(dataHoje()); setDataPagamento(dataHoje()); setRepetirMeses(1);
    setCategoria(tipo === 'saida' ? 'Outros' : 'Outras receitas');
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const quantia = Number(valor);
    if (!descricao.trim() || !Number.isFinite(quantia) || quantia <= 0 || !vencimento) {
      setErro('Preencha descrição, valor positivo e vencimento.'); return;
    }
    if (situacao === 'pago' && !dataPagamento) { setErro('Informe a data de pagamento.'); return; }
    setSalvando(true); setErro(''); setAviso('');
    const base = { user_id: userId, tipo, descricao: descricao.trim(), categoria: categoria.trim() || 'Outros', valor: quantia,
      vencimento, data_pagamento: situacao === 'pago' ? dataPagamento : null, status: situacao, forma_pagamento: formaPagamento,
      aluno_id: alunoId || null, observacoes: observacoes.trim() };
    const resposta = editandoId
      ? await supabase.from('gestao_lancamentos_financeiros').update(base).eq('id', editandoId).eq('user_id', userId).select('id')
      : await supabase.from('gestao_lancamentos_financeiros').insert(Array.from({ length: repetirMeses }, (_, i) => ({
        ...base, vencimento: adicionarMeses(vencimento, i), data_pagamento: i === 0 ? base.data_pagamento : null,
        status: i === 0 ? situacao : 'pendente'
      }))).select('id');
    setSalvando(false);
    if (resposta.error || !resposta.data?.length) { setErro(`Não foi possível salvar: ${resposta.error?.message || 'nenhuma linha foi confirmada.'}`); return; }
    setAviso(editandoId ? 'Lançamento atualizado.' : `${resposta.data.length} lançamento(s) salvo(s).`);
    limparFormulario();
    await carregarLancamentos();
  }

  function editar(lancamento: CategoriaLancamento) {
    setEditandoId(lancamento.id); setTipo(lancamento.tipo); setDescricao(lancamento.descricao); setCategoria(lancamento.categoria);
    setValor(String(lancamento.valor)); setVencimento(lancamento.vencimento); setSituacao(lancamento.status);
    setDataPagamento(lancamento.data_pagamento || dataHoje()); setFormaPagamento(lancamento.forma_pagamento || 'Pix');
    setAlunoId(lancamento.aluno_id || ''); setObservacoes(lancamento.observacoes || ''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function marcarPago(lancamento: CategoriaLancamento) {
    const { error } = await supabase.from('gestao_lancamentos_financeiros').update({ status: 'pago', data_pagamento: dataHoje() })
      .eq('id', lancamento.id).eq('user_id', userId);
    if (error) setErro(`Não foi possível dar baixa: ${error.message}`);
    else { setAviso('Pagamento registrado.'); await carregarLancamentos(); }
  }

  async function excluir(lancamento: CategoriaLancamento) {
    if (!window.confirm(`Excluir o lançamento “${lancamento.descricao}”?`)) return;
    const { error } = await supabase.from('gestao_lancamentos_financeiros').delete().eq('id', lancamento.id).eq('user_id', userId);
    if (error) setErro(`Não foi possível excluir: ${error.message}`); else { setAviso('Lançamento excluído.'); await carregarLancamentos(); }
  }

  function baixarCsv() {
    const tabela = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Custo do produto', 'Lucro bruto', 'Situação', 'Origem', 'Aluno', 'Forma de pagamento'], ...linhasFiltradas.map(l => [
      dataBrasil(l.data), l.tipo === 'entrada' ? 'Entrada' : 'Saída', l.descricao, l.categoria, l.valor.toFixed(2).replace('.', ','),
      l.custo == null ? '' : l.custo.toFixed(2).replace('.', ','),
      l.lucroBruto == null ? '' : l.lucroBruto.toFixed(2).replace('.', ','),
      l.situacao === 'pago' ? 'Pago' : 'Pendente', l.origem, l.aluno, l.forma
    ])].map(linha => linha.map(csvSeguro).join(';')).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', tabela], { type: 'text/csv;charset=utf-8' }));
    link.download = `financeiro_${mesChave}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  const controleMes = (delta: number) => onMesChange(new Date(mes.getFullYear(), mes.getMonth() + delta, 1));
  const rotuloMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const categoriasFormulario = tipo === 'saida' ? categoriasSaida : categoriasEntrada;

  return <div className="fin-page">
    <header className="fin-header" style={painel}>
      <div><h2 style={{ margin: 0 }}>Controle financeiro</h2><p style={{ color: '#aeb5c6', margin: '0.35rem 0 0' }}>Receitas, despesas, contas a pagar e a receber da academia.</p></div>
      <div className="fin-month"><button style={botao} onClick={() => controleMes(-1)}>◀ Mês anterior</button><strong>{rotuloMes.toLocaleUpperCase('pt-BR')}</strong><button style={botao} onClick={() => controleMes(1)}>Próximo mês ▶</button></div>
    </header>

    {erro && <div role="alert" className="fin-alert">{erro}</div>}
    {erroVendas && <div role="alert" className="fin-alert">{erroVendas}</div>}
    {aviso && <div role="status" className="fin-success">{aviso}</div>}
    <p className="fin-note">Mensalidades e vendas de produtos entram automaticamente. Cadastre aqui despesas e outras receitas para evitar duplicidade.</p>

    <section className="fin-kpis">
      {[
        ['Entradas recebidas', reais(resumo.entradas), '#22c55e', 'Mensalidades, vendas e outras entradas pagas'],
        ['Despesas pagas', reais(resumo.saidas), '#fb7185', 'Saídas registradas no mês'],
        ['Saldo do mês', reais(resumo.saldo), resumo.saldo >= 0 ? '#22c55e' : '#fb7185', 'Entradas recebidas menos despesas pagas'],
        ['A receber', reais(resumo.receber), '#60a5fa', 'Parcelas pendentes e mensalidades não baixadas'],
        ['A pagar', reais(resumo.pagar), '#fbbf24', 'Despesas pendentes com vencimento no mês'],
        ['Em atraso', reais(resumo.atrasoTotal), '#f87171', 'Mensalidades e lançamentos vencidos em aberto'],
        ['Lucro bruto das vendas', reais(resumo.lucroVendas), '#34d399', resumo.vendasSemCusto ? `${resumo.vendasSemCusto} venda(s) sem custo informado; lucro parcial` : 'Vendas menos custos cadastrados']
      ].map(([titulo, valorCard, cor, descricaoCard]) => <article key={titulo} style={painel}>
        <small style={{ color: '#aeb5c6' }}>{titulo}</small><strong style={{ display: 'block', margin: '0.5rem 0', fontSize: '1.55rem', color: cor }}>{valorCard}</strong><small style={{ color: '#8a8f9d' }}>{descricaoCard}</small>
      </article>)}
    </section>

    <section className="fin-grid">
      <article style={painel}>
        <h3 style={{ marginTop: 0 }}>{editandoId ? 'Editar lançamento' : 'Novo lançamento'}</h3>
        <form onSubmit={salvar} className="fin-form">
          <div className="fin-type"><button type="button" onClick={() => { setTipo('entrada'); setCategoria('Outras receitas'); }} aria-pressed={tipo === 'entrada'} className={tipo === 'entrada' ? 'fin-type-active' : ''}>＋ Entrada extra</button><button type="button" onClick={() => { setTipo('saida'); setCategoria('Outros'); }} aria-pressed={tipo === 'saida'} className={tipo === 'saida' ? 'fin-type-active' : ''}>− Despesa</button></div>
          <label className="fin-label">Descrição *<input style={campo} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={140} required placeholder="Ex.: conta de energia" /></label>
          <div className="fin-form-row"><label className="fin-label">Categoria<select style={campo} value={categoria} onChange={e => setCategoria(e.target.value)}>{categoriasFormulario.map(c => <option key={c}>{c}</option>)}</select></label><label className="fin-label">Valor (R$) *<input style={campo} type="number" min="0.01" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required placeholder="0,00" /></label></div>
          <div className="fin-form-row"><label className="fin-label">Vencimento *<input style={campo} type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} required /></label><label className="fin-label">Situação<select style={campo} value={situacao} onChange={e => setSituacao(e.target.value as SituacaoLancamento)}><option value="pendente">Pendente</option><option value="pago">Pago</option></select></label></div>
          {situacao === 'pago' && <div className="fin-form-row"><label className="fin-label">Data do pagamento *<input style={campo} type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} required /></label><label className="fin-label">Forma de pagamento<select style={campo} value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>{formasPagamento.map(f => <option key={f}>{f}</option>)}</select></label></div>}
          {tipo === 'entrada' && <label className="fin-label">Vincular aluno (opcional)<select style={campo} value={alunoId} onChange={e => setAlunoId(e.target.value)}><option value="">Sem aluno vinculado</option>{alunos.map(a => a.id != null && <option key={a.id} value={String(a.id)}>{a.nome}</option>)}</select></label>}
          {!editandoId && <label className="fin-label">Repetir mensalmente<select style={campo} value={repetirMeses} onChange={e => setRepetirMeses(Number(e.target.value))}><option value={1}>Não repetir</option><option value={3}>Próximos 3 meses</option><option value={6}>Próximos 6 meses</option><option value={12}>Próximos 12 meses</option></select></label>}
          <label className="fin-label">Observações<textarea style={{ ...campo, minHeight: 74, resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} maxLength={500} placeholder="Detalhes adicionais (opcional)" /></label>
          <div className="fin-actions"><button type="submit" disabled={salvando} style={{ ...botao, background: '#635bfc', borderColor: '#635bfc', fontWeight: 700 }}>{salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Salvar lançamento'}</button>{editandoId && <button type="button" onClick={limparFormulario} style={botao}>Cancelar edição</button>}</div>
        </form>
      </article>

      <article style={painel}>
        <h3 style={{ margin: '0 0 0.35rem' }}>Fluxo de caixa · últimos 6 meses</h3><p style={{ color: '#aeb5c6', marginTop: 0, fontSize: '0.85rem' }}>Comparação entre valores pagos. Entradas incluem pagamentos e vendas.</p>
        <div className="fin-chart">{ultimosMeses.map(m => <div className="fin-chart-col" key={m.chave} title={`${m.rotulo}: entradas ${reais(m.recebimentos)}, despesas ${reais(m.despesas)}`}>
          <div className="fin-chart-bars"><span className="fin-bar-in" style={{ height: `${Math.max(m.recebimentos ? 5 : 0, m.recebimentos / tetoGrafico * 100)}%` }} /><span className="fin-bar-out" style={{ height: `${Math.max(m.despesas ? 5 : 0, m.despesas / tetoGrafico * 100)}%` }} /></div><small>{m.rotulo}</small>
        </div>)}</div>
        <div className="fin-legend"><span><i className="fin-bar-in" />Entradas</span><span><i className="fin-bar-out" />Despesas</span></div>
        <h3 style={{ margin: '1.5rem 0 0.6rem' }}>Despesas por categoria</h3>
        {categorias.length === 0 ? <p style={{ color: '#8a8f9d' }}>Nenhuma despesa paga neste mês.</p> : categorias.slice(0, 6).map(([nome, total]) => <div className="fin-category" key={nome}><div><span>{nome}</span><strong>{reais(total)}</strong></div><div className="fin-track"><i style={{ width: `${Math.min(100, total / Math.max(1, resumo.saidas) * 100)}%` }} /></div></div>)}
        <div className="fin-potential"><span>Potencial recorrente mensal dos alunos ativos</span><strong>{reais(resumo.potencial)}</strong></div>
      </article>
    </section>

    <section style={painel}>
      <div className="fin-list-header"><div><h3 style={{ margin: 0 }}>Movimentações do mês</h3><p style={{ color: '#aeb5c6', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>Lançamentos automáticos e manuais. Mensalidades e vendas automáticas não podem ser editadas aqui.</p></div><button style={botao} onClick={baixarCsv}>Baixar CSV</button></div>
      <div className="fin-filters"><input style={campo} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição, categoria ou aluno" /><select style={campo} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}><option value="todos">Entradas e saídas</option><option value="entrada">Entradas</option><option value="saida">Despesas</option></select><select style={campo} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}><option value="todos">Pagos e pendentes</option><option value="pago">Pagos</option><option value="pendente">Pendentes</option></select></div>
      {carregando ? <p style={{ color: '#aeb5c6' }}>Carregando movimentações…</p> : linhasFiltradas.length === 0 ? <p style={{ color: '#aeb5c6' }}>Nenhuma movimentação encontrada neste mês.</p> : <div className="fin-table-wrap"><table className="fin-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Aluno</th><th>Forma</th><th>Situação</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th></tr></thead><tbody>{linhasFiltradas.map(l => <tr key={l.id}>
        <td>{dataBrasil(l.data)}</td><td><span className={l.tipo === 'entrada' ? 'fin-pill-in' : 'fin-pill-out'}>{l.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td><td>{l.descricao}<small className="fin-source">{l.origem}</small>{l.custo !== undefined && <small className="fin-source">{l.custo === null ? 'Custo não informado · lucro indisponível' : `Custo ${reais(l.custo)} · lucro bruto ${reais(l.lucroBruto || 0)}`}</small>}</td><td>{l.categoria}</td><td>{l.aluno}</td><td>{l.forma}</td><td><span className={l.situacao === 'pago' ? 'fin-pill-paid' : 'fin-pill-pending'}>{l.situacao === 'pago' ? 'Pago' : 'Pendente'}</span></td><td className={l.tipo === 'entrada' ? 'fin-amount-in' : 'fin-amount-out'}>{l.tipo === 'entrada' ? '+' : '−'}{reais(l.valor)}</td><td>{l.editavel && <div className="fin-row-actions">{l.situacao === 'pendente' && <button style={botao} onClick={() => void marcarPago(l.editavel!)}>Dar baixa</button>}<button style={botao} onClick={() => editar(l.editavel!)}>Editar</button><button style={{ ...botao, color: '#fca5a5' }} onClick={() => void excluir(l.editavel!)}>Excluir</button></div>}</td>
      </tr>)}</tbody></table></div>}
    </section>
  </div>;
}
