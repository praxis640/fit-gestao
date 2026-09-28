'use client';

import { useEffect, useMemo, useState } from 'react';
import { situacaoPagamento, vencimentoPlano, diasAteVencimento } from '@/lib/faturamento';
import { gerarPdfRelatorioAcademia, type BarraRelatorio, type SecaoRelatorio } from '@/lib/relatorio-pdf';
import { supabase } from '@/lib/supabase';

type AlunoRelatorio = { id?: string | number; nome: string; telefone?: string; data_nascimento?: string | null; status: 'Ativo' | 'Inativo'; plano_nome?: string; valor_mensalidade?: number; dia_vencimento?: number; status_pagamento?: 'Em Dia' | 'Pendente' | 'Atrasado'; criado_em?: string; fim_plano?: string | null };
type FrequenciaRelatorio = { aluno_id: string | number; data: string };
type PlanoRelatorio = { nome: string; duracao_dias: number; valor: number };
type PagamentoRelatorio = { id: number; aluno_id: string; valor: number; competencia: string };
type VendaRelatorio = { id: string; valor_total: number; data_venda: string; produto_nome?: string; categoria?: string; quantidade?: number; aluno_id?: string | null; aluno_nome?: string };
type RegistroOperacional = { id: string; tipo: string; titulo: string; categoria: string; detalhes: string; aluno_id: string | null; valor: number | null; quantidade: number; data_registro: string; criado_em: string };
type Lancamento = { id: string; tipo: 'entrada' | 'saida'; descricao: string; categoria: string; valor: number; vencimento: string; data_pagamento: string | null; status: 'pago' | 'pendente'; aluno_id: string | null; forma_pagamento: string };
type Faixa = 'mes' | '30' | '90' | 'ano' | 'tudo' | 'personalizado';

const card: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.1rem', minWidth: 0 };
const money = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (data: string) => data ? data.slice(0, 10).split('-').reverse().join('/') : '—';
const dataAnterior = (data: string, dias: number) => {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nomeMes = (data: string) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export function Relatorios({
  userId, academia, hoje, alunos, frequencias, planos, pagamentos, vendas
}: {
  userId: string;
  academia: string;
  hoje: string;
  alunos: AlunoRelatorio[];
  frequencias: FrequenciaRelatorio[];
  planos: PlanoRelatorio[];
  pagamentos: PagamentoRelatorio[];
  vendas: VendaRelatorio[];
}) {
  const [registros, setRegistros] = useState<RegistroOperacional[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [errosDados, setErrosDados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [faixa, setFaixa] = useState<Faixa>('mes');
  const [inicioPersonalizado, setInicioPersonalizado] = useState(`${hoje.slice(0, 7)}-01`);
  const [fimPersonalizado, setFimPersonalizado] = useState(hoje);

  useEffect(() => {
    let ativo = true;
    async function carregarComplementos() {
      setCarregando(true);
      const [resRegistros, resLancamentos] = await Promise.all([
        supabase.from('gestao_registros')
          .select('id,tipo,titulo,categoria,detalhes,aluno_id,valor,quantidade,data_registro,criado_em')
          .eq('user_id', userId).order('data_registro', { ascending: false }).range(0, 9999),
        supabase.from('gestao_lancamentos_financeiros')
          .select('id,tipo,descricao,categoria,valor,vencimento,data_pagamento,status,aluno_id,forma_pagamento')
          .eq('user_id', userId).order('vencimento', { ascending: false }).range(0, 9999)
      ]);
      if (!ativo) return;
      const erros: string[] = [];
      if (resRegistros.error) { erros.push('Módulos de exercício, treino e nutrição: execute a migração dos módulos operacionais.'); setRegistros([]); }
      else setRegistros((resRegistros.data || []) as RegistroOperacional[]);
      if (resLancamentos.error) { erros.push('Lançamentos manuais do financeiro indisponíveis; execute a migração do controle financeiro.'); setLancamentos([]); }
      else setLancamentos((resLancamentos.data || []) as Lancamento[]);
      setErrosDados(erros);
      setCarregando(false);
    }
    void carregarComplementos();
    return () => { ativo = false; };
  }, [userId]);

  const intervalo = useMemo(() => {
    if (faixa === 'personalizado') return { inicio: inicioPersonalizado, fim: fimPersonalizado };
    if (faixa === 'tudo') return { inicio: '0001-01-01', fim: hoje };
    if (faixa === 'mes') return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
    if (faixa === 'ano') return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje };
    return { inicio: dataAnterior(hoje, Number(faixa) - 1), fim: hoje };
  }, [faixa, hoje, inicioPersonalizado, fimPersonalizado]);

  const dados = useMemo(() => {
    const noPeriodo = (data?: string | null) => Boolean(data && data.slice(0, 10) >= intervalo.inicio && data.slice(0, 10) <= intervalo.fim);
    const ativos = alunos.filter((aluno) => aluno.status === 'Ativo');
    const pagosAtual = new Set(pagamentos.filter((p) => p.competencia.startsWith(hoje.slice(0, 7))).map((p) => String(p.aluno_id)));
    const situacoes = { emDia: 0, pendente: 0, atrasado: 0 };
    for (const aluno of ativos) {
      const s = situacaoPagamento(aluno, pagosAtual, hoje);
      if (s === 'Em Dia') situacoes.emDia += 1;
      else if (s === 'Pendente') situacoes.pendente += 1;
      else situacoes.atrasado += 1;
    }
    const vencimentos = ativos.map((aluno) => ({ aluno, dias: diasAteVencimento(vencimentoPlano(aluno, planos, hoje), hoje) }));
    const planosVencidos = vencimentos.filter((x) => x.dias < 0).length;
    const planosProximos = vencimentos.filter((x) => x.dias >= 0 && x.dias <= 7).length;
    const alunosNovos = alunos.filter((aluno) => noPeriodo(aluno.criado_em)).length;
    const frequenciasPeriodo = frequencias.filter((registro) => noPeriodo(registro.data));
    const presencasPorAluno = new Map<string, number>();
    for (const frequencia of frequenciasPeriodo) {
      const id = String(frequencia.aluno_id);
      presencasPorAluno.set(id, (presencasPorAluno.get(id) || 0) + 1);
    }
    const nomesAlunos = new Map(alunos.map((aluno) => [String(aluno.id), aluno.nome]));
    const pagamentosPeriodo = pagamentos.filter((p) => noPeriodo(p.competencia));
    const vendasPeriodo = vendas.filter((v) => noPeriodo(v.data_venda));
    const lancamentosPeriodo = lancamentos.filter((l) => noPeriodo(l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento));
    const receitasMensalidades = pagamentosPeriodo.reduce((s, p) => s + Number(p.valor || 0), 0);
    const receitaVendas = vendasPeriodo.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    const receitasExtrasPagas = lancamentosPeriodo.filter((l) => l.tipo === 'entrada' && l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    const despesasPagas = lancamentosPeriodo.filter((l) => l.tipo === 'saida' && l.status === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    const entradasPendentes = lancamentosPeriodo.filter((l) => l.tipo === 'entrada' && l.status === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
    const despesasPendentes = lancamentosPeriodo.filter((l) => l.tipo === 'saida' && l.status === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
    const receitaTotal = receitasMensalidades + receitaVendas + receitasExtrasPagas;
    const saldo = receitaTotal - despesasPagas;
    const vendasPorItem = new Map<string, { quantidade: number; valor: number }>();
    for (const venda of vendasPeriodo) {
      const chave = venda.produto_nome || 'Produto sem descrição';
      const existente = vendasPorItem.get(chave) || { quantidade: 0, valor: 0 };
      existente.quantidade += Number(venda.quantidade || 1);
      existente.valor += Number(venda.valor_total || 0);
      vendasPorItem.set(chave, existente);
    }
    const categoriasPlanos = new Map<string, number>();
    for (const aluno of ativos) {
      const nome = aluno.plano_nome || 'Plano não informado';
      categoriasPlanos.set(nome, (categoriasPlanos.get(nome) || 0) + 1);
    }
    const operacionaisPeriodo = registros.filter((r) => noPeriodo(r.data_registro || r.criado_em));
    const modulos = (['exercicio', 'treino', 'nutricao'] as const).map((tipo) => ({
      tipo,
      titulo: tipo === 'exercicio' ? 'Exercícios' : tipo === 'treino' ? 'Fichas de treino' : 'Rotinas de nutrição',
      registros: operacionaisPeriodo.filter((r) => r.tipo === tipo)
    }));
    const barrasPresenca: BarraRelatorio[] = [...presencasPorAluno.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, valor]) => ({ rotulo: nomesAlunos.get(id) || 'Aluno removido', valor, texto: `${valor} presença(s)`, cor: '#15a77a' }));
    const barrasPlanos: BarraRelatorio[] = [...categoriasPlanos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([rotulo, valor]) => ({ rotulo, valor, texto: `${valor} aluno(s)`, cor: '#635bfc' }));
    const barrasProdutos: BarraRelatorio[] = [...vendasPorItem.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, 6)
      .map(([rotulo, valor]) => ({ rotulo, valor: valor.valor, texto: money(valor.valor), cor: '#0d9ca6' }));
    const registrosPorTipo = modulos.map((m) => ({ ...m, alunos: new Set(m.registros.map((r) => r.aluno_id).filter(Boolean)).size }));

    return {
      ativos: ativos.length,
      inativos: alunos.length - ativos.length,
      alunosNovos,
      situacoes,
      planosVencidos,
      planosProximos,
      totalPresencas: frequenciasPeriodo.length,
      alunosPresentes: presencasPorAluno.size,
      pagamentosPeriodo,
      vendasPeriodo,
      receitasMensalidades,
      receitaVendas,
      receitasExtrasPagas,
      despesasPagas,
      entradasPendentes,
      despesasPendentes,
      receitaTotal,
      saldo,
      unidadesVendidas: vendasPeriodo.reduce((s, v) => s + Number(v.quantidade || 1), 0),
      ticketMedio: vendasPeriodo.length ? receitaVendas / vendasPeriodo.length : 0,
      lancamentosPeriodo,
      operacionaisPeriodo,
      registrosPorTipo,
      barrasPresenca,
      barrasPlanos,
      barrasProdutos,
      presencaMedia: ativos.length ? frequenciasPeriodo.length / ativos.length : 0
    };
  }, [alunos, frequencias, planos, pagamentos, vendas, lancamentos, registros, hoje, intervalo]);

  const secoes = useMemo<SecaoRelatorio[]>(() => {
    const linhasFinanceiras = [
      `Mensalidades registradas no período: ${money(dados.receitasMensalidades)} (${dados.pagamentosPeriodo.length} pagamento(s)).`,
      `Vendas de produtos: ${money(dados.receitaVendas)} em ${dados.vendasPeriodo.length} venda(s), ${dados.unidadesVendidas} unidade(s); ticket médio ${money(dados.ticketMedio)}.`,
      `Receitas extras pagas: ${money(dados.receitasExtrasPagas)}. Despesas pagas: ${money(dados.despesasPagas)}.`,
      `Contas pendentes cadastradas no período: ${money(dados.entradasPendentes)} a receber e ${money(dados.despesasPendentes)} a pagar.`,
      `Saldo operacional registrado: ${money(dados.saldo)} (receitas registradas menos despesas pagas).`
    ];
    const linhasAlunos = [
      `${dados.ativos} aluno(s) ativo(s) e ${dados.inativos} inativo(s); ${dados.alunosNovos} cadastro(s) no período.`,
      `Situação das mensalidades hoje: ${dados.situacoes.emDia} em dia, ${dados.situacoes.pendente} pendentes e ${dados.situacoes.atrasado} atrasados.`,
      `${dados.planosVencidos} plano(s) vencido(s) e ${dados.planosProximos} com vencimento nos próximos 7 dias.`
    ];
    const linhasVendas = dados.vendasPeriodo.length
      ? [`Vendas vinculadas a aluno: ${dados.vendasPeriodo.filter((v) => v.aluno_id || v.aluno_nome).length} de ${dados.vendasPeriodo.length}.`, ...dados.vendasPeriodo.slice(0, 5).map((v) => `${dataBr(v.data_venda)} · ${v.produto_nome || 'Produto'} · ${v.aluno_nome || 'Sem aluno vinculado'} · ${money(Number(v.valor_total || 0))}.`)]
      : ['Nenhuma venda registrada no período.'];
    const linhasModulos = dados.registrosPorTipo.map((item) => `${item.titulo}: ${item.registros.length} registro(s) no período${item.tipo !== 'exercicio' ? `, vinculados a ${item.alunos} aluno(s)` : ''}.`);
    const linhasDespesas = dados.lancamentosPeriodo.filter((l) => l.tipo === 'saida').slice(0, 6)
      .map((l) => `${dataBr(l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento)} · ${l.categoria || l.descricao} · ${money(Number(l.valor || 0))} · ${l.status === 'pago' ? 'pago' : 'pendente'}.`);
    return [
      { titulo: 'Alunos, planos e cobranças', linhas: linhasAlunos, barras: dados.barrasPlanos },
      { titulo: 'Financeiro', linhas: linhasFinanceiras },
      { titulo: 'Despesas cadastradas', linhas: linhasDespesas },
      { titulo: 'Frequência e participação', linhas: [`${dados.totalPresencas} presença(s) registradas; ${dados.alunosPresentes} aluno(s) compareceram ao menos uma vez.`, `Média de ${dados.presencaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} presença(s) por aluno ativo no período.`], barras: dados.barrasPresenca },
      { titulo: 'Vendas e produtos', linhas: linhasVendas, barras: dados.barrasProdutos },
      { titulo: 'Exercícios, treinos e nutrição', linhas: linhasModulos },
      { titulo: 'Cadastro de planos', linhas: planos.length ? planos.map((p) => `${p.nome}: ${p.duracao_dias} dia(s), valor de referência ${money(Number(p.valor || 0))}.`).slice(0, 8) : ['Nenhum plano cadastrado.'] }
    ];
  }, [dados, planos]);

  async function baixarPdf() {
    if (intervalo.inicio > intervalo.fim) { setMensagem('A data inicial precisa ser anterior à data final.'); return; }
    setGerando(true);
    setMensagem('');
    try {
      const emitidoEm = dataBr(hoje);
      const pdf = gerarPdfRelatorioAcademia({
        academia,
        periodo: `${dataBr(intervalo.inicio)} a ${dataBr(intervalo.fim)}`,
        emitidoEm,
        indicadores: [
          { titulo: 'Alunos ativos', valor: String(dados.ativos), detalhe: `${dados.inativos} inativos`, cor: '#635bfc' },
          { titulo: 'Presenças', valor: String(dados.totalPresencas), detalhe: `${dados.alunosPresentes} aluno(s)`, cor: '#0d9ca6' },
          { titulo: 'Receitas', valor: money(dados.receitaTotal), detalhe: 'valores pagos registrados', cor: '#15a77a' },
          { titulo: 'Saldo operacional', valor: money(dados.saldo), detalhe: 'receitas menos despesas pagas', cor: dados.saldo >= 0 ? '#15a77a' : '#d8495b' }
        ],
        secoes: [...secoes, { titulo: 'Observação metodológica', linhas: [
          'Os indicadores refletem apenas informações cadastradas no sistema e o intervalo escolhido.',
          'A situação de pagamento e os vencimentos de planos são uma fotografia da data de emissão; os pagamentos são agrupados pela competência registrada.',
          'Saldo operacional é um resumo dos lançamentos pagos cadastrados e não substitui escrituração contábil nem apura lucro ou impostos.'
        ] }]
      });
      const blob = new Blob([new Uint8Array(pdf)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${academia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${intervalo.inicio}-${intervalo.fim}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMensagem('Relatório PDF gerado e baixado.');
    } catch (error) {
      setMensagem(error instanceof Error ? `Não foi possível gerar o PDF: ${error.message}` : 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  }

  const periodoNome = faixa === 'mes' ? nomeMes(hoje) : `${dataBr(intervalo.inicio)} a ${dataBr(intervalo.fim)}`;
  return <div className="reports-page">
    <header className="reports-header" style={card}>
      <div><span className="reports-eyebrow">GESTÃO DA ACADEMIA</span><h2>Relatórios e resultados</h2><p>Consolide alunos, financeiro, frequência, vendas e módulos operacionais em um PDF pronto para apresentar.</p></div>
      <button className="reports-download" type="button" onClick={() => void baixarPdf()} disabled={carregando || gerando}>{gerando ? 'Preparando PDF…' : '⇩  Baixar relatório completo em PDF'}</button>
    </header>

    <section className="reports-controls" style={card}>
      <div><h3>Período do relatório</h3><p>Os dados e indicadores abaixo são recalculados conforme o intervalo.</p></div>
      <div className="reports-presets" role="group" aria-label="Selecionar período">
        {([['mes', 'Este mês'], ['30', '30 dias'], ['90', '90 dias'], ['ano', 'Este ano'], ['tudo', 'Todo o histórico'], ['personalizado', 'Personalizado']] as [Faixa, string][]).map(([value, label]) =>
          <button key={value} type="button" aria-pressed={faixa === value} className={faixa === value ? 'is-active' : ''} onClick={() => setFaixa(value)}>{label}</button>)}
      </div>
      {faixa === 'personalizado' && <div className="reports-date-fields">
        <label>De <input type="date" value={inicioPersonalizado} max={fimPersonalizado || undefined} onChange={(e) => setInicioPersonalizado(e.target.value)} /></label>
        <label>Até <input type="date" value={fimPersonalizado} min={inicioPersonalizado || undefined} onChange={(e) => setFimPersonalizado(e.target.value)} /></label>
      </div>}
      <div className="reports-period-summary"><span>Intervalo selecionado</span><strong>{periodoNome}</strong><span>{dados.pagamentosPeriodo.length} mensalidade(s) · {dados.vendasPeriodo.length} venda(s) · {dados.totalPresencas} presença(s)</span></div>
    </section>

    {errosDados.length > 0 && <div className="reports-warning" role="status"><b>Alguns dados podem não aparecer:</b> {errosDados.join(' ')}</div>}
    {mensagem && <div className="reports-message" role="status">{mensagem}</div>}
    {carregando ? <div style={card}>Carregando registros complementares para o relatório…</div> : <>
      <section className="reports-kpis" aria-label="Resumo dos resultados">
        {[
          ['Alunos ativos', String(dados.ativos), `${dados.alunosNovos} novo(s) no período`, '#a9a4ff'],
          ['Adimplência hoje', `${dados.ativos ? Math.round(dados.situacoes.emDia / dados.ativos * 100) : 0}%`, `${dados.situacoes.emDia} de ${dados.ativos} ativos em dia`, '#4ade80'],
          ['Presenças', String(dados.totalPresencas), `${dados.alunosPresentes} aluno(s) presentes`, '#22d3ee'],
          ['Receitas recebidas', money(dados.receitaTotal), `Saldo após despesas: ${money(dados.saldo)}`, dados.saldo >= 0 ? '#4ade80' : '#fb7185']
        ].map(([titulo, valor, detalhe, cor]) => <article key={titulo} style={card}><small>{titulo}</small><strong style={{ color: cor }}>{valor}</strong><span>{detalhe}</span></article>)}
      </section>

      <section className="reports-grid">
        <article style={card}><h3>Alunos e planos</h3><div className="reports-stat-list"><span>Ativos <b>{dados.ativos}</b></span><span>Inativos <b>{dados.inativos}</b></span><span>Novos no período <b>{dados.alunosNovos}</b></span><span>Mensalidades em dia <b>{dados.situacoes.emDia}</b></span><span>Atrasadas <b>{dados.situacoes.atrasado}</b></span><span>Planos vencidos / próximos 7 dias <b>{dados.planosVencidos} / {dados.planosProximos}</b></span></div>{dados.barrasPlanos.length > 0 && <div className="reports-bars">{dados.barrasPlanos.slice(0, 4).map((bar) => <div key={bar.rotulo}><span>{bar.rotulo}</span><b>{bar.valor}</b></div>)}</div>}</article>
        <article style={card}><h3>Financeiro do período</h3><div className="reports-stat-list"><span>Mensalidades <b>{money(dados.receitasMensalidades)}</b></span><span>Vendas <b>{money(dados.receitaVendas)}</b></span><span>Receitas extras <b>{money(dados.receitasExtrasPagas)}</b></span><span>Despesas pagas <b>{money(dados.despesasPagas)}</b></span><span>Saldo operacional <b className={dados.saldo < 0 ? 'reports-negative' : 'reports-positive'}>{money(dados.saldo)}</b></span><span>Pendências a receber / pagar <b>{money(dados.entradasPendentes)} / {money(dados.despesasPendentes)}</b></span></div></article>
        <article style={card}><h3>Frequência</h3><p className="reports-large-number">{dados.totalPresencas}<small>presenças registradas</small></p><p className="reports-muted">{dados.alunosPresentes} aluno(s) compareceram pelo menos uma vez no intervalo.</p>{dados.barrasPresenca.length > 0 && <div className="reports-bars">{dados.barrasPresenca.slice(0, 4).map((bar) => <div key={bar.rotulo}><span>{bar.rotulo}</span><b>{bar.valor}</b></div>)}</div>}</article>
        <article style={card}><h3>Vendas e operação</h3><div className="reports-stat-list"><span>Vendas <b>{dados.vendasPeriodo.length}</b></span><span>Unidades vendidas <b>{dados.unidadesVendidas}</b></span><span>Ticket médio <b>{money(dados.ticketMedio)}</b></span>{dados.registrosPorTipo.map((item) => <span key={item.tipo}>{item.titulo} <b>{item.registros.length}</b></span>)}</div>{dados.barrasProdutos.length > 0 && <div className="reports-bars">{dados.barrasProdutos.slice(0, 4).map((bar) => <div key={bar.rotulo}><span>{bar.rotulo}</span><b>{money(bar.valor)}</b></div>)}</div>}</article>
      </section>
      <div className="reports-footnote">O PDF inclui os indicadores, listas resumidas e gráficos por aluno/plano/produto. Os resultados refletem os registros salvos no sistema até a data de emissão.</div>
    </>}
  </div>;
}
