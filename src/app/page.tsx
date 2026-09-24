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
  data: string; // YYYY-MM-DD
  user_id?: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [frequencias, setFrequencias] = useState<Frequencia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<string>('Painel');
  const [busca, setBusca] = useState<string>('');

  // Estados de Frequência
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState<string | number | null>(null);
  const [mesAtual, setMesAtual] = useState<Date>(new Date());

  // Form Aluno
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoNome, setPlanoNome] = useState('Mensal');
  const [valorMensalidade, setValorMensalidade] = useState('120.00');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [statusPagamento, setStatusPagamento] = useState<'Em Dia' | 'Pendente' | 'Atrasado'>('Em Dia');
  const [graduacao, setGraduacao] = useState('Iniciante');

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
  }

  useEffect(() => {
    if (session) carregarDados();
    else {
      setAlunos([]);
      setFrequencias([]);
    }
  }, [session]);

  // Presença Hoje
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

  // Calendário
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

  // KPIs
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
        plano_nome: planoNome,
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#13151f', color: '#fff', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '240px', backgroundColor: '#1a1d2b', borderRight: '1px solid #24283b', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '1.5rem', paddingLeft: '0.5rem' }}>FitGestão</h2>
        
        {[
          { nome: 'Painel', icone: '📊' },
          { nome: 'Usuários', icone: '👥' },
          { nome: 'Planos', icone: '📋' },
          { nome: 'Frequência', icone: '📅' },
          { nome: 'Exercícios', icone: '🏋️' },
          { nome: 'Treinos', icone: '📝' },
          { nome: 'Nutrição', icone: '🥗' },
          { nome: 'Vendas', icone: '🛍️' },
          { nome: 'Financeiro', icone: '💰' },
          { nome: 'Relatórios', icone: '📈' },
          { nome: 'Configurações', icone: '⚙️' },
        ].map((item) => (
          <button
            key={item.nome}
            onClick={() => setAbaAtiva(item.nome)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.8rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: abaAtiva === item.nome ? '#635bfc' : 'transparent',
              color: abaAtiva === item.nome ? '#fff' : '#8a8f9d',
              fontWeight: abaAtiva === item.nome ? 'bold' : 'normal',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span>{item.icone}</span>
            <span>{item.nome}</span>
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #24283b' }}>
          <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #3a3f55', backgroundColor: 'transparent', color: '#ff5c5c', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </aside>

      {/* Principal */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {/* Painel */}
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

        {/* Frequência */}
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

            {/* Calendário */}
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

        {/* Usuários */}
        {abaAtiva === 'Usuários' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Cadastrar Novo Aluno</h3>
              <form onSubmit={handleCadastrarAluno} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <input type="text" placeholder="Nome Completo *" value={nome} onChange={(e) => setNome(e.target.value)} required style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="text" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="text" placeholder="Plano" value={planoNome} onChange={(e) => setPlanoNome(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="number" placeholder="Valor (R$)" value={valorMensalidade} onChange={(e) => setValorMensalidade(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="number" placeholder="Dia Vencimento" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <input type="text" placeholder="Nível / Faixa" value={graduacao} onChange={(e) => setGraduacao(e.target.value)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }} />
                <select value={statusPagamento} onChange={(e) => setStatusPagamento(e.target.value as any)} style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #2a2f42', backgroundColor: '#13151f', color: '#fff' }}>
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
                    <th style={{ padding: '0.8rem' }}>PLANO</th>
                    <th style={{ padding: '0.8rem' }}>VALOR</th>
                    <th style={{ padding: '0.8rem' }}>VENC.</th>
                    <th style={{ padding: '0.8rem' }}>PAGAMENTO</th>
                    <th style={{ padding: '0.8rem', textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase())).map((aluno) => (
                    <tr key={aluno.id} style={{ borderBottom: '1px solid #1a1d2b' }}>
                      <td style={{ padding: '0.8rem' }}>{aluno.nome}</td>
                      <td style={{ padding: '0.8rem' }}>{aluno.plano_nome || 'Mensal'}</td>
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

      </main>
    </div>
  );
}