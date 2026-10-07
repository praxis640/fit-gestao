'use client';

import { useEffect, useMemo, useState } from 'react';
import { situacaoPagamento, vencimentoPlano, diasAteVencimento } from '@/lib/faturamento';
import { gerarPdfRelatorioAcademia, type BarraRelatorio, type SecaoRelatorio } from '@/lib/relatorio-pdf';
import { supabase } from '@/lib/supabase';

type AlunoRelatorio = { id?: string | number; nome: string; telefone?: string; data_nascimento?: string | null; status: 'Ativo' | 'Inativo'; plano_nome?: string; valor_mensalidade?: number; dia_vencimento?: number; proximo_vencimento?: string | null; status_pagamento?: 'Em Dia' | 'Pendente' | 'Atrasado'; criado_em?: string; fim_plano?: string | null };
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
  const [planoSelecionado, setPlanoSelecionado] = useState('todos');
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

  const alunosDoPlano = useMemo(() => planoSelecionado === 'todos' ? alunos : alunos.filter((aluno) => (aluno.plano_nome || 'Plano não informado') === planoSelecionado), [alunos, planoSelecionado]);
  const idsAlunosDoPlano = useMemo(() => new Set(alunosDoPlano.map((aluno) => String(aluno.id))), [alunosDoPlano]);
  const frequenciasDoPlano = useMemo(() => planoSelecionado === 'todos' ? frequencias : frequencias.filter((r) => idsAlunosDoPlano.has(String(r.aluno_id))), [frequencias, planoSelecionado, idsAlunosDoPlano]);
  const pagamentosDoPlano = useMemo(() => planoSelecionado === 'todos' ? pagamentos : pagamentos.filter((r) => idsAlunosDoPlano.has(String(r.aluno_id))), [pagamentos, planoSelecionado, idsAlunosDoPlano]);
  const vendasDoPlano = useMemo(() => planoSelecionado === 'todos' ? vendas : vendas.filter((r) => r.aluno_id && idsAlunosDoPlano.has(String(r.aluno_id))), [vendas, planoSelecionado, idsAlunosDoPlano]);

  const dados = useMemo(() => {
    const noPeriodo = (data?: string | null) => Boolean(data && data.slice(0, 10) >= intervalo.inicio && data.slice(0, 10) <= intervalo.fim);
    const ativos = alunosDoPlano.filter((aluno) => aluno.status === 'Ativo');
    const pagosAtual = new Set(pagamentosDoPlano.filter((p) => p.competencia.startsWith(hoje.slice(0, 7))).map((p) => String(p.aluno_id)));
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
    const alunosNovos = alunosDoPlano.filter((aluno) => noPeriodo(aluno.criado_em)).length;
    const frequenciasPeriodo = frequenciasDoPlano.filter((registro) => noPeriodo(registro.data));
    const presencasPorAluno = new Map<string, number>();
    for (const frequencia of frequenciasPeriodo) {
      const id = String(frequencia.aluno_id);
      presencasPorAluno.set(id, (presencasPorAluno.get(id) || 0) + 1);
    }
    const nomesAlunos = new Map(alunosDoPlano.map((aluno) => [String(aluno.id), aluno.nome]));
    const pagamentosPeriodo = pagamentosDoPlano.filter((p) => noPeriodo(p.competencia));
    const vendasPeriodo = vendasDoPlano.filter((v) => noPeriodo(v.data_venda));
    const lancamentosPeriodo = lancamentos.filter((l) => (planoSelecionado === 'todos' || Boolean(l.aluno_id && idsAlunosDoPlano.has(String(l.aluno_id)))) && noPeriodo(l.status === 'pago' ? (l.data_pagamento || l.vencimento) : l.vencimento));
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
    const operacionaisPeriodo = registros.filter((r) => (planoSelecionado === 'todos' || Boolean(r.aluno_id && idsAlunosDoPlano.has(String(r.aluno_id)))) && noPeriodo(r.data_registro || r.criado_em));
    const modulos = (['exercicio', 'treino', 'nutricao'] as const).map((tipo) => ({
      tipo,
      titulo: tipo === 'exercicio' ? 'Exercí