'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Aluno {
  id?: string | number;
  nome: string;
  telefone?: string;
  status: 'Ativo' | 'Inativo';
  plano_nome?: string;
  valor_mensalidade?: number;
  dia_vencimento?: number;
  status_pagamento: 'Em Dia' | 'Pendente' | 'Atrasado';
  graduacao?: string;
  user_id?: string;
  academia_id?: string;
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
  duracao_meses: number;
  valor_total: number;
  descricao?: string;
  user_id?: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [frequencias, setFrequencias] = useState<Frequencia[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<string>('Painel');
  const [busca, setBusca] = useState<string>('');

  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | number | null>(null);
  const [mesAtual, setMesAtual] = useState<Date>(new Date());

  // Form Aluno
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoSelecionadoNome, setPlanoSelecionadoNome] = useState<string>('Plano Mensal');
  const [valorMensalidade, setValorMensalidade] = useState('120.00');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [statusPagamento, setStatusPagamento] = useState<'Em Dia' | 'Pendente' | 'Atrasado'>('Em Dia');
  const [graduacao, setGraduacao] = useState('Iniciante');

  // Form Plano
  const [nomePlanoForm, setNomePlanoForm] = useState('');
  const [duracaoMesesForm, setDuracaoMesesForm] = useState<number>(1);
  const [valorTotalForm, setValorTotalForm] = useState('120.00');
  const [descricaoPlanoForm, setDescricaoPlanoForm] = useState('');

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modoAuth, setModoAuth] = useState<'login' | 'signup'>('login');
  const [authCarregando, setAuthCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  async function carregarDados() {
    if (!session?.user?.id) return;

    // Alunos
    const { data: dataAlunos } = await supabase
      .from('alunos')
      .select('*')
      .or(`user_id.eq.${session.user.id},academia_id.eq.${session.user.id}`)
      .order('id', { ascending: false });

    if (dataAlunos) {
      setAlunos(dataAlunos);
      if (dataAlunos.length > 0 && !alunoSelecionadoId) {
        setAlunoSelecionadoId(dataAlunos[0].id || null);
      }
    }

    // Frequencias
    const { data: dataFreq } = await supabase
      .from('frequencias')
      .select('*')
      .eq('user_id', session.user.id);

    if (dataFreq) setFrequencias(dataFreq);

    // Planos
    const { data: dataPlanos } = await supabase
      .from('planos')
      .select('*')
      .eq('user_id', session.user.id);

    if (dataPlanos && dataPlanos.length > 0) {
      setPlanos(dataPlanos);
      setPlanoSelecionadoNome(dataPlanos[0].nome);
    } else {
      const planosPadrao: Plano[] = [
        { id: '1', nome: 'Plano Mensal', duracao_meses: 1, valor_total: 120.00, descricao: 'Acesso total de 1 mês' },
        { id: '2', nome: 'Plano Trimestral', duracao_meses: 3, valor_total: 330.00, descricao: 'Desconto equivalente a R$ 110/mês' },
        { id: '3', nome: 'Plano Semestral', duracao_meses: 6, valor_total: 600.00, descricao: 'Desconto equivalente a R$ 100/mês' },
        { id: '4', nome: 'Plano Anual VIP', duracao_meses: 12, valor_total: 1080.00, descricao: 'Melhor valor: R$ 90/mês' },
      ];
      setPlanos(planosPadrao);
      setPlanoSelecionadoNome(planosPadrao[0].nome);
    }
  }

  useEffect(() => {
    if (session) carregarDados();
    else {
      setAlunos([]);
      setFrequencias([]);
      setPlanos([]);
    }
  }, [session]);

  function handleSelecionarPlanoAluno(nomePlano: string) {
    setPlanoSelecionadoNome(nomePlano);
    const planoEncontrado = planos.find(p => p.nome === nomePlano);
    if (planoEncontrado) {
      const valorMensalEquivalente = (planoEncontrado.valor_total / planoEncontrado.duracao_meses).toFixed(2);
      setValorMensalidade(valorMensalEquivalente);
    }
  }

  async function handleMarcarPresenca(alunoId: string | number) {
    if (!session?.user?.id) return;

    const hoje = new Date().toISOString().split('T')[0];

    const jaRegistrado = frequencias.some(f => String(f.aluno_id) === String(alunoId) && f.data === hoje);
    if (jaRegistrado) {
      alert('Presença já registrada para hoje!');
      return;
    }

    const { error } = await supabase.from('frequencias').insert([
      {
        aluno_id: alunoId,
        data: hoje,
        user_id: session.user.id
      }
    ]);

    if (error) alert('Erro ao registrar presença: ' + error.message);
    else carregarDados();
  }

  async function handleCadastrarPlano(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !nomePlanoForm.trim()) return;

    setCarregando(true);
    const { error } = await supabase.from('planos').insert([
      {
        nome: nomePlanoForm,
        duracao_meses: Number(duracaoMesesForm),
        valor_total: parseFloat(valorTotalForm) || 0,
        descricao: descricaoPlanoForm,
        user_id: session.user.id
      }
    ]);
    setCarregando(false);

    if (error) {
      const novoPlano: Plano = {
        id: Date.now().toString(),
        nome: nomePlanoForm,
        duracao_meses: Number(duracaoMesesForm),
        valor_total: parseFloat(valorTotalForm) || 0,
        descricao: descricaoPlanoForm
      };
      setPlanos(prev => [...prev, novoPlano]);
    } else {
      carregarDados();
    }

    setNomePlanoForm('');
    setDescricaoPlanoForm('');
  }

  async function handleEliminarPlano(id?: string | number) {
    if (!id || !confirm('Deseja eliminar este plano?')) return;
    const { error } = await supabase.from('planos').delete().eq('id', id);
    if (error) {
      setPlanos(prev => prev.filter(p => p.id !== id));
    } else {
      carregarDados();
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

  const metricas = useMemo(() => {
    const totalUsuarios = alunos.length;
    const usuariosAtraso = alunos.filter((a) => a.status_pagamento !== 'Em Dia').length;
    const totalRecebido = alunos
      .filter((a) => a.status_pagamento === 'Em Dia')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);
    const valoresAReceber = alunos
      .filter((a) => a.status_pagamento !== 'Em Dia')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);

    return { totalUsuarios, usuariosAtraso, totalRecebido, totalLucro: totalRecebido, valoresAReceber };
  }, [alunos]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthCarregando(true);
    if (modoAuth === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('Erro ao entrar: ' + error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert('Erro ao criar conta: ' + error.message);
      else alert('Conta criada com sucesso!');
    }
    setAuthCarregando(false);
  }

  async function handleCadastrarAluno(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id || !nome.trim()) return;

    setCarregando(true);
    const { error } = await supabase.from('alunos').insert([
      {
        nome,
        telefone,
        status: 'Ativo',
        plano_nome: planoSelecionadoNome || 'Plano Mensal',
        valor_mensalidade: parseFloat(valorMensalidade) || 0,
        dia_vencimento: parseInt(diaVencimento) || 10,
        status_pagamento: statusPagamento,
        graduacao,
        user_id: session.user.id,
        academia_id: session.user.id
      }
    ]);
    setCarregando(false);

    if (error) alert('Erro ao cadastrar: ' + error.message);
    else {
      setNome('');
      setTelefone('');
      carregarDados();
    }
  }

  async function handleDarBaixa(id?: string | number) {
    if (!id) return;
    const { error } = await supabase.from('alunos').update({ status_pagamento: 'Em Dia' }).eq('id', id);
    if (!error) carregarDados();
  }

  async function handleEliminar(id?: string | number) {
    if (!id || !confirm('Deseja eliminar este registro?')) return;
    const { error } = await supabase.from('alunos').delete().eq('id', id);
    if (!error) carregarDados();
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

  const menuItens = [
    { nome: 'Painel', icone: '🏠', temSeta: false },
    { nome: 'Usuarios', icone: '👤', temSeta: false },
    { nome: 'Planos', icone: '🎟️', temSeta: false },
    { nome: 'Frequência', icone: '📅', temSeta: false },
    { nome: 'Exercicios', icone: '🏋️', temSeta: true },
    { nome: 'Treinos', icone: '🏃', temSeta: true },
    { nome: 'Nutrição', icone: '🥣', temSeta: true },
    { nome: 'Vendas', icone: '🛍️', temSeta: true },
    { nome: 'Financeiro', icone: '💵', temSeta: true },
    { nome: 'Relatorios', icone: '📋', temSeta: false },
    { nome: 'Configurações', icone: '⚙️', temSeta: false },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#13151f', color: '#fff', fontFamily: 'sans-serif' }}>
      
      <aside style={{ width: '220px', backgroundColor: '#1a1d2b', borderRight: '1px solid #24283b', padding: '1.2rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1.2rem', paddingLeft: '0.8rem' }}>FitGestão</h2>
        
        {menuItens.map((item) => {
          const estaAtivo = abaAtiva === item.nome;
          return (
            <button
              key={item.nome}
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

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #24283b' }}>
          <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #3a3f55', backgroundColor: 'transparent', color: '#ff5c5c', cursor: 'pointer', fontSize: '0.85rem' }}>
            Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {abaAtiva === 'Painel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Bem Vindo Admin Principal! 🎉</h3>
                  <p style={{ color: '#8a8f9d', fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>Total de lucro no mês</p>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>R$ {metricas.totalLucro.toFixed(2)}</h2>
                </div>
                <div style={{ fontSize: '4rem' }}>🧑‍💻</div>
              </div>

              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.85rem' }}>👥 Total Usuários</span>
                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{metricas.totalUsuarios}</h2>
              </div>

              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.85rem' }}>🛑 Usuários em Atraso</span>
                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#ff5c5c' }}>{metricas.usuariosAtraso}</h2>
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'Planos' && (
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
                  value={duracaoMesesForm}
                  onChange={(e) => setDuracaoMesesForm(Number(e.target.value))}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                >
                  <option value={1}>1 Mês (Mensal)</option>
                  <option value={3}>3 Meses (Trimestral)</option>
                  <option value={6}>6 Meses (Semestral)</option>
                  <option value={12}>1 Ano (Anual)</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor Total do Plano (R$) *"
                  value={valorTotalForm}
                  onChange={(e) => setValorTotalForm(e.target.value)}
                  required
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                />

                <input
                  type="text"
                  placeholder="Descrição ou Benefícios"
                  value={descricaoPlanoForm}
                  onChange={(e) => setDescricaoPlanoForm(e.target.value)}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {planos.map((plano) => {
                const equivalenteMensal = (plano.valor_total / plano.duracao_meses).toFixed(2);
                return (
                  <div key={plano.id} style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{plano.nome}</h4>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', backgroundColor: '#635bfc', color: '#fff', fontWeight: 'bold' }}>
                          {plano.duracao_meses === 1 ? '1 Mês' : plano.duracao_meses === 3 ? '3 Meses' : plano.duracao_meses === 6 ? '6 Meses' : '1 Ano'}
                        </span>
                      </div>
                      <p style={{ color: '#8a8f9d', fontSize: '0.85rem', marginTop: '0.5rem' }}>{plano.descricao || 'Sem descrição.'}</p>
                    </div>

                    <div style={{ borderTop: '1px solid #2a2f42', paddingTop: '1rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#22c55e' }}>
                        R$ {plano.valor_total.toFixed(2)}
                      </h2>
                      <span style={{ fontSize: '0.8rem', color: '#8a8f9d' }}>
                        Equivalente a R$ {equivalenteMensal} / mês
                      </span>
                    </div>

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

        {abaAtiva === 'Frequência' && (
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

                {diasDoMes.map((item, index) => {
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

        {abaAtiva === 'Usuarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Cadastrar Novo Aluno</h3>
              <form onSubmit={handleCadastrarAluno} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <input type="text" placeholder="Nome Completo *" value={nome} onChange={(e) => setNome(e.target.value)} required style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                
                <select
                  value={planoSelecionadoNome}
                  onChange={(e) => handleSelecionarPlanoAluno(e.target.value)}
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                >
                  {planos.map((p) => (
                    <option key={p.id} value={p.nome}>{p.nome}</option>
                  ))}
                </select>

                <input type="number" placeholder="Valor (R$)" value={valorMensalidade} onChange={(e) => setValorMensalidade(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="number" placeholder="Dia Vencimento" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="text" placeholder="Nível / Faixa" value={graduacao} onChange={(e) => setGraduacao(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <select 
                  value={statusPagamento} 
                  onChange={(e) => setStatusPagamento(e.target.value as 'Em Dia' | 'Pendente' | 'Atrasado')} 
                  style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}
                >
                  <option value="Em Dia">Em Dia</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Atrasado">Atrasado</option>
                </select>
                <button type="submit" disabled={carregando} style={{ padding: '0.6rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: '#635bfc', color: '#fff', fontWeight: 'bold', cursor: 'pointer', gridColumn: '1 / -1' }}>
                  {carregando ? 'Salvando...' : 'Cadastrar Aluno'}
                </button>
              </form>
            </div>

            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Lista de Alunos</h3>
                <input type="text" placeholder="Pesquisar..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff', width: '200px' }} />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2f42', color: '#8a8f9d' }}>
                    <th style={{ padding: '0.8rem' }}>NOME</th>
                    <th style={{ padding: '0.8rem' }}>PLANO VINCULADO</th>
                    <th style={{ padding: '0.8rem' }}>VALOR MENSAL</th>
                    <th style={{ padding: '0.8rem' }}>VENC.</th>
                    <th style={{ padding: '0.8rem' }}>PAGAMENTO</th>
                    <th style={{ padding: '0.8rem', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase())).map((aluno) => (
                    <tr key={aluno.id} style={{ borderBottom: '1px solid #1a1d2b' }}>
                      <td style={{ padding: '0.8rem' }}>{aluno.nome}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#2a2f42', fontSize: '0.8rem', color: '#635bfc', fontWeight: 'bold' }}>
                          {aluno.plano_nome || 'Plano Mensal'}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem' }}>R$ {Number(aluno.valor_mensalidade || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.8rem' }}>Dia {aluno.dia_vencimento || 10}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: aluno.status_pagamento === 'Em Dia' ? '#166534' : '#991b1b', color: '#fff' }}>
                          {aluno.status_pagamento}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem', textAlign: 'right' }}>
                        {aluno.status_pagamento !== 'Em Dia' && (
                          <button onClick={() => handleDarBaixa(aluno.id)} style={{ padding: '0.3rem 0.6rem', marginRight: '0.5rem', backgroundColor: '#22c55e', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Baixa</button>
                        )}
                        <button onClick={() => handleEliminar(aluno.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaAtiva !== 'Painel' && abaAtiva !== 'Planos' && abaAtiva !== 'Frequência' && abaAtiva !== 'Usuarios' && (
          <div style={{ backgroundColor: '#1e2230', padding: '3rem', borderRadius: '12px', border: '1px solid #2a2f42', textAlign: 'center' }}>
            <h2>Módulo de {abaAtiva}</h2>
            <p style={{ color: '#8a8f9d', marginTop: '0.5rem' }}>Esta secção está pronta para ser conectada às tabelas de {abaAtiva.toLowerCase()} do Supabase.</p>
          </div>
        )}

      </main>
    </div>
  );
}