'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

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
  const [abaAtiva, setAbaAtiva] = useState<string>('Painel');
  const [busca, setBusca] = useState<string>('');

  // Formulário de Cadastro de Aluno
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoNome, setPlanoNome] = useState('Mensal');
  const [valorMensalidade, setValorMensalidade] = useState('120.00');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [statusPagamento, setStatusPagamento] = useState<'Em Dia' | 'Pendente' | 'Atrasado'>('Em Dia');
  const [graduacao, setGraduacao] = useState('Iniciante');

  // Autenticação
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modoAuth, setModoAuth] = useState<'login' | 'signup'>('login');
  const [authCarregando, setAuthCarregando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  async function carregarAlunos() {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .or(`user_id.eq.${session.user.id},academia_id.eq.${session.user.id}`)
      .order('id', { ascending: false });

    if (!error) setAlunos(data || []);
  }

  useEffect(() => {
    if (session) carregarAlunos();
    else setAlunos([]);
  }, [session]);

  // Cálculos do Dashboard
  const metricas = useMemo(() => {
    const totalUsuarios = alunos.length;
    const usuariosAtraso = alunos.filter((a) => a.status_pagamento !== 'Em Dia').length;
    const totalRecebido = alunos
      .filter((a) => a.status_pagamento === 'Em Dia')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);
    const valoresAReceber = alunos
      .filter((a) => a.status_pagamento !== 'Em Dia')
      .reduce((acc, curr) => acc + (Number(curr.valor_mensalidade) || 0), 0);
    const totalLucro = totalRecebido; // Pode subtrair despesas quando implementado

    return { totalUsuarios, usuariosAtraso, totalRecebido, totalLucro, valoresAReceber };
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
      carregarAlunos();
    }
  }

  async function handleDarBaixa(id?: number) {
    if (!id) return;
    const { error } = await supabase.from('alunos').update({ status_pagamento: 'Em Dia' }).eq('id', id);
    if (!error) carregarAlunos();
  }

  async function handleEliminar(id?: number) {
    if (!id || !confirm('Deseja eliminar este registro?')) return;
    const { error } = await supabase.from('alunos').delete().eq('id', id);
    if (!error) carregarAlunos();
  }

  if (!session) {
    return (
      <div style={{ backgroundColor: '#13151f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ backgroundColor: '#1e2230', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #2a2f42' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>{modoAuth === 'login' ? 'FitGestão - Login' : 'Criar Conta'}</h2>
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
      {/* Sidebar Lateral */}
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
              textAlign: 'left',
              transition: '0.2s'
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

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {abaAtiva === 'Painel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Linha Superior: Banner de Boas-Vindas + Métricas Rápida */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Bem Vindo Admin Principal! 🎉</h3>
                  <p style={{ color: '#8a8f9d', fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>Total de lucro no mês</p>
                  <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>R$ {metricas.totalLucro.toFixed(2)}</h2>
                  <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#635bfc', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Ver Perfil</button>
                </div>
                <div style={{ fontSize: '4rem' }}>🧑‍💻</div>
              </div>

              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.85rem' }}>👥 Total Usuários</span>
                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{metricas.totalUsuarios}</h2>
                <span style={{ color: '#52586d', fontSize: '0.75rem' }}>Em todos os anos</span>
              </div>

              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.85rem' }}>🛑 Usuários em Atraso</span>
                <h2 style={{ fontSize: '2rem', margin: '0.5rem 0', color: '#ff5c5c' }}>{metricas.usuariosAtraso}</h2>
                <span style={{ color: '#52586d', fontSize: '0.75rem' }}>No geral</span>
              </div>
            </div>

            {/* Segunda Linha: KPIs Financeiros */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#1e2230', padding: '1.2rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.8rem' }}>💵 Total Recebido</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: '#22c55e' }}>{metricas.totalRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              </div>
              <div style={{ backgroundColor: '#1e2230', padding: '1.2rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.8rem' }}>🟣 Total Lucro</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: '#a855f7' }}>{metricas.totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              </div>
              <div style={{ backgroundColor: '#1e2230', padding: '1.2rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.8rem' }}>🔻 Total Despesas</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: '#ef4444' }}>R$ 0,00</h3>
              </div>
              <div style={{ backgroundColor: '#1e2230', padding: '1.2rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <span style={{ color: '#8a8f9d', fontSize: '0.8rem' }}>⏳ Valores a Receber</span>
                <h3 style={{ margin: '0.5rem 0 0 0', color: '#eab308' }}>{metricas.valoresAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              </div>
            </div>

            {/* Terceira Linha: Gráfico de Receitas e Relação de Planos */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              {/* Gráfico de Receitas Simulado em Grid CSS */}
              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <h4 style={{ margin: 0 }}>Receitas</h4>
                <p style={{ color: '#8a8f9d', fontSize: '0.8rem', marginTop: '0.2rem' }}>Lucro dos últimos 12 meses</p>
                
                <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #2a2f42' }}>
                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((mes, idx) => (
                    <div key={mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '100%', backgroundColor: '#635bfc', height: `${(idx + 1) * 12}px`, borderRadius: '4px 4px 0 0', opacity: 0.8 }}></div>
                      <span style={{ fontSize: '0.7rem', color: '#8a8f9d' }}>{mes}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Relação de Planos */}
              <div style={{ backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' }}>
                <h4 style={{ margin: 0 }}>Relação de Planos</h4>
                <p style={{ color: '#8a8f9d', fontSize: '0.8rem', marginTop: '0.2rem' }}>Planos mais adquiridos</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.5rem', backgroundColor: '#13151f', borderRadius: '6px' }}>
                    <span>Plano Mensal</span>
                    <span style={{ color: '#635bfc', fontWeight: 'bold' }}>{alunos.filter(a => a.plano_nome === 'Mensal').length} alunos</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.5rem', backgroundColor: '#13151f', borderRadius: '6px' }}>
                    <span>Plano VIP / Anual</span>
                    <span style={{ color: '#635bfc', fontWeight: 'bold' }}>{alunos.filter(a => a.plano_nome !== 'Mensal').length} alunos</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Aba Usuários (Listagem e Cadastro) */}
        {(abaAtiva === 'Usuários' || abaAtiva === 'Painel') && (
          <div style={{ marginTop: abaAtiva === 'Painel' ? '2rem' : 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Form de Cadastro */}
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

            {/* Tabela de Alunos */}
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

        {/* Mensagem Padrão para Outras Abas */}
        {abaAtiva !== 'Painel' && abaAtiva !== 'Usuários' && (
          <div style={{ backgroundColor: '#1e2230', padding: '3rem', borderRadius: '12px', border: '1px solid #2a2f42', textAlign: 'center' }}>
            <h2>Módulo de {abaAtiva}</h2>
            <p style={{ color: '#8a8f9d', marginTop: '0.5rem' }}>Esta secção está pronta para ser conectada às tabelas de {abaAtiva.toLowerCase()} do Supabase.</p>
          </div>
        )}

      </main>
    </div>
  );
}