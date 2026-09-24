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
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [status, setStatus] = useState('Ativo');
  const [carregando, setCarregando] = useState(false);

  // 1. Gerenciar sessão do utilizador logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Buscar Alunos APENAS da Academia Logada
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

  // Recarregar lista sempre que a sessão mudar
  useEffect(() => {
    if (session) {
      carregarAlunos();
    } else {
      setAlunos([]);
    }
  }, [session]);

  // 3. Cadastrar Aluno Vinculado ao Utilizador Logado
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

  // 4. Eliminar Aluno
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
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>FitGestão</h1>
          {session && (
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Sessão iniciada como: <strong>{session.user.email}</strong>
            </p>
          )}
        </div>
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
        <p>Por favor, faça login para aceder aos seus alunos.</p>
      ) : (
        <div>
          <section style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h2>Cadastrar Aluno na Minha Academia</h2>
            <form onSubmit={handleCadastrarAluno} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nome do aluno"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ padding: '0.5rem', flex: '1', minWidth: '200px' }}
              />
              <input
                type="text"
                placeholder="Telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                style={{ padding: '0.5rem', flex: '1', minWidth: '150px' }}
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
              <h2>Alunos Registados</h2>
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