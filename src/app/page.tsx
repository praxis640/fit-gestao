'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface Aluno {
  id?: number;
  nome: string;
  telefone?: string;
  user_id?: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
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
      .eq('user_id', session.user.id) // <-- Filtra por user_id
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

  // 3. Cadastrar Aluno Vinculado ao user_id da sessão
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
          user_id: session.user.id // <-- Salva associado à academia
        }
      ]);

    setCarregando(false);

    if (error) {
      console.error('Erro ao salvar aluno:', error.message);
      alert('Erro ao cadastrar aluno: ' + error.message);
    } else {
      setNome('');
      setTelefone('');
      carregarAlunos();
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>FitGestão</h1>

      {!session ? (
        <p>Por favor, faça login para acessar os seus alunos.</p>
      ) : (
        <div>
          <h2>Cadastrar Novo Aluno</h2>
          <form onSubmit={handleCadastrarAluno} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Nome do aluno"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={{ padding: '0.5rem' }}
            />
            <input
              type="text"
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              style={{ padding: '0.5rem' }}
            />
            <button type="submit" disabled={carregando} style={{ padding: '0.5rem 1rem' }}>
              {carregando ? 'A guardar...' : 'Cadastrar'}
            </button>
          </form>

          <h2>Meus Alunos</h2>
          {alunos.length === 0 ? (
            <p>Nenhum aluno cadastrado ainda.</p>
          ) : (
            <ul>
              {alunos.map((aluno) => (
                <li key={aluno.id} style={{ marginBottom: '0.5rem' }}>
                  <strong>{aluno.nome}</strong> {aluno.telefone ? `- ${aluno.telefone}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}