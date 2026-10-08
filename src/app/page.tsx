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
import { Cobrancas } from './cobrancas';
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
      ? `Vendas ainda não disponíveis no Financeiro: ${vendasError.message}. Execute a migração 20261006_perfil_frequencia_lucro.sql no Supabase.`
      : null);

    setPlanos(dataPlanos || []);
  }

  useEffect(() => {
    // Fetch after authentication changes; the loader updates state after network responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) void carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function handleSelecionarPlanoAluno(nomePlano: string) {
    setPlanoSelecionadoNome(nomePlano);
    const planoEncontrado = planos.find(p => p.nome === nomePlano);
    if (planoEncontrado) {
      const valorMensalEquivalente = planoEncontrado.duracao_dias === 1
        ? Number(planoEncontrado.valor).toFixed(2)
        : (Number(planoEncontrado.valor) / (planoEncontrado.duracao_dias / 30)).toFixed(2);
      setValorMensalidade(valorMensalEquivalente);
      setFimPlano(adicionarDias(dataEmSaoPaulo(new Date()), planoEncontrado.duracao_dias));
    }
  }

  function calcularDiasRestantes(aluno: Aluno) {
    const diffDias = diasAteVencimento(vencimentoPlano(aluno, planos, hoje), hoje);

    if (diffDias < 0) return 'Expirado';
    if (diffDias === 0) return 'Expira hoje';
    return `${diffDias} dias restantes`;
  }

  const analiseFinanceira = useMemo(() => {
    const mesSelecionado = `${mesFinanceiro.getFullYear()}-${String(mesFinanceiro.getMonth() + 1).padStart(2, '0')}`;
    const receitaEfetivaMes = pagamentos
      .filter((p) => p.competencia.startsWith(mesSelecionado))
      .reduce((acc, curr) => acc + Number(curr.valor), 0) + vendasFinanceiras
      .filter((venda) => venda.data_venda.startsWith(mesSelecionado))
      .reduce((acc, venda) => acc + Number(venda.valor_total), 0);
    const receitaVendasMes = vendasFinanceiras
      .filter((venda) => venda.data_venda.startsWith(mesSelecionado))
      .reduce((acc, venda) => acc + Number(venda.valor_total), 0);

    const inadimplenciaMes = alunos
      .filter((a) => a.status === 'Ativo' && situacaoPagamento(a, pagosNoMes, hoje) === 'Atrasado')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);

    const potencialTotal = alunos
      .filter((a) => a.status === 'Ativo')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);

    const projecaoMes1 = potencialTotal * 1.05;
    const projecaoMes2 = potencialTotal * 1.08;
    const projecaoMes3 = potencialTotal * 1.12;

    return {
      receitaEfetivaMes,
      receitaVendasMes,
      inadimplenciaMes,
      potencialTotal,
      projecaoMes1,
      projecaoMes2,
      projecaoMes3
    };
  }, [alunos, pagamentos, vendasFinanceiras, mesFinanceiro, pagosNoMes, hoje]);

  const metricas = useMemo(() => {
    const totalUsuarios = alunos.length;
    const alunosAtivos = alunos.filter((a) => a.status === 'Ativo');
    const usuariosAtraso = alunos.filter((a) => a.status === 'Ativo' && situacaoPagamento(a, pagosNoMes, hoje) === 'Atrasado').length;
    const receitaMensalidadesMes = pagamentos
      .filter((p) => p.competencia.startsWith(mesAtualChave))
      .reduce((acc, curr) => acc + Number(curr.valor), 0);
    const receitaVendasMes = vendasFinanceiras
      .filter((venda) => venda.data_venda.startsWith(mesAtualChave))
      .reduce((acc, venda) => acc + Number(venda.valor_total), 0);
    const totalRecebido = receitaMensalidadesMes + receitaVendasMes;
    const valoresAReceber = alunos
      .filter((a) => a.status === 'Ativo' && situacaoPagamento(a, pagosNoMes, hoje) !== 'Em Dia')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);
    const alunosAdimplentes = alunosAtivos.filter((a) => situacaoPagamento(a, pagosNoMes, hoje) === 'Em Dia').length;

    return { totalUsuarios, alunosAtivos: alunosAtivos.length, usuariosAtraso, totalRecebido, receitaMensalidadesMes, receitaVendasMes, valoresAReceber, alunosAdimplentes };
  }, [alunos, pagamentos, vendasFinanceiras, pagosNoMes, hoje, mesAtualChave]);

  const alunosFiltrados = useMemo(() => {
    const normalizar = (texto: string) => texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const termo = normalizar(busca.trim());
    const telefoneBuscado = busca.replace(/\D/g, '');
    return alunos.filter((aluno) => {
      const correspondeBusca = !termo || normalizar(aluno.nome).includes(termo) ||
        normalizar(aluno.plano_nome || '').includes(termo) ||
        (telefoneBuscado.length >= 3 && digitosTelefone(aluno.telefone || '').includes(telefoneBuscado));
      const correspondePlano = filtroPlano === 'Todos' || aluno.plano_nome === filtroPlano;
      const correspondeFiltro = filtroSituacao === 'Todos' ||
        (filtroSituacao === 'Atrasado'
          ? aluno.status === 'Ativo' && situacaoPagamento(aluno, pagosNoMes, hoje) === 'Atrasado'
          : aluno.status === filtroSituacao);
      return correspondeBusca && correspondeFiltro && correspondePlano;
    }).sort((a, b) => {
      if (ordenacaoAlunos === 'cadastro') return (b.criado_em || '').localeCompare(a.criado_em || '');
      if (ordenacaoAlunos === 'vencimento') return (a.fim_plano || '9999-12-31').localeCompare(b.fim_plano || '9999-12-31');
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [alunos, busca, filtroPlano, filtroSituacao, ordenacaoAlunos, pagosNoMes, hoje]);

  const aniversariantesDoMes = alunos.filter((aluno) =>
    aluno.status === 'Ativo' && aluno.data_nascimento?.slice(5, 7) === hoje.slice(5, 7)
  ).length;
  const ativos = alunos.filter((aluno) => aluno.status === 'Ativo').length;
  const presencasHoje = useMemo(() => new Set(
    frequencias.filter((frequencia) => frequencia.data?.slice(0, 10) === hoje).map((frequencia) => String(frequencia.aluno_id))
  ).size, [frequencias, hoje]);
  const novosAlunosNoMes = useMemo(() => alunos.filter((aluno) => aluno.criado_em?.slice(0, 7) === mesAtualChave).length, [alunos, mesAtualChave]);
  const percentualAdimplencia = metricas.alunosAtivos > 0 ? Math.round(metricas.alunosAdimplentes / metricas.alunosAtivos * 100) : 0;
  const percentualMensalidadesRecebidas = analiseFinanceira.potencialTotal > 0
    ? Math.min(100, Math.round(metricas.receitaMensalidadesMes / analiseFinanceira.potencialTotal * 100)) : 0;
  const prazosDosPlanos = alunos.filter(aluno => aluno.status === 'Ativo').map(aluno => {
    const vencimento = vencimentoPlano(aluno, planos, hoje);
    return { aluno, vencimento, dias: diasAteVencimento(vencimento, hoje) };
  });
  const planosVencendo = prazosDosPlanos.filter(item => item.dias >= 0 && item.dias <= 7)
    .sort((a, b) => a.dias - b.dias || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
  const planosVencidos = prazosDosPlanos.filter(item => item.dias < 0)
    .sort((a, b) => a.dias - b.dias || a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
  const vencendoEmUmaSemana = planosVencendo.length;
  const alunoDoPerfil = alunos.find((aluno) => String(aluno.id) === alunoPerfilId);
  const ultimaPresencaPorAluno = useMemo(() => {
    const ultimas = new Map<string, string>();
    for (const frequencia of frequencias) {
      const id = String(frequencia.aluno_id);
      if (frequencia.data > (ultimas.get(id) || '')) ultimas.set(id, frequencia.data);
    }
    return ultimas;
  }, [frequencias]);
  const nomesPlanos = [...new Set(alunos.map((aluno) => aluno.plano_nome).filter((nome): nome is string => Boolean(nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  async function handleMarcarPresenca(alunoId: string | number) {
    if (!session?.user?.id) return;

    const jaRegistrado = frequencias.some(f => String(f.aluno_id) === String(alunoId) && f.data === hoje);
    if (jaRegistrado) {
      alert('Presença já registrada para hoje!');
      return;
    }

    if (!alunos.some(a => String(a.id) === String(alunoId))) return;

    const { error } = await supabase.from('frequencias').insert([
      {
        aluno_id: alunoId,
        data: hoje,
        user_id: session.user.id
      }
    ]);

    if (error) alert(error.code === '23505' ? 'Presença já registrada para hoje!' : 'Erro ao registrar presença: ' + error.message);
    else carregarDados();
  }

  async function handleCadastrarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !nomePlanoForm.trim()) return;
    const valorPlano = Number(valorTotalForm);
    if (!Number.isFinite(valorPlano) || valorPlano <= 0 || ![1, 30, 90, 180, 365].includes(duracaoDiasForm)) {
      alert('Informe um valor de plano positivo e uma duração válida.');
      return;
    }

    setCarregando(true);
    const { error } = await supabase.from('planos').insert([
      {
        nome: nomePlanoForm,
        duracao_dias: Number(duracaoDiasForm),
        valor: valorPlano,
        user_id: session.user.id
      }
    ]);
    setCarregando(false);

    if (error) {
      alert('Erro ao cadastrar plano: ' + error.message);
      return;
    }
    await carregarDados();
    setNomePlanoForm('');
  }

  async function handleEliminarPlano(id?: string | number) {
    if (id == null || !session?.user?.id || !confirm('Deseja eliminar este plano?')) return;
    const { data, error } = await supabase.from('planos').delete().eq('id', id).eq('user_id', session.user.id).select('id');
    if (error) alert('Erro ao eliminar plano: ' + error.message);
    else if (!data?.length) alert('Plano não encontrado para esta conta.');
    else await carregarDados();
  }

  function montarResumoPlano(plano: Plano) {
    const alunosPlano = alunos.filter((aluno) => aluno.plano_nome === plano.nome);
    const ativos = alunosPlano.filter((aluno) => aluno.status === 'Ativo');
    const ids = new Set(alunosPlano.map((aluno) => String(aluno.id)));
    const pagamentosPlano = pagamentos.filter((pagamento) => ids.has(String(pagamento.aluno_id)));
    const presencasPorAluno = new Map<string, { total: number; ultima: string }>();
    for (const frequencia of frequencias) {
      const id = String(frequencia.aluno_id);
      if (!ids.has(id)) continue;
      const data = frequencia.data.slice(0, 10);
      const registro = presencasPorAluno.get(id) || { total: 0, ultima: '' };
      registro.total += 1;
      if (data > registro.ultima) registro.ultima = data;
      presencasPorAluno.set(id, registro);
    }
    const situacoes = { emDia: 0, pendente: 0, atrasado: 0 };
    for (const aluno of ativos) {
      const status = situacaoPagamento(aluno, pagosNoMes, hoje);
      if (status === 'Em Dia') situacoes.emDia += 1;
      else if (status === 'Pendente') situacoes.pendente += 1;
      else situacoes.atrasado += 1;
    }
    const mensalidadePrevista = ativos.reduce((total, aluno) => total + Number(aluno.valor_mensalidade || 0), 0);
    const valorRecebido = pagamentosPlano.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
    const totalPresencas = [...presencasPorAluno.values()].reduce((total, registro) => total + registro.total, 0);
    const linhasAlunos = [...alunosPlano].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((aluno) => {
      const id = String(aluno.id);
      const presencas = presencasPorAluno.get(id) || { total: 0, ultima: '' };
      const pagamentosAluno = pagamentosPlano.filter((pagamento) => String(pagamento.aluno_id) === id);
      const recebidoAluno = pagamentosAluno.reduce((total, pagamento) => total + Number(pagamento.valor || 0), 0);
      const statusPagamento = aluno.status === 'Ativo' ? situacaoPagamento(aluno, pagosNoMes, hoje) : '— (matrícula inativa)';
      const rotuloValor = plano.duracao_dias === 1 ? 'Valor do teste' : 'Mensalidade';
      return `${aluno.nome} | Matrícula: ${aluno.status} | Pagamento atual: ${statusPagamento} | ${rotuloValor}: R$ ${Number(aluno.valor_mensalidade || 0).toFixed(2)} | Próximo vencimento: ${formatarDataBrasil(vencimentoPagamento(aluno, hoje))} | Plano válido até: ${formatarDataBrasil(vencimentoPlano(aluno, planos, hoje))} | Presenças registradas: ${presencas.total} | Última presença: ${formatarDataBrasil(presencas.ultima)} | Pagamentos registrados: ${pagamentosAluno.length} (R$ ${recebidoAluno.toFixed(2)})`;
    });
    return {
      alunosPlano,
      ativos,
      situacoes,
      mensalidadePrevista,
      valorRecebido,
      quantidadePagamentos: pagamentosPlano.length,
      totalPresencas,
      alunosComPresenca: presencasPorAluno.size,
      linhasAlunos
    };
  }

  async function baixarRelatorioPlano(plano: Plano) {
    const chave = String(plano.id ?? plano.nome);
    setGerandoPlanoPdfId(chave);
    setMensagemPlanoPdf('');
    try {
      const resumo = montarResumoPlano(plano);
      const equivalenteMensal = Number(plano.valor) / (Number(plano.duracao_dias) / 30);
      const pdf = gerarPdfRelatorioAcademia({
        academia: `${nomeAcademia} · Plano ${plano.nome}`,
        periodo: `Histórico cadastrado até ${formatarDataBrasil(hoje)}`,
        emitidoEm: formatarDataBrasil(hoje),
        indicadores: [
          { titulo: 'Alunos ativos', valor: String(resumo.ativos.length), detalhe: `${resumo.alunosPlano.length - resumo.ativos.length} inativo(s)`, cor: '#635bfc' },
          { titulo: plano.duracao_dias === 1 ? 'Valor dos testes ativos' : 'Mensalidade prevista', valor: `R$ ${resumo.mensalidadePrevista.toFixed(2)}`, detalhe: plano.duracao_dias === 1 ? 'valor informado no cadastro' : 'soma dos ativos', cor: '#0d9ca6' },
          { titulo: 'Pagamentos registrados', valor: `R$ ${resumo.valorRecebido.toFixed(2)}`, detalhe: `${resumo.quantidadePagamentos} lançamento(s)`, cor: '#15a77a' },
          { titulo: 'Presenças', valor: String(resumo.totalPresencas), detalhe: `${resumo.alunosComPresenca} aluno(s)`, cor: '#d89417' }
        ],
        secoes: [
          { titulo: 'Dados do plano', linhas: [
            `Plano: ${plano.nome}.`,
            plano.duracao_dias === 1
              ? `Duração: 1 dia (plano de teste). Valor total: R$ ${Number(plano.valor).toFixed(2)}. Não é aplicada equivalência mensal para este plano.`
              : `Duração: ${plano.duracao_dias} dias. Valor total: R$ ${Number(plano.valor).toFixed(2)}. Equivalente mensal estimado: R$ ${equivalenteMensal.toFixed(2)}.`,
            `Criado em: ${formatarDataBrasil(plano.criado_em)}. Alunos vinculados pelo nome do plano cadastrado no perfil: ${resumo.alunosPlano.length}.`
          ] },
          { titulo: 'Situação dos alunos ativos', linhas: [
            `${resumo.situacoes.emDia} em dia, ${resumo.situacoes.pendente} pendente(s) e ${resumo.situacoes.atrasado} atrasado(s) neste mês.`,
            `${plano.duracao_dias === 1 ? 'Valor informado dos alunos ativos' : 'Valor mensal previsto dos alunos ativos'}: R$ ${resumo.mensalidadePrevista.toFixed(2)}. Valor contratado total pelo preço do plano: R$ ${(resumo.ativos.length * Number(plano.valor)).toFixed(2)}.`
          ] },
          { titulo: 'Frequência e pagamentos', linhas: [
            `${resumo.totalPresencas} presença(s) encontradas no histórico; ${resumo.alunosComPresenca} aluno(s) tiveram ao menos uma presença.`,
            `Pagamentos registrados de todos os alunos vinculados: R$ ${resumo.valorRecebido.toFixed(2)}. Os pagamentos são somados conforme os lançamentos existentes no sistema.`
          ] },
          { titulo: 'Detalhamento dos alunos', linhas: resumo.linhasAlunos.length ? resumo.linhasAlunos : ['Nenhum aluno está vinculado a este plano.'] },
          { titulo: 'Critérios do relatório', linhas: [
            'Os alunos são associados ao plano pelo nome salvo no campo plano do cadastro. Pagamento atual é calculado com base no vencimento e nos pagamentos registrados para o mês de emissão.',
            'O relatório consolida os dados cadastrados no FitGestão até a data de emissão; informações ausentes nos cadastros aparecem como traço ou zero.'
          ] }
        ]
      });
      const url = URL.createObjectURL(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }));
      const link = document.createElement('a');
      const slug = plano.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      link.href = url;
      link.download = `relatorio-plano-${slug || 'academia'}-${hoje}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMensagemPlanoPdf(`Relatório do plano ${plano.nome} baixado em PDF.`);
    } catch (error) {
      setMensagemPlanoPdf(error instanceof Error ? `Falha ao gerar o PDF: ${error.message}` : 'Falha ao gerar o relatório em PDF.');
    } finally {
      setGerandoPlanoPdfId(null);
    }
  }

  const diasDoMes = useMemo(() => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const dias = [];
    const primeiroDiaSemana = primeiroDia.getDay();

    for (let i = 0; i < primeiroDiaSemana; i++) {
      dias.push(null);
    }

    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      const dataFormatada = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({
        dia: i,
        dataStr: dataFormatada
      });
    }

    return dias;
  }, [mesAtual]);

  const datasComPresenca = useMemo(() => {
    if (!alunoSelecionadoId) return new Set();
    return new Set(
      frequencias
        .filter(f => String(f.aluno_id) === String(alunoSelecionadoId))
        .map(f => f.data)
    );
  }, [frequencias, alunoSelecionadoId]);

  const intervaloFrequencia = useMemo(() => {
    const fim = faixaFrequencia === 'personalizado' ? (fimFrequencia || hoje) : hoje;
    if (faixaFrequencia === 'personalizado') return { inicio: inicioFrequencia || fim, fim };
    if (faixaFrequencia === 'ano') return { inicio: `${hoje.slice(0, 4)}-01-01`, fim };
    const dias = faixaFrequencia === 'semana' ? 7 : faixaFrequencia === 'mes' ? 30 : faixaFrequencia === '3meses' ? 90 : 180;
    const inicio = new Date(`${hoje}T12:00:00`);
    inicio.setDate(inicio.getDate() - dias + 1);
    return { inicio: dataEmSaoPaulo(inicio), fim };
  }, [faixaFrequencia, inicioFrequencia, fimFrequencia, hoje]);
  const frequenciasAlunoSelecionado = useMemo(() => frequencias.filter((f) => String(f.aluno_id) === String(alunoSelecionadoId)), [frequencias, alunoSelecionadoId]);
  const frequenciasNoPeriodo = frequenciasAlunoSelecionado.filter((f) => f.data >= intervaloFrequencia.inicio && f.data <= intervaloFrequencia.fim);
  const rankingFrequencia = useMemo(() => {
    const contagemPorAluno = new Map<string, number>();
    for (const frequencia of frequencias) {
      const data = frequencia.data?.slice(0, 10);
      if (!data || data < intervaloFrequencia.inicio || data > intervaloFrequencia.fim) continue;
      const alunoId = String(frequencia.aluno_id);
      contagemPorAluno.set(alunoId, (contagemPorAluno.get(alunoId) || 0) + 1);
    }
    return alunos
      .filter((aluno) => aluno.id != null)
      .map((aluno) => ({ id: String(aluno.id), nome: aluno.nome, total: contagemPorAluno.get(String(aluno.id)) || 0 }))
      .filter((aluno) => aluno.total > 0)
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, frequencias, intervaloFrequencia]);
  const rankingFrequenciaExibido = limiteRankingFrequencia === 'todos'
    ? rankingFrequencia
    : rankingFrequencia.slice(0, limiteRankingFrequencia);
  const barrasFrequencia = useMemo(() => {
    const inicio = Date.parse(`${intervaloFrequencia.inicio}T00:00:00Z`);
    const fim = Date.parse(`${intervaloFrequencia.fim}T00:00:00Z`);
    const totalDias = Math.max(1, Math.ceil((fim - inicio + 86400000) / 86400000));
    const tamanhoGrupoDias = Math.max(1, Math.ceil(totalDias / 12));
    const grupos = new Map<number, { total: number; inicio: string }>();
    const totalGrupos = Math.ceil(totalDias / tamanhoGrupoDias);
    for (let indice = 0; indice < totalGrupos; indice += 1) {
      grupos.set(indice, { total: 0, inicio: new Date(inicio + indice * tamanhoGrupoDias * 86400000).toISOString().slice(0, 10) });
    }
    for (const presenca of frequenciasNoPeriodo) {
      const indice = Math.floor((Date.parse(`${presenca.data}T00:00:00Z`) - inicio) / 86400000 / tamanhoGrupoDias);
      const grupo = grupos.get(indice);
      if (!grupo) continue;
      grupo.total += 1;
      grupos.set(indice, grupo);
    }
    return [...grupos.entries()].sort((a, b) => a[0] - b[0]).slice(-12).map(([indice, grupo]) => ({ ...grupo, key: indice }));
  }, [frequenciasNoPeriodo, intervaloFrequencia]);
  const maxBarraFrequencia = Math.max(1, ...barrasFrequencia.map((barra) => barra.total));

  function baixarAlunosCSV() {
    const cabecalho = ['Nome', 'Telefone', 'Nascimento', 'Idade', 'Matrícula', 'Plano', 'Mensalidade (R$)', 'Pagamento neste mês', 'Próximo vencimento', 'Plano válido até'];
    const linhas = alunosFiltrados.map((aluno) => [
      aluno.nome,
      aluno.telefone || '',
      aluno.data_nascimento || '',
      calcularIdade(aluno.data_nascimento, hoje) ?? '',
      aluno.status,
      aluno.plano_nome || '',
      Number(aluno.valor_mensalidade || 0).toFixed(2).replace('.', ','),
      situacaoPagamento(aluno, pagosNoMes, hoje),
      aluno.proximo_vencimento || vencimentoPagamento(aluno, hoje),
      aluno.fim_plano || ''
    ]);
    const conteudo = '\uFEFF' + [cabecalho, ...linhas].map((linha) => linha.map(csvSeguro).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `alunos_${hoje}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthCarregando(true);
    if (modoAuth === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('Erro ao entrar: ' + error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) alert('Erro ao criar conta: ' + error.message);
      else alert(data.session ? 'Conta criada e conectada!' : 'Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.');
    }
    setAuthCarregando(false);
  }

  async function handleSalvarAluno(e: React.FormEvent) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const abrirContrato = submitter instanceof HTMLButtonElement && submitter.dataset.acao === 'contrato';
    if (!session?.user?.id || !nome.trim() || !planoSelecionadoNome) return;
    if (telefone && !telefoneValido(telefone)) {
      alert('Informe um telefone com DDD e 10 ou 11 dígitos, ou deixe o campo vazio.');
      return;
    }
    if (dataNascimento && !dataNascimentoValida(dataNascimento, hoje)) {
      alert('Informe uma data de nascimento válida, anterior ou igual a hoje.');
      return;
    }
    const mensalidade = Number(valorMensalidade);
    const vencimento = Number(diaVencimento);
    if (!Number.isFinite(mensalidade) || mensalidade <= 0 ||
        !Number.isInteger(vencimento) || vencimento < 1 || vencimento > 31 ||
        !dataISOValida(fimPlano) || !dataISOValida(proximoVencimento)) {
      alert('Informe mensalidade positiva, dia de vencimento entre 1 e 31 e datas válidas para o próximo vencimento e o fim do plano.');
      return;
    }

    setCarregando(true);

    const dadosAluno = {
      nome: nome.trim(),
      telefone: telefone ? formatarTelefone(telefone) : null,
      data_nascimento: dataNascimento || null,
      status: statusAluno,
      plano_nome: planoSelecionadoNome,
      valor_mensalidade: mensalidade,
      dia_vencimento: vencimento,
      proximo_vencimento: proximoVencimento,
      status_pagamento: pagosNoMes.has(String(editandoAlunoId ?? ''))
        ? 'Em Dia' as const
        : proximoVencimento < hoje ? 'Atrasado' as const : proximoVencimento === hoje ? 'Pendente' as const : 'Em Dia' as const,
      fim_plano: fimPlano,
      graduacao,
      user_id: session.user.id,
      academia_id: session.user.id
    };

    if (editandoAlunoId) {
      const { data, error } = await supabase.from('alunos').update(dadosAluno).eq('id', editandoAlunoId)
        .or(`user_id.eq.${session.user.id},academia_id.eq.${session.user.id}`).select('id');
      setCarregando(false);
      if (error) alert('Erro ao atualizar: ' + error.message);
      else if (!data?.length) alert('Aluno não encontrado para esta conta.');
      else {
        const alunoId = String(data[0].id);
        alert('Aluno atualizado com sucesso!');
        setEditandoAlunoId(null);
        limparFormularioAluno();
        if (abrirContrato) {
          setAlunoPerfilId(alunoId);
          setAbaPerfilInicial('contrato');
          setAbaAtiva('Usuarios');
        }
        await carregarDados();
        if (abrirContrato) requestAnimationFrame(() => document.getElementById('perfil-aluno')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } else {
      const { data, error } = await supabase.from('alunos').insert([dadosAluno]).select('id').single();
      setCarregando(false);
      if (error) alert('Erro ao cadastrar: ' + error.message);
      else {
        const alunoId = String(data.id);
        limparFormularioAluno();
        if (abrirContrato) {
          setAlunoPerfilId(alunoId);
          setAbaPerfilInicial('contrato');
          setAbaAtiva('Usuarios');
        }
        await carregarDados();
        if (abrirContrato) requestAnimationFrame(() => document.getElementById('perfil-aluno')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  }

  function limparFormularioAluno() {
    setNome('');
    setTelefone('');
    setDataNascimento('');
    setStatusAluno('Ativo');
    setPlanoSelecionadoNome('');
    setValorMensalidade('120.00');
    setDiaVencimento('10');
    setProximoVencimento(proximoVencimentoDoDia(10, dataEmSaoPaulo(new Date())));
    setGraduacao('Iniciante');
    setFimPlano(adicionarDias(dataEmSaoPaulo(new Date()), 30));
    setEditandoAlunoId(null);
  }

  function prepararEdicaoAluno(aluno: Aluno) {
    setEditandoAlunoId(aluno.id || null);
    setNome(aluno.nome);
    setTelefone(formatarTelefone(aluno.telefone || ''));
    setDataNascimento(aluno.data_nascimento || '');
    setStatusAluno(aluno.status || 'Ativo');
    setPlanoSelecionadoNome(aluno.plano_nome || 'Plano Mensal');
    setValorMensalidade(String(aluno.valor_mensalidade || 120));
    setDiaVencimento(String(aluno.dia_vencimento || 10));
    setProximoVencimento(aluno.proximo_vencimento?.slice(0, 10) || vencimentoPagamento(aluno, hoje));
    setFimPlano(aluno.fim_plano || adicionarDias(
      aluno.criado_em ? dataEmSaoPaulo(new Date(aluno.criado_em)) : dataEmSaoPaulo(new Date()),
      planos.find(p => p.nome === aluno.plano_nome)?.duracao_dias || 30
    ));
    setGraduacao(aluno.graduacao || 'Iniciante');
    setAbaAtiva('Usuarios');
  }

  async function handleDarBaixa(id?: string | number) {
    if (id == null || !session?.user?.id) return;
    const { error } = await supabase.rpc('registrar_pagamento', { p_aluno_id: String(id) });
    if (error) alert('Erro ao registrar pagamento: ' + error.message);
    else await carregarDados();
  }

  async function handleEliminar(id?: string | number) {
    if (id == null || !confirm('Deseja eliminar este registro?')) return;
    if (!session?.user?.id) return;
    const { data, error } = await supabase.from('alunos').delete().eq('id', id)
      .or(`user_id.eq.${session.user.id},academia_id.eq.${session.user.id}`).select('id');
    if (error) alert('Erro ao excluir aluno: ' + error.message);
    else if (!data?.length) alert('Aluno não encontrado para esta conta.');
    else {
      if (alunoPerfilId === String(id)) setAlunoPerfilId(null);
      await carregarDados();
    }
  }

  if (!session) {
    return (
      <div style={{ backgroundColor: '#13151f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: '#1e2230', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #2a2f42' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>FitGestão - Login</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
            <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
            <button type="submit" disabled={authCarregando} style={{ padding: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#635bfc', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              {authCarregando ? 'Processando...' : modoAuth === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: '#8a8f9d' }}>
            <span style={{ cursor: 'pointer', color: '#635bfc' }} onClick={() => setModoAuth(modoAuth === 'login' ? 'signup' : 'login')}>
              {modoAuth === 'login' ? 'Criar nova conta de academia' : 'Já tenho uma conta'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  const modulos: Record<string, TipoModulo> = {
    Exercicios: 'exercicio', Treinos: 'treino', 'Nutrição': 'nutricao', Vendas: 'venda'
  };
  const moduloAtivo = modulos[abaAtiva];

  const menuItens = [
    { nome: 'Painel', icone: '🏠', temSeta: false },
    { nome: 'Usuarios', icone: '👤', temSeta: false },
    { nome: 'Planos', icone: '🎟️', temSeta: false },
    { nome: 'Frequência', icone: '📅', temSeta: false },
    { nome: 'Exercicios', icone: '🏋️', temSeta: false },
    { nome: 'Treinos', icone: '🏃', temSeta: false },
    { nome: 'Nutrição', icone: '🥣', temSeta: false },
    { nome: 'Vendas', icone: '🛍️', temSeta: false },
    { nome: 'Cobranças', icone: '💳', temSeta: false },
    { nome: 'Financeiro', icone: '💵', temSeta: false },
    { nome: 'Relatorios', icone: '📋', temSeta: false },
    { nome: 'Configurações', icone: '⚙️', temSeta: false },
  ];

  return (
    <div className="fit-shell" style={{ minHeight: '100vh', backgroundColor: '#13151f', color: '#fff', fontFamily: 'sans-serif' }}>
      
      <aside className="fit-sidebar" style={{ backgroundColor: '#1a1d2b', borderRight: '1px solid #24283b', padding: '1.2rem 0.8rem', gap: '0.4rem' }}>
        <div className="fit-sidebar-top">
          <h2 className="fit-brand" style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1.2rem', paddingLeft: '0.8rem', overflowWrap: 'anywhere' }}>{nomeAcademia}</h2>
          <button type="button" className="fit-signout-mobile" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
        <nav className="fit-nav" aria-label="Navegação principal">
        {menuItens.map((item) => {
          const estaAtivo = abaAtiva === item.nome;
          return (
            <button
              key={item.nome}
              type="button"
              aria-current={estaAtivo ? 'page' : undefined}
              onClick={() => setAbaAtiva(item.nome)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: estaAtivo ? '#635bfc' : 'transparent',
                color: estaAtivo ? '#fff' : '#8a8f9d',
                fontWeight: estaAtivo ? 'bold' : 'normal',
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <span style={{ fontSize: '1rem' }}>{item.icone}</span>
                <span>{item.nome}</span>
              </div>
              {item.temSeta && <span style={{ fontSize: '0.8rem', color: '#52586d' }}>›</span>}
            </button>
          );
        })}
        </nav>

        <div className="fit-sidebar-footer" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #24283b' }}>
          <button type="button" onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #3a3f55', backgroundColor: 'transparent', color: '#ff5c5c', cursor: 'pointer', fontSize: '0.85rem' }}>
            Sair
          </button>
        </div>
      </aside>

      <main className="fit-main" style={{ overflowY: 'auto' }}>
        {erroDados && (
          <div role="alert" style={{ backgroundColor: '#7f1d1d', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {erroDados} <button onClick={() => void carregarDados()} style={{ marginLeft: '1rem' }}>Tentar novamente</button>
          </div>
        )}
        
        {!erroDados && abaAtiva === 'Painel' && (
          <div className="dashboard-page">
            <header className="dashboard-header">
              <div>
                <span className="dashboard-eyebrow">RESUMO DA ACADEMIA</span>
                <h2>Olá! Aqui está a situação da {nomeAcademia}.</h2>
                <p>{new Date(`${hoje}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Visão do mês atual</p>
              </div>
              <div className="dashboard-quick-actions">
                <button type="button" onClick={() => setAbaAtiva('Usuarios')}>＋ Novo aluno</button>
                <button type="button" onClick={() => setAbaAtiva('Frequência')}>✓ Registrar presença</button>
              </div>
            </header>

            <section className="dashboard-kpis" aria-label="Indicadores rápidos da academia">
              <button type="button" className="dashboard-kpi" onClick={() => { setFiltroSituacao('Ativo'); setAbaAtiva('Usuarios'); }}>
                <span className="dashboard-kpi-icon">👥</span><span className="dashboard-kpi-label">Alunos ativos</span>
                <strong>{metricas.alunosAtivos}</strong><small>{metricas.totalUsuarios - metricas.alunosAtivos} inativos · {novosAlunosNoMes} novos neste mês</small>
              </button>
              <button type="button" className="dashboard-kpi" onClick={() => setAbaAtiva('Frequência')}>
                <span className="dashboard-kpi-icon">📍</span><span className="dashboard-kpi-label">Presenças hoje</span>
                <strong>{presencasHoje}</strong><small>{ativos ? `${Math.round(presencasHoje / ativos * 100)}% dos alunos ativos` : 'Nenhum aluno ativo cadastrado'}</small>
              </button>
              <button type="button" className="dashboard-kpi" onClick={() => { setFiltroSituacao('Todos'); setAbaAtiva('Usuarios'); }}>
                <span className="dashboard-kpi-icon">✅</span><span className="dashboard-kpi-label">Adimplência do mês</span>
                <strong>{percentualAdimplencia}%</strong><small>{metricas.alunosAdimplentes} de {metricas.alunosAtivos} alunos ativos em dia</small>
              </button>
              <button type="button" className="dashboard-kpi dashboard-kpi-alert" onClick={() => setAbaAtiva('Usuarios')}>
                <span className="dashboard-kpi-icon">⚠️</span><span className="dashboard-kpi-label">Planos vencidos</span>
                <strong>{planosVencidos.length}</strong><small>{planosVencendo.length} vencem nos próximos 7 dias</small>
              </button>
            </section>

            <section className="dashboard-main-grid">
              <article className="dashboard-card dashboard-finance-card">
                <div className="dashboard-card-heading"><div><span className="dashboard-eyebrow">FINANCEIRO · {new Date(`${mesAtualChave}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</span><h3>Receita recebida</h3></div><button type="button" onClick={() => setAbaAtiva('Financeiro')}>Abrir financeiro →</button></div>
                <strong className="dashboard-revenue">{metricas.totalRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                <div className="dashboard-revenue-split"><span>Mensalidades <b>{metricas.receitaMensalidadesMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span><span>Vendas <b>{metricas.receitaVendasMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span></div>
                <div className="dashboard-progress-label"><span>Mensalidades recebidas</span><b>{percentualMensalidadesRecebidas}% do potencial</b></div>
                <div className="dashboard-progress-track"><i style={{ width: `${percentualMensalidadesRecebidas}%` }} /></div>
                <div className="dashboard-finance-foot"><span>Potencial mensal: <b>{analiseFinanceira.potencialTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span><span>A receber: <b>{metricas.valoresAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span></div>
              </article>

              <article className="dashboard-card dashboard-attention-card">
                <div className="dashboard-card-heading"><div><span className="dashboard-eyebrow">ACOMPANHAMENTO</span><h3>Planos que pedem atenção</h3></div><button type="button" onClick={() => setAbaAtiva('Usuarios')}>Ver alunos →</button></div>
                <div className="dashboard-plan-summary"><span className={planosVencidos.length ? 'dashboard-status-bad' : 'dashboard-status-good'}>{planosVencidos.length} vencidos</span><span className={planosVencendo.length ? 'dashboard-status-warn' : 'dashboard-status-good'}>{planosVencendo.length} vencendo em 7 dias</span></div>
                <div className="dashboard-plan-lists">
                  <div><h4>Vencidos</h4>{planosVencidos.length ? planosVencidos.slice(0, 3).map(({ aluno, vencimento }) => <button type="button" className="dashboard-plan-row" key={`vencido-${aluno.id}`} onClick={() => { setAbaPerfilInicial('resumo'); setAlunoPerfilId(String(aluno.id)); setAbaAtiva('Usuarios'); }}><span>{aluno.nome}<small>Venceu em {formatarDataBrasil(vencimento)}</small></span><b>Ver</b></button>) : <p className="dashboard-empty">Nenhum plano vencido.</p>}</div>
                  <div><h4>Próximos 7 dias</h4>{planosVencendo.length ? planosVencendo.slice(0, 3).map(({ aluno, vencimento, dias }) => <button type="button" className="dashboard-plan-row" key={`vencendo-${aluno.id}`} onClick={() => { setAbaPerfilInicial('resumo'); setAlunoPerfilId(String(aluno.id)); setAbaAtiva('Usuarios'); }}><span>{aluno.nome}<small>{dias === 0 ? 'Vence hoje' : `Vence em ${formatarDataBrasil(vencimento)}`}</small></span><b>Ver</b></button>) : <p className="dashboard-empty">Nenhum vencimento próximo.</p>}</div>
                </div>
              </article>
            </section>

            <section className="dashboard-shortcuts" aria-label="Atalhos">
              <button type="button" onClick={() => setAbaAtiva('Usuarios')}><span>👤</span><div><b>Alunos</b><small>Cadastre e acompanhe matrículas</small></div><strong>→</strong></button>
              <button type="button" onClick={() => setAbaAtiva('Frequência')}><span>📅</span><div><b>Frequência</b><small>Consulte e registre presenças</small></div><strong>→</strong></button>
              <button type="button" onClick={() => setAbaAtiva('Vendas')}><span>🛍️</span><div><b>Vendas</b><small>Produtos e compras vinculadas</small></div><strong>→</strong></button>
            </section>
          </div>
        )}

        {!erroDados && abaAtiva === 'Relatorios' && session && (
          <Relatorios
            key={`${session.user.id}-relatorios`}
            userId={session.user.id}
            academia={nomeAcademia}
            hoje={hoje}
            alunos={alunos}
            frequencias={frequencias}
            planos={planos}
            pagamentos={pagamentos}
            vendas={vendasFinanceiras}
            erroVendas={erroVendasFinanceiras}
          />
        )}

        {!erroDados && abaAtiva === 'Financeiro' && session && (
          <Financeiro
            key={`${session.user.id}-financeiro`}
            userId={session.user.id}
            alunos={alunos}
            pagamentos={pagamentos}
            vendas={vendasFinanceiras}
            erroVendas={erroVendasFinanceiras}
            mes={mesFinanceiro}
            onMesChange={setMesFinanceiro}
          />
        )}

        {!erroDados && abaAtiva === 'Cobranças' && session && (
          <Cobrancas
            key={`${session.user.id}-cobrancas`}
            userId={session.user.id}
            alunos={alunos.filter((aluno): aluno is Aluno & { id: string | number } => aluno.id != null)}
          />
        )}

        {!erroDados && abaAtiva === 'Planos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Cadastrar Novo Plano de Mensalidade</h3>
              <form onSubmit={handleCadastrarPlano} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <input
                  type="text"
                  placeholder="Nome do Plano (ex: Plano Anual) *"
                  value={nomePlanoForm}
                  onChange={(e) => setNomePlanoForm(e.target.value)}
                  required
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                />

                <select
                  value={duracaoDiasForm}
                  onChange={(e) => setDuracaoDiasForm(Number(e.target.value))}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                >
                  <option value={1}>1 dia (aluno teste)</option>
                  <option value={30}>30 dias</option>
                  <option value={90}>90 dias</option>
                  <option value={180}>180 dias</option>
                  <option value={365}>365 dias</option>
                </select>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Valor Total do Plano (R$) *"
                  value={valorTotalForm}
                  onChange={(e) => setValorTotalForm(e.target.value)}
                  required
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                />

                <button
                  type="submit"
                  disabled={carregando}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: '#635bfc', color: '#fff', fontWeight: 'bold', cursor: 'pointer', gridColumn: '1 / -1' }}
                >
                  {carregando ? 'Salvando...' : 'Criar Plano'}
                </button>
              </form>
            </div>

            {mensagemPlanoPdf && <p role="status" style={{ margin: 0, color: mensagemPlanoPdf.startsWith('Falha') ? '#fecaca' : '#86efac' }}>{mensagemPlanoPdf}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {planos.map((plano) => {
                const equivalenteMensal = (Number(plano.valor) / (plano.duracao_dias / 30)).toFixed(2);
                const resumo = montarResumoPlano(plano);
                const chavePlano = String(plano.id ?? plano.nome);
                return (
                  <div key={plano.id ?? plano.nome} style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{plano.nome}</h4>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', backgroundColor: '#635bfc', color: '#fff', fontWeight: 'bold' }}>
                          {plano.duracao_dias} dias
                        </span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #2a2f42', paddingTop: '1rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#22c55e' }}>
                        R$ {Number(plano.valor).toFixed(2)}
                      </h2>
                      <span style={{ fontSize: '0.8rem', color: '#8a8f9d' }}>
                        {plano.duracao_dias === 1 ? 'Plano de teste · duração de 1 dia' : `Equivalente a R$ ${equivalenteMensal} / mês`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '0.35rem', color: '#aeb5c6', fontSize: '0.82rem' }}>
                      <span>Alunos vinculados: <strong style={{ color: '#fff' }}>{resumo.alunosPlano.length}</strong> ({resumo.ativos.length} ativos)</span>
                      <span>Pagamento atual: {resumo.situacoes.emDia} em dia · {resumo.situacoes.pendente} pendentes · {resumo.situacoes.atrasado} atrasados</span>
                      <span>Presenças registradas: {resumo.totalPresencas} · Recebido no histórico: R$ {resumo.valorRecebido.toFixed(2)}</span>
                    </div>

                    <button type="button" onClick={() => void baixarRelatorioPlano(plano)} disabled={gerandoPlanoPdfId !== null} style={{ padding: '0.65rem 0.8rem', backgroundColor: '#635bfc', border: 0, borderRadius: 6, color: '#fff', cursor: gerandoPlanoPdfId !== null ? 'wait' : 'pointer', fontWeight: 600 }}>
                      {gerandoPlanoPdfId === chavePlano ? 'Gerando PDF…' : '⇩ Baixar relatório detalhado em PDF'}
                    </button>

                    <button
                      onClick={() => handleEliminarPlano(plano.id)}
                      style={{ padding: '0.4rem', backgroundColor: 'transparent', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Eliminar Plano
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!erroDados && abaAtiva === 'Frequência' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Controlo de Frequência</h3>
                <p style={{ color: '#8a8f9d', fontSize: '0.85rem', marginTop: '0.3rem' }}>Selecione o aluno para ver o calendário ou registrar presença.</p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <select
                  value={alunoSelecionadoId || ''}
                  onChange={(e) => setAlunoSelecionadoId(e.target.value)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff', fontSize: '0.9rem' }}
                >
                  {alunos.map((aluno) => (
                    <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>
                  ))}
                </select>

                {alunoSelecionadoId && (
                  <button
                    onClick={() => handleMarcarPresenca(alunoSelecionadoId)}
                    style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#22c55e', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    📍 Marcar Presença Hoje
                  </button>
                )}
              </div>
            </div>

            <section style={{ backgroundColor: '#1e2230', padding: '1.3rem 1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div><h3 style={{ margin: '0 0 0.35rem' }}>Frequência ao longo do tempo</h3><p style={{ margin: 0, color: '#aeb5c6' }}>Compare a participação do aluno em diferentes períodos.</p></div>
                <label style={{ display: 'grid', gap: '0.3rem', color: '#aeb5c6', fontSize: '0.85rem' }}>Período
                  <select value={faixaFrequencia} onChange={(e) => setFaixaFrequencia(e.target.value as typeof faixaFrequencia)} style={{ padding: '0.6rem', borderRadius: 6, border: '1px solid #3a3f55', background: '#13151f', color: '#fff' }}>
                    <option value="semana">Última semana</option><option value="mes">Último mês</option><option value="3meses">Últimos 3 meses</option><option value="6meses">Últimos 6 meses</option><option value="ano">Este ano</option><option value="personalizado">Escolher datas</option>
                  </select>
                </label>
                {faixaFrequencia === 'personalizado' && <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'grid', gap: '0.3rem', color: '#aeb5c6', fontSize: '0.85rem' }}>De <input type="date" value={inicioFrequencia} max={fimFrequencia || hoje} onChange={(e) => setInicioFrequencia(e.target.value)} style={{ padding: '0.55rem', background: '#13151f', color: '#fff', border: '1px solid #3a3f55', borderRadius: 6 }} /></label>
                  <label style={{ display: 'grid', gap: '0.3rem', color: '#aeb5c6', fontSize: '0.85rem' }}>Até <input type="date" value={fimFrequencia || hoje} min={inicioFrequencia || undefined} max={hoje} onChange={(e) => setFimFrequencia(e.target.value)} style={{ padding: '0.55rem', background: '#13151f', color: '#fff', border: '1px solid #3a3f55', borderRadius: 6 }} /></label>
                </div>}
                <div style={{ padding: '0.65rem 1rem', background: '#13151f', borderRadius: 8, color: '#aeb5c6' }}><small>Presenças no intervalo</small><div style={{ fontSize: '1.35rem', color: '#4ade80', fontWeight: 700 }}>{frequenciasNoPeriodo.length} <span style={{ fontSize: '0.85rem', color: '#aeb5c6', fontWeight: 400 }}>/ {frequenciasAlunoSelecionado.length} no total</span></div></div>
              </div>
              <div style={{ marginTop: '0.9rem', color: '#aeb5c6', fontSize: '0.85rem' }}>De {formatarDataBrasil(intervaloFrequencia.inicio)} até {formatarDataBrasil(intervaloFrequencia.fim)} · Última presença: {formatarDataBrasil([...frequenciasAlunoSelecionado].sort((a, b) => b.data.localeCompare(a.data))[0]?.data)}</div>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'end', height: 110, marginTop: '0.8rem', padding: '0.35rem 0' }} aria-label="Presenças por período">
                {barrasFrequencia.map((barra) => <div key={barra.key} title={`${formatarDataBrasil(barra.inicio)} · ${barra.total} presença(s)`} style={{ flex: 1, minWidth: 12, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'end', alignItems: 'center', gap: 4 }}><small style={{ color: '#aeb5c6', fontSize: '0.7rem' }}>{barra.total}</small><span style={{ display: 'block', width: '100%', height: `${Math.max(8, barra.total / maxBarraFrequencia * 72)}px`, borderRadius: '4px 4px 0 0', background: '#22c55e' }} /><small style={{ color: '#aeb5c6', fontSize: '0.65rem' }}>{formatarDataBrasil(barra.inicio).slice(0, 5)}</small></div>)}
                {frequenciasNoPeriodo.length === 0 && <span style={{ color: '#aeb5c6' }}>Nenhuma presença registrada neste período.</span>}
              </div>
            </section>

            <section aria-labelledby="ranking-frequencia-titulo" style={{ backgroundColor: '#1e2230', padding: '1.3rem 1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <h3 id="ranking-frequencia-titulo" style={{ margin: '0 0 0.3rem' }}>🏆 Ranking de frequência</h3>
                  <p style={{ margin: 0, color: '#aeb5c6', fontSize: '0.85rem' }}>
                    Alunos com mais presenças de {formatarDataBrasil(intervaloFrequencia.inicio)} até {formatarDataBrasil(intervaloFrequencia.fim)}.
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#aeb5c6', fontSize: '0.85rem' }}>
                  Mostrar
                  <select aria-label="Quantidade de alunos no ranking" value={limiteRankingFrequencia} onChange={(e) => {
                    const valor = e.target.value;
                    setLimiteRankingFrequencia(valor === 'todos' ? 'todos' : Number(valor) as 5 | 10);
                  }} style={{ padding: '0.55rem', borderRadius: 6, border: '1px solid #3a3f55', background: '#13151f', color: '#fff' }}>
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value="todos">Todos</option>
                  </select>
                </label>
              </div>
              <p style={{ margin: '0 0 0.8rem', color: '#aeb5c6', fontSize: '0.8rem' }}>
                {rankingFrequencia.length} {rankingFrequencia.length === 1 ? 'aluno com presença' : 'alunos com presença'} no período selecionado.
              </p>
              {rankingFrequencia.length === 0 ? (
                <p style={{ margin: 0, padding: '1rem', textAlign: 'center', color: '#aeb5c6', background: '#13151f', borderRadius: 8 }}>
                  Nenhuma presença registrada no período escolhido.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: '#aeb5c6', fontSize: '0.8rem' }}>
                        <th scope="col" style={{ padding: '0.65rem', width: 80 }}>Posição</th>
                        <th scope="col" style={{ padding: '0.65rem' }}>Aluno</th>
                        <th scope="col" style={{ padding: '0.65rem', width: '42%' }}>Presenças</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingFrequenciaExibido.map((aluno, indice) => (
                        <tr key={aluno.id} style={{ borderTop: '1px solid #2a2f42' }}>
                          <td style={{ padding: '0.7rem 0.65rem', color: indice < 3 ? '#fbbf24' : '#aeb5c6', fontWeight: 700 }}>
                            {indice === 0 ? '🥇 1º' : indice === 1 ? '🥈 2º' : indice === 2 ? '🥉 3º' : `${indice + 1}º`}
                          </td>
                          <td style={{ padding: '0.7rem 0.65rem', color: '#fff', fontWeight: 600 }}>{aluno.nome}</td>
                          <td style={{ padding: '0.7rem 0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <strong style={{ color: '#4ade80', minWidth: 24 }}>{aluno.total}</strong>
                              <span aria-hidden="true" style={{ display: 'block', flex: 1, height: 7, minWidth: 50, borderRadius: 99, background: '#2a2f42', overflow: 'hidden' }}>
                                <span style={{ display: 'block', width: `${Math.max(6, (aluno.total / rankingFrequencia[0].total) * 100)}%`, height: '100%', borderRadius: 99, background: '#22c55e' }} />
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}
                  style={{ padding: '0.4rem 0.8rem', backgroundColor: '#13151f', border: '1px solid #2a2f42', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ◀ Mês Anterior
                </button>

                <h3 style={{ margin: 0 }}>
                  {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                </h3>

                <button
                  onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}
                  style={{ padding: '0.4rem 0.8rem', backgroundColor: '#13151f', border: '1px solid #2a2f42', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Próximo Mês ▶
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                  <div key={dia} style={{ padding: '0.5rem', fontWeight: 'bold', color: '#8a8f9d', fontSize: '0.85rem' }}>
                    {dia}
                  </div>
                ))}

                {diasDoMes.map((item: { dia: number; dataStr: string } | null, index: number) => {
                  if (!item) return <div key={`vazio-${index}`} style={{ padding: '1rem' }}></div>;

                  const temPresenca = datasComPresenca.has(item.dataStr);

                  return (
                    <div
                      key={item.dataStr}
                      style={{
                        padding: '1rem 0.5rem',
                        borderRadius: '8px',
                        backgroundColor: temPresenca ? '#166534' : '#13151f',
                        border: temPresenca ? '1px solid #22c55e' : '1px solid #2a2f42',
                        color: temPresenca ? '#fff' : '#8a8f9d',
                        fontWeight: temPresenca ? 'bold' : 'normal',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <span>{item.dia}</span>
                      {temPresenca && <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>✓ Presente</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!erroDados && abaAtiva === 'Usuarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="aluno-kpis">
              <div><small>👥 Total</small><strong>{alunos.length}</strong></div>
              <div><small>✅ Matrículas ativas</small><strong>{ativos}</strong></div>
              <div><small>🎂 Aniversariantes do mês</small><strong>{aniversariantesDoMes}</strong></div>
              <div><small>⏳ Planos vencendo em 7 dias</small><strong>{vencendoEmUmaSemana}</strong></div>
            </div>
            <div id="cadastro-aluno" style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{editandoAlunoId ? 'Editar Perfil do Aluno' : 'Cadastrar Novo Aluno'}</h3>
                {editandoAlunoId && (
                  <button onClick={limparFormularioAluno} style={{ padding: '0.3rem 0.8rem', backgroundColor: '#3a3f55', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Cancelar Edição
                  </button>
                )}
              </div>

              <form onSubmit={handleSalvarAluno} className="aluno-form">
                <div className="aluno-form-section">
                  <h4>Dados pessoais</h4>
                  <div className="aluno-form-grid">
                    <label className="aluno-field">Nome completo *
                      <input className="aluno-control" type="text" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} placeholder="Nome do aluno" />
                    </label>
                    <label className="aluno-field">Telefone com DDD
                      <input className="aluno-control" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(54)99999-9999" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} />
                    </label>
                    <label className="aluno-field">Data de nascimento
                      <input className="aluno-control" type="date" value={dataNascimento} max={hoje} onChange={(e) => setDataNascimento(e.target.value)} />
                      {calcularIdade(dataNascimento, hoje) !== null && <small>Idade atual: {calcularIdade(dataNascimento, hoje)} anos</small>}
                    </label>
                  </div>
                </div>
                <div className="aluno-form-section">
                  <h4>Matrícula e plano</h4>
                  <div className="aluno-form-grid">
                    <label className="aluno-field">Situação da matrícula
                      <select className="aluno-control" value={statusAluno} onChange={(e) => setStatusAluno(e.target.value as 'Ativo' | 'Inativo')}>
                        <option value="Ativo">Ativo</option><option value="Inativo">Inativo</option>
                      </select>
                    </label>
                    <label className="aluno-field">Plano *
                      <select className="aluno-control" value={planoSelecionadoNome} onChange={(e) => handleSelecionarPlanoAluno(e.target.value)} required>
                        <option value="" disabled>Selecione um plano</option>
                        {planos.length === 0 && <option value="Plano Mensal">Plano Mensal (padrão)</option>}
                        {planoSelecionadoNome && !planos.some(p => p.nome === planoSelecionadoNome) && planos.length > 0 &&
                          <option value={planoSelecionadoNome}>{planoSelecionadoNome} (plano anterior)</option>}
                        {planos.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                      </select>
                    </label>
                    <label className="aluno-field">Mensalidade (R$) *
                      <input className="aluno-control" type="number" min="0.01" step="0.01" value={valorMensalidade} onChange={(e) => setValorMensalidade(e.target.value)} required />
                    </label>
                    <label className="aluno-field">Dia do vencimento *
                      <input className="aluno-control" type="number" min="1" max="31" step="1" value={diaVencimento} onChange={(e) => {
                        const valor = e.target.value;
                        setDiaVencimento(valor);
                        if (Number(valor) >= 1 && Number(valor) <= 31) setProximoVencimento(proximoVencimentoDoDia(Number(valor), hoje));
                      }} required />
                    </label>
                    <label className="aluno-field">Próximo vencimento *
                      <input className="aluno-control" type="date" value={proximoVencimento} onChange={(e) => setProximoVencimento(e.target.value)} required />
                    </label>
                    <label className="aluno-field">Nível / faixa
                      <input className="aluno-control" type="text" value={graduacao} onChange={(e) => setGraduacao(e.target.value)} maxLength={80} placeholder="Ex.: Iniciante" />
                    </label>
                    <label className="aluno-field">Plano válido até
                      <input className="aluno-control" type="date" value={fimPlano} onChange={(e) => setFimPlano(e.target.value)} required />
                    </label>
                  </div>
                  <small style={{ color: '#aeb5c6' }}>O próximo vencimento define se a mensalidade está em dia, pendente hoje ou atrasada. A validade do plano é controlada separadamente. Se o pagamento já foi recebido, use “Baixa” para registrá-lo.</small>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button type="submit" disabled={carregando} className="aluno-submit" style={{ backgroundColor: editandoAlunoId ? '#22c55e' : '#635bfc' }}>
                  {carregando ? 'Salvando...' : editandoAlunoId ? 'Guardar Alterações do Aluno' : 'Cadastrar Aluno'}
                </button>
                <button type="submit" data-acao="contrato" disabled={carregando} className="aluno-submit" style={{ backgroundColor: '#334155', border: '1px solid #64748b' }}>
                  {carregando ? 'Salvando...' : 'Salvar e abrir contrato'}
                </button>
                </div>
              </form>
            </div>

            {alunoDoPerfil && session && <div id="perfil-aluno"><PerfilAluno key={`${alunoDoPerfil.id}-${abaPerfilInicial}`} abaInicial={abaPerfilInicial} userId={session.user.id} academia={nomeAcademia} aluno={alunoDoPerfil} hoje={hoje} pagamentos={pagamentos} frequencias={frequencias} onAtualizar={carregarDados}
              situacao={situacaoPagamento(alunoDoPerfil, pagosNoMes, hoje)} diasRestantes={calcularDiasRestantes(alunoDoPerfil)}
              onEditar={() => { prepararEdicaoAluno(alunoDoPerfil); document.getElementById('cadastro-aluno')?.scrollIntoView({ behavior: 'smooth' }); }}
              onFechar={() => setAlunoPerfilId(null)} /></div>}

            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Lista de Alunos</h3>
                  <p style={{ color: '#8a8f9d', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>
                    {alunosFiltrados.length} de {alunos.length} alunos · {aniversariantesDoMes} aniversariante(s) neste mês
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <input type="search" aria-label="Pesquisar alunos" placeholder="Nome, telefone ou plano" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff', width: '220px' }} />
                  <select aria-label="Filtrar matrícula ou atraso" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as typeof filtroSituacao)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}>
                    <option value="Todos">Todos</option>
                    <option value="Ativo">Ativos</option>
                    <option value="Inativo">Inativos</option>
                    <option value="Atrasado">Em atraso</option>
                  </select>
                  <select aria-label="Filtrar por plano" value={filtroPlano} onChange={(e) => setFiltroPlano(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}>
                    <option value="Todos">Todos os planos</option>
                    {nomesPlanos.map((plano) => <option key={plano} value={plano}>{plano}</option>)}
                  </select>
                  <select aria-label="Ordenar alunos" value={ordenacaoAlunos} onChange={(e) => setOrdenacaoAlunos(e.target.value as typeof ordenacaoAlunos)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}>
                    <option value="nome">Nome A–Z</option>
                    <option value="cadastro">Mais recentes</option>
                    <option value="vencimento">Plano vence primeiro</option>
                  </select>
                  {(busca || filtroSituacao !== 'Todos' || filtroPlano !== 'Todos') && <button type="button" onClick={() => { setBusca(''); setFiltroSituacao('Todos'); setFiltroPlano('Todos'); }} style={{ padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid #2a2f42', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Limpar filtros</button>}
                  <button type="button" onClick={baixarAlunosCSV} disabled={alunosFiltrados.length === 0} style={{ padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#2a2f42', color: '#fff', cursor: 'pointer' }}>Exportar CSV</button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
              <table className="aluno-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2f42', color: '#8a8f9d' }}>
                    <th style={{ padding: '0.8rem' }}>NOME</th>
                    <th style={{ padding: '0.8rem' }}>IDADE</th>
                    <th style={{ padding: '0.8rem' }}>MATRÍCULA</th>
                    <th style={{ padding: '0.8rem' }}>PLANO VINCULADO</th>
                    <th style={{ padding: '0.8rem' }}>CONTAGEM REGRESSIVA</th>
                    <th style={{ padding: '0.8rem' }}>ÚLTIMA PRESENÇA</th>
                    <th style={{ padding: '0.8rem' }}>VALOR</th>
                    <th style={{ padding: '0.8rem' }} title="O status segue a data do próximo vencimento; use Baixa para registrar um pagamento recebido.">PAGAMENTO / PRÓXIMO VENCIMENTO</th>
                    <th style={{ padding: '0.8rem', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunosFiltrados.map((aluno) => {
                    const tempoRestante = calcularDiasRestantes(aluno);
                    const isExpirado = tempoRestante.includes('Expirado') || tempoRestante.includes('Expira hoje');
                    const situacao = situacaoPagamento(aluno, pagosNoMes, hoje);

                    return (
                      <tr key={aluno.id} style={{ borderBottom: '1px solid #1a1d2b' }}>
                        <td style={{ padding: '0.8rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{aluno.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: '#8a8f9d' }}>
                            {aluno.telefone ? formatarTelefone(aluno.telefone) : 'Sem telefone'}
                            {aluno.data_nascimento && ` · Nasc.: ${formatarDataBrasil(aluno.data_nascimento)}`}
                          </div>
                          {aluno.status === 'Ativo' && aluno.data_nascimento?.slice(5) === hoje.slice(5) && <div style={{ color: '#86efac', fontSize: '0.75rem' }}>🎂 Aniversário hoje</div>}
                        </td>
                        <td style={{ padding: '0.8rem' }}>{calcularIdade(aluno.data_nascimento, hoje) ?? '—'}</td>
                        <td style={{ padding: '0.8rem' }}><span style={{ color: aluno.status === 'Ativo' ? '#86efac' : '#cbd5e1' }}>{aluno.status}</span></td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#2a2f42', fontSize: '0.8rem', color: '#635bfc', fontWeight: 'bold' }}>
                            {aluno.plano_nome || 'Plano Mensal'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: isExpirado ? '#7f1d1d' : '#065f46', color: isExpirado ? '#fca5a5' : '#6ee7b7' }}>
                            ⏳ {tempoRestante}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', color: '#aeb5c6' }}>{formatarDataBrasil(ultimaPresencaPorAluno.get(String(aluno.id)))}</td>
                        <td style={{ padding: '0.8rem' }}>R$ {Number(aluno.valor_mensalidade || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.8rem' }}>
                          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: situacao === 'Em Dia' ? '#166534' : situacao === 'Pendente' ? '#92400e' : '#991b1b', color: '#fff' }}>
                            {situacao}<small style={{ fontWeight: 400 }}>Vence {formatarDataBrasil(vencimentoPagamento(aluno, hoje))}</small>
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                          <button type="button" onClick={() => { setAbaPerfilInicial('resumo'); setAlunoPerfilId(String(aluno.id)); }} style={{ padding: '0.3rem 0.6rem', marginRight: '0.4rem', backgroundColor: '#4f46e5', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Perfil</button>
                          <button onClick={() => prepararEdicaoAluno(aluno)} style={{ padding: '0.3rem 0.6rem', marginRight: '0.4rem', backgroundColor: '#3b82f6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Editar</button>
                          {aluno.telefone && telefoneValido(aluno.telefone) && (
                            <a href={`https://wa.me/55${digitosTelefone(aluno.telefone)}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${aluno.nome}`} style={{ display: 'inline-block', padding: '0.3rem 0.6rem', marginRight: '0.4rem', backgroundColor: '#166534', borderRadius: '4px', color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>WhatsApp</a>
                          )}
                          {aluno.status === 'Ativo' && !pagosNoMes.has(String(aluno.id)) && (
                            <button onClick={() => handleDarBaixa(aluno.id)} style={{ padding: '0.3rem 0.6rem', marginRight: '0.4rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Baixa</button>
                          )}
                          <button onClick={() => handleEliminar(aluno.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {alunosFiltrados.length === 0 && <p style={{ color: '#8a8f9d', textAlign: 'center' }}>Nenhum aluno encontrado com os filtros atuais.</p>}
            </div>
          </div>
        )}

        {moduloAtivo === 'nutricao' && <PlanosAlimentares key={`${session.user.id}-nutricao`} userId={session.user.id} academia={nomeAcademia}
          alunos={alunos.filter((aluno) => aluno.id != null).map((aluno) => ({ id: String(aluno.id), nome: aluno.nome, status: aluno.status, telefone: aluno.telefone }))} />}
        {moduloAtivo === 'venda' && <Vendas key={`${session.user.id}-vendas`} userId={session.user.id}
          alunos={alunos.filter((aluno) => aluno.id != null).map((aluno) => ({ id: String(aluno.id), nome: aluno.nome, status: aluno.status }))}
          onVendaRegistrada={carregarDados} />}
        {moduloAtivo && moduloAtivo !== 'nutricao' && moduloAtivo !== 'venda' && <ModuloGestao key={`${session.user.id}-${moduloAtivo}`} tipo={moduloAtivo} userId={session.user.id}
          alunos={alunos.filter((aluno) => aluno.id != null).map((aluno) => ({ id: String(aluno.id), nome: aluno.nome, status: aluno.status, telefone: aluno.telefone }))} />}

        {abaAtiva === 'Configurações' && <Configuracoes key={session.user.id} userId={session.user.id} onNomeAtualizado={setNomeAcademia} />}

      </main>
    </div>
  );
}
