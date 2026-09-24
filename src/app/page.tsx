'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Aluno {
  id?: number;
  nome: string;
  telefone?: string;
  status?: string;
  user_id?: string;
  academia_id?: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [carregando, setCarregando] = useState(false);

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
      setStatus('Ativo');
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
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
        <h1>FitGestão</h1>
        {session && (
          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Sair
          </button>
        )}
      </div>

      {!session ? (
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
          <p style={{ marginBottom: '1.5rem', color: '#555' }}>
            Sessão iniciada como: <strong>{session.user.email}</strong>
          </p>

          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Cadastrar Aluno na Minha Academia</h3>
            <form onSubmit={handleCadastrarAluno} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nome do aluno"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ padding: '0.5rem', flex: '1', minWidth: '180px' }}
              />
              <input
                type="text"
                placeholder="Telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                style={{ padding: '0.5rem', flex: '1', minWidth: '140px' }}
              />
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
              <button type="submit" disabled={carregando} style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
                {carregando ? 'A guardar...' : 'Cadastrar'}
              </button>
            </form>
          </section>

          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Alunos Registados</h3>
              <span>Total: {alunos.length}</span>
            </div>

            {alunos.length === 0 ? (
              <p style={{ marginTop: '1rem' }}>Nenhum aluno cadastrado ainda.</p>
            ) : (
              <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '0.5rem' }}>NOME</th>
                    <th style={{ padding: '0.5rem' }}>TELEFONE</th>
                    <th style={{ padding: '0.5rem' }}>STATUS</th>
                    <th style={{ padding: '0.5rem' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno) => (
                    <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem' }}>{aluno.nome}</td>
                      <td style={{ padding: '0.5rem' }}>{aluno.telefone || '-'}</td>
                      <td style={{ padding: '0.5rem' }}>{aluno.status || 'Ativo'}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <button 
                          onClick={() => handleEliminarAluno(aluno.id)}
                          style={{ padding: '0.2rem 0.5rem', color: 'red', cursor: 'pointer' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </main>
  );
}