'use client';

/* eslint-disable react-hooks/preserve-manual-memoization */

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { adicionarDias, dataEmSaoPaulo, dataISOValida, diasAteVencimento, proximoVencimentoDoDia, situacaoPagamento, vencimentoPagamento, vencimentoPlano } from '@/lib/faturamento';
import { calcularIdade, csvSeguro, dataNascimentoValida, digitosTelefone, formatarDataBrasil, formatarTelefone, telefoneValido } from '@/lib/alunos';
import { gerarPdfRelatorioAcademia } from '@/lib/relatorio-pdf';
import { Configuracoes, ModuloGestao, type TipoModulo } from './modulos';
import { PlanosAlimentares } from './planos-alimentares';
import { PerfilAluno } from './perfil-aluno';
import { Vendas } from './vendas';
import { Financeiro } from './financeiro';
import { Relatorios } from './relatorios';
import { Session } from '@supabase/supabase-js';

interface Aluno {
  id?: string | number;
  nome: string;
  telefone?: string;
  data_nascimento?: string | null;
  cpf?: string | null;
  status: 'Ativo' | 'Inativo';
  plano_nome?: string;
  valor_mensalidade?: number;
  dia_vencimento?: number;
  status_pagamento: 'Em Dia' | 'Pendente' | 'Atrasado';
  graduacao?: string;
  criado_em?: string;
  fim_plano?: string | null;
  proximo_vencimento?: string | null;
  user_id?: string;
  academia_id?: string;
  observacoes?: string | null;
  foto_storage_path?: string | null;
  endereco?: string | null;
  contrato_responsavel_nome?: string | null;
  contrato_responsavel_cpf?: string | null;
  contrato_responsavel_telefone?: string | null;
  contrato_responsavel_parentesco?: string | null;
  contrato_texto?: string | null;
  contrato_personalizado?: boolean;
}

interface Frequencia {
  id?: number;
  aluno_id: string | number;
  data: string;
  user_id?: string;
}

interface Plano {
  id?: string | number;
  nome: string;
  duracao_dias: number;
  valor: number;
  criado_em?: string;
  academia_id?: string;
  user_id?: string;
}

interface Pagamento {
  id: number;
  aluno_id: string;
  valor: number;
  competencia: string;
}

interface VendaFinanceira {
  id: string;
  valor_total: number;
  data_venda: string;
  produto_nome?: string;
  categoria?: string;
  quantidade?: number;
  aluno_id?: string | null;
  aluno_nome?: string;
  custo_unitario?: number | null;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const usuarioAtualRef = useRef<string | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [frequencias, setFrequencias] = useState<Frequencia[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [vendasFinanceiras, setVendasFinanceiras] = useState<VendaFinanceira[]>([]);
  const [erroVendasFinanceiras, setErroVendasFinanceiras] = useState<string | null>(null);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<string>('Painel');
  const [nomeAcademia, setNomeAcademia] = useState('FitGestão');
  const [busca, setBusca] = useState<string>('');
  const [filtroSituacao, setFiltroSituacao] = useState<'Todos' | 'Ativo' | 'Inativo' | 'Atrasado'>('Todos');
  const [filtroPlano, setFiltroPlano] = useState('Todos');
  const [ordenacaoAlunos, setOrdenacaoAlunos] = useState<'nome' | 'cadastro' | 'vencimento'>('nome');
  const [alunoPerfilId, setAlunoPerfilId] = useState<string | null>(null);
  const [abaPerfilInicial, setAbaPerfilInicial] = useState<'resumo' | 'sobre' | 'foto' | 'contrato'>('resumo');

  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | number | null>(null);
  const [faixaFrequencia, setFaixaFrequencia] = useState<'semana' | 'mes' | '3meses' | '6meses' | 'ano' | 'personalizado'>('mes');
  const [inicioFrequencia, setInicioFrequencia] = useState('');
  const [fimFrequencia, setFimFrequencia] = useState('');
  const [limiteRankingFrequencia, setLimiteRankingFrequencia] = useState<5 | 10 | 'todos'>(10);
  const [mesAtual, setMesAtual] = useState<Date>(new Date());
  const [mesFinanceiro, setMesFinanceiro] = useState<Date>(new Date());
  const [instanteAtual, setInstanteAtual] = useState<Date>(new Date());

  // Form Aluno (Cadastro ou Edição)
  const [editandoAlunoId, setEditandoAlunoId] = useState<string | number | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [statusAluno, setStatusAluno] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [planoSelecionadoNome, setPlanoSelecionadoNome] = useState<string>('');
  const [valorMensalidade, setValorMensalidade] = useState('120.00');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [proximoVencimento, setProximoVencimento] = useState(() => proximoVencimentoDoDia(10, dataEmSaoPaulo(new Date())));
  const [fimPlano, setFimPlano] = useState(() => adicionarDias(dataEmSaoPaulo(new Date()), 30));
  const [graduacao, setGraduacao] = useState('Iniciante');

  // Form Plano
  const [nomePlanoForm, setNomePlanoForm] = useState('');
  const [duracaoDiasForm, setDuracaoDiasForm] = useState<number>(30);
  const [valorTotalForm, setValorTotalForm] = useState('120.00');
  const [gerandoPlanoPdfId, setGerandoPlanoPdfId] = useState<string | null>(null);
  const [mensagemPlanoPdf, setMensagemPlanoPdf] = useState('');

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modoAuth, setModoAuth] = useState<'login' | 'signup'>('login');
  const [authCarregando, setAuthCarregando] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setInstanteAtual(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hoje = dataEmSaoPaulo(instanteAtual);
  const mesAtualChave = hoje.slice(0, 7);
  const pagosNoMes = useMemo(() => new Set(
    pagamentos.filter(p => p.competencia.startsWith(mesAtualChave)).map(p => String(p.aluno_id))
  ), [pagamentos, mesAtualChave]);

  useEffect(() => {
    function aplicarSessao(novaSessao: Session | null) {
      const novoId = novaSessao?.user.id || null;
      if (usuarioAtualRef.current !== novoId) {
        usuarioAtualRef.current = novoId;
        setAlunos([]);
        setFrequencias([]);
        setPlanos([]);
        setPagamentos([]);
        setVendasFinanceiras([]);
        setErroVendasFinanceiras(null);
        setAlunoSelecionadoId(null);
        setAlunoPerfilId(null);
        setErroDados(null);
        setEditandoAlunoId(null);
        setNome('');
        setTelefone('');
        setDataNascimento('');
        setStatusAluno('Ativo');
        setDiaVencimento('10');
        setProximoVencimento(proximoVencimentoDoDia(10, dataEmSaoPaulo(new Date())));
        setNomeAcademia('FitGestão');
      }
      setSession(novaSessao);
    }
    supabase.auth.getSession().then(({ data: { session } }) => aplicarSessao(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => aplicarSessao(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    supabase.from('gestao_configuracoes').select('nome_academia').eq('user_id', userId)
      .maybeSingle().then(({ data, error }) => {
        if (!error && data?.nome_academia && usuarioAtualRef.current === userId) {
          setNomeAcademia(data.nome_academia);
        }
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (alunoPerfilId && abaAtiva === 'Usuarios') {
      document.getElementById('perfil-aluno')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [alunoPerfilId, abaAtiva]);

  async function carregarDados() {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    setErroDados(null);

    const { data: dataAlunos, error: erroAlunos } = await supabase
      .from('alunos')
      .select('*')
      .or(`user_id.eq.${userId},academia_id.eq.${userId}`)
      .order('id', { ascending: false });

    if (usuarioAtualRef.current !== userId) return;
    if (erroAlunos) {
      setErroDados('Não foi possível carregar os alunos: ' + erroAlunos.message);
      return;
    }
    setAlunos(dataAlunos || []);
    if (!(dataAlunos || []).some(aluno => String(aluno.id) === String(alunoSelecionadoId))) {
      setAlunoSelecionadoId(dataAlunos?.[0]?.id || null);
    }

    const { data: dataFreq, error: erroFreq } = await supabase
      .from('frequencias')
      .select('*')
      .eq('user_id', userId);

    if (usuarioAtualRef.current !== userId) return;
    if (erroFreq) {
      setErroDados('Não foi possível carregar as presenças: ' + erroFreq.message);
      return;
    }
    setFrequencias(dataFreq || []);

    const { data: dataPlanos, error: erroPlanos } = await supabase
      .from('planos')
      .select('*')
      .eq('user_id', userId);

    const { data: dataPagamentos, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select('id, aluno_id, valor, competencia')
      .eq('user_id', userId);
    const { data: dataVendas, error: vendasError } = await supabase
      .from('gestao_vendas')
      .select('id, valor_total, data_venda, produto_nome, categoria, quantidade, aluno_id, aluno_nome, custo_unitario')
      .eq('user_id', userId);
    if (usuarioAtualRef.current !== userId) return;
    if (pagamentosError || erroPlanos) {
      setErroDados('Não foi possível carregar todos os dados: ' + (pagamentosError || erroPlanos)?.message);
      return;
    }
    setPagamentos(dataPagamentos || []);
    setVendasFinanceiras((dataVendas || []) as VendaFinanceira[]);
    setErroVendasFinanceiras(vendasError
      ? `Vendas ainda não disponíveis no Financeiro: ${vendasError.mes