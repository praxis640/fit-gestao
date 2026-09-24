'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// Interface do Aluno tipada em TypeScript
interface Aluno {
  id?: number;
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

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [busca, setBusca] = useState<string>('');

  // Formulário do Aluno
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [planoNome, setPlanoNome] = useState('Mensal');
  const [valorMensalidade, setValorMensalidade] = useState('120.00');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [statusPagamento, setStatusPagamento] = useState<'Em Dia' | 'Pendente' | 'Atrasado'>('Em Dia');
  const [graduacao, setGraduacao] = useState('Iniciante / Faixa Branca');

  // Autenticação
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modoAuth, setModoAuth] = useState<'login' | 'signup'>('login');
  const [authCarregando, setAuthCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function carregarAlunos() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .or(`user_id.eq.${session.user.id},academia_id.eq.${session.user.id}`)
      .order('id', { ascending: false });

    if (!error) {
      setAlunos(data || []);
    } else {
      console.error('Erro ao carregar alunos:', error.message);
    }
  }

  useEffect(() => {
    if (session) {
      carregarAlunos();
    } else {
      setAlunos([]);
    }
  }, [session]);

  // Cálculos do Dashboard (Métricas)
  const metricas = useMemo(() => {
    const ativos = alunos.filter((a) => a.status === 'Ativo').length;
    const emDia = alunos.filter((a) => a.status_pagamento === 'Em Dia').length;
    const pendentesAtrasados = alunos.filter((a) => a.status_pagamento !== 'Em Dia').length;
    const receitaPrevista = alunos
      .filter((a) => a.status === 'Ativo')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);

    return { ativos, emDia, pendentesAtrasados, receitaPrevista };
  }, [alunos]);

  // Filtro de Alunos na Tabela
  const alunosFiltrados = useMemo(() => {
    return alunos.filter((aluno) => {
      const bateNome = aluno.nome.toLowerCase().includes(busca.toLowerCase());
      if (filtroStatus === 'Todos') return bateNome;
      if (filtroStatus === 'Em Dia') return bateNome && aluno.status_pagamento === 'Em Dia';
      if (filtroStatus === 'Pendentes') return bateNome && aluno.status_pagamento !== 'Em Dia';
      if (filtroStatus === 'Inativos') return bateNome && aluno.status === 'Inativo';
      return bateNome;
    });
  }, [alunos, busca, filtroStatus]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthCarregando(true);

    if (modoAuth === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('Erro ao entrar: ' + error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert('Erro ao criar conta: ' + error.message);
      else alert('Conta criada com sucesso! Faça login.');
    }

    setAuthCarregando(false);
  }

  async function handleCadastrarAluno(e: React.FormEvent) {
    e.preventDefault();

    if (!session?.user?.id) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    if (!nome.trim()) {
      alert('Por favor, informe o nome do aluno.');
      return;
    }

    setCarregando(true);

    const { error } = await supabase
      .from('alunos')
      .insert([
        {
          nome,
          telefone,
          status,
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

    if (error) {
      console.error('Erro ao salvar aluno:', error.message);
      alert('Erro ao cadastrar: ' + error.message);
    } else {
      setNome('');
      setTelefone('');
      setValorMensalidade('120.00');
      carregarAlunos();
    }
  }

  async function handleDarBaixaPagamento(id?: number) {
    if (!id) return;

    const { error } = await supabase
      .from('alunos')
      .update({ status_pagamento: 'Em Dia' })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar pagamento: ' + error.message);
    } else {
      carregarAlunos();
    }
  }

  async function handleTrocarFaixa(id?: number, graduacaoAtual?: string) {
    if (!id) return;

    const novaGraduacao = prompt('Digite a nova Faixa / Nível do Aluno:', graduacaoAtual || '');
    if (!novaGraduacao) return;

    const { error } = await supabase
      .from('alunos')
      .update({ graduacao: novaGraduacao })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar graduação: ' + error.message);
    } else {
      carregarAlunos();
    }
  }

  async function handleEliminarAluno(id?: number) {
    if (!id) return;
    if (!confirm('Tem certeza que deseja eliminar este aluno?')) return;

    const { error } = await supabase
      .from('alunos')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erro ao eliminar aluno: ' + error.message);
    } else {
      carregarAlunos();
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
        <h1>FitGestão</h1>
        {session && (
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            Sair
          </button>
        )}
      </div>

      {!session ? (
        /* Formulário de Login */
        <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
          <h2>{modoAuth === 'login' ? 'Acessar a Conta' : 'Criar Nova Conta'}</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>E-mail:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem' }}>Senha:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                placeholder="******"
              />
            </div>
            <button type="submit" disabled={authCarregando} style={{ padding: '0.7rem', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
              {authCarregando ? 'A aguardar...' : modoAuth === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>
          <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
            <button 
              onClick={() => setModoAuth(modoAuth === 'login' ? 'signup' : 'login')}
              style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {modoAuth === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
          </p>
        </div>
      ) : (
        <div>
          {/* Cartões de Métricas / KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Alunos Ativos</span>
              <h2 style={{ margin: '0.5rem 0 0 0', color: '#0070f3' }}>{metricas.ativos}</h2>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Pagamentos Em Dia</span>
              <h2 style={{ margin: '0.5rem 0 0 0', color: '#2e7d32' }}>{metricas.emDia}</h2>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Pendentes / Atrasados</span>
              <h2 style={{ margin: '0.5rem 0 0 0', color: '#c62828' }}>{metricas.pendentesAtrasados}</h2>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Receita Mensal Prevista</span>
              <h2 style={{ margin: '0.5rem 0 0 0', color: '#1565c0' }}>R$ {metricas.receitaPrevista.toFixed(2)}</h2>
            </div>
          </div>

          {/* Form de Cadastro Completo */}
          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Cadastrar Novo Aluno com Plano e Nível</h3>
            <form onSubmit={handleCadastrarAluno} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Nome completo *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ padding: '0.5rem' }}
                required
              />
              <input
                type="text"
                placeholder="Telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <input
                type="text"
                placeholder="Plano (ex: Mensal, VIP)"
                value={planoNome}
                onChange={(e) => setPlanoNome(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Valor Mensalidade (R$)"
                value={valorMensalidade}
                onChange={(e) => setValorMensalidade(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <input
                type="number"
                placeholder="Dia Vencimento (ex: 10)"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <input
                type="text"
                placeholder="Faixa / Nível (ex: Azul, Iniciante)"
                value={graduacao}
                onChange={(e) => setGraduacao(e.target.value)}
                style={{ padding: '0.5rem' }}
              />
              <select 
                value={statusPagamento} 
                onChange={(e) => setStatusPagamento(e.target.value as 'Em Dia' | 'Pendente' | 'Atrasado')}
                style={{ padding: '0.5rem' }}
              >
                <option value="Em Dia">Em Dia</option>
                <option value="Pendente">Pendente</option>
                <option value="Atrasado">Atrasado</option>
              </select>
              <button type="submit" disabled={carregando} style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', gridColumn: '1 / -1' }}>
                {carregando ? 'A guardar...' : 'Cadastrar Aluno'}
              </button>
            </form>
          </section>

          {/* Filtros e Busca */}
          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <h3>Alunos Registados</h3>
              <input
                type="text"
                placeholder="Pesquisar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ padding: '0.5rem', width: '220px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['Todos', 'Em Dia', 'Pendentes', 'Inativos'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroStatus(f)}
                  style={{
                    padding: '0.3rem 0.8rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: filtroStatus === f ? '#0070f3' : '#fff',
                    color: filtroStatus === f ? '#fff' : '#333'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Tabela de Alunos */}
            {alunosFiltrados.length === 0 ? (
              <p style={{ marginTop: '1rem' }}>Nenhum aluno encontrado.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                      <th style={{ padding: '0.5rem' }}>NOME</th>
                      <th style={{ padding: '0.5rem' }}>FAIXA / NÍVEL</th>
                      <th style={{ padding: '0.5rem' }}>VALOR</th>
                      <th style={{ padding: '0.5rem' }}>VENC.</th>
                      <th style={{ padding: '0.5rem' }}>PAGAMENTO</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunosFiltrados.map((aluno) => (
                      <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <strong>{aluno.nome}</strong>
                          {aluno.telefone && <br />}
                          <span style={{ fontSize: '0.8rem', color: '#777' }}>{aluno.telefone}</span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e3f2fd', color: '#1565c0', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {aluno.graduacao || 'Iniciante'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          R$ {Number(aluno.valor_mensalidade || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem' }}>Dia {aluno.dia_vencimento || 10}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            backgroundColor: aluno.status_pagamento === 'Em Dia' ? '#2e7d32' : aluno.status_pagamento === 'Atrasado' ? '#c62828' : '#f57c00'
                          }}>
                            {aluno.status_pagamento || 'Em Dia'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {aluno.status_pagamento !== 'Em Dia' && (
                            <button
                              onClick={() => handleDarBaixaPagamento(aluno.id)}
                              style={{ padding: '0.2rem 0.5rem', color: 'green', cursor: 'pointer', marginRight: '0.5rem' }}
                              title="Marcar como Em Dia"
                            >
                              💵 Baixa
                            </button>
                          )}
                          <button
                            onClick={() => handleTrocarFaixa(aluno.id, aluno.graduacao)}
                            style={{ padding: '0.2rem 0.5rem', color: '#0070f3', cursor: 'pointer', marginRight: '0.5rem' }}
                            title="Trocar Faixa / Nível"
                          >
                            🥋 Faixa
                          </button>
                          <button 
                            onClick={() => handleEliminarAluno(aluno.id)}
                            style={{ padding: '0.2rem 0.5rem', color: 'red', cursor: 'pointer' }}
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}