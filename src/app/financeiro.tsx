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
type VendaFinanceira = { id: string; valor_total: number; data_venda: string; produto_nome?: string; aluno_nome?: string };
type LinhaFinanceira = { id: string; tipo: TipoLancamento; descricao: string; categoria: string; valor: number; data: string; situacao: SituacaoLancamento; origem: string; aluno: string; forma: string; editavel?: CategoriaLancamento };

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
      ...vendas.filter(v => v.data_venda.startsWith(mesChave)).map(v => ({
        id: `venda-${v.id}`, tipo: 'entrada' as const, descricao: v.produto_nome || 'Venda de produto',
        categoria: 'Vendas', valor: Number(v.valor_total), data: v.data_venda, situacao: 'pago' as const,
        origem: 'Venda', aluno: v.aluno_nome || '—', forma: '—'
      }))
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
    const atrasados = lancamentos.filter(l => l.status === 'pendente' && l.vencimento < hoje);
    const atrasoTotal = somar(atrasados.map(l => Number(l.valor))) + (mesChave === hoje.slice(0, 7)
      ? somar(alunos.filter(a => a.status === 'Ativo' && a.id != null && situacaoPagamento(a, alunosPagosNoMes, hoje) === 'Atrasado').map(a => Number(a.valor_mensalidade || 0))) : 0);
    const potencial = somar(alunos.filter(a => a.status === 'Ativo').map(a => Number(a.valor_mensalidade || 0)));
    return { entradas, saidas, saldo: entradas - saidas, receber: receberManual + mensalidadesAReceber, pagar, atrasoTotal, potencial };
  }, [linhas, lancamentos, alunos, mesChave, hoje, alunosPagosNoMes]);

  const ultimosMeses = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const data = new Date(mes.getFullYear(), mes.getMonth() - 5 + i, 1);
    const chave = chaveMes(data);
    const recebimentos = somar(pagamentos.filter(p => p.competencia.startsWith(chave)).map(p => Number(p.valor))) +
      somar(vendas.filter(v => v.data_venda.startsWith(chave)).map(v => Number(v.valor_total))) +
      somar(lancamentos.filter(l => l.tipo === 'entrada' && l.status === 'pago' && (l.data_pagamento || l.vencimento).startsWith(chave)).map(l => Number(l.valor)));
    const despesas = somar(lancamentos.filter(l => l.tipo === 'saida' && l.status === 'pago' && (l.data_pagamento || l.vencimento).startsWith(chave)).map(l => Number(l.valor)));
    return { chave, rotulo: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), recebimentos, despesas };
  }), [mes, pagamentos, vendas, lancamentos]);
  const tetoGrafico = Math.max(1, ...ul