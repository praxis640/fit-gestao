'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
interface Aluno {
  id: number;
  nome: string;
  telefone: string;
  status?: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Estados de Autenticação
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeAcademia, setNomeAcademia] = useState('');
  const [authError, setAuthError] = useState('');

  // Estados dos Alunos
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [nomeAluno, setNomeAluno] = useState('');
  const [telefoneAluno, setTelefoneAluno] = useState('');
  const [statusAluno, setStatusAluno] = useState('Ativo');
  const [idEditando, setIdEditando] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Formatar Telefone
  function formatarTelefone(valor: string) {
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11);
    if (apenasNumeros.length <= 2) return apenasNumeros;
    if (apenasNumeros.length <= 7)
      return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2)}`;
    return `(${apenasNumeros.slice(0, 2)}) ${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
  }

  // Verificar Sessão de Login do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Buscar Alunos da Academia Logada
  async function carregarAlunos() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .order('id', { ascending: false });

    if (!error) {
      setAlunos(data || []);
    }
  }

  useEffect(() => {
    if (session) {
      carregarAlunos();
    }
  }, [session]);

  // Handler de Login e Registo da Academia
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setCarregando(true);

    if (isRegistering) {
      // 1. Criar Utilizador
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setCarregando(false);
        return;
      }

      // 2. Criar Perfil da Academia na tabela 'academias'
      if (data.user) {
        const { error: profileError } = await supabase.from('academias').insert([
          {
            id: data.user.id,
            nome: nomeAcademia,
          },
        ]);

        if (profileError) {
          console.error('Erro ao guardar perfil da academia:', profileError);
        }
      }
    } else {
      // Fazer Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError('E-mail ou palavra-passe incorretos.');
      }
    }

    setCarregando(false);
  }

  // Sair da Conta
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // Cadastrar ou Editar Aluno
  async function salvarAluno(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;

    setCarregando(true);

    if (idEditando) {
      const { error } = await supabase
        .from('alunos')
        .update({
          nome: nomeAluno,
          telefone: telefoneAluno,
          status: statusAluno,
        })
        .eq('id', idEditando);

      if (error) {
        alert(`Erro ao atualizar: ${error.message}`);
      } else {
        cancelarEdicao();
        carregarAlunos();
      }
    } else {
      const { error } = await supabase.from('alunos').insert([
        {
          nome: nomeAluno,
          telefone: telefoneAluno,
          status: statusAluno,
          academia_id: session.user.id, // Vincula o aluno à academia logada
        },
      ]);

      if (error) {
        alert(`Erro ao cadastrar: ${error.message}`);
      } else {
        setNomeAluno('');
        setTelefoneAluno('');
        setStatusAluno('Ativo');
        carregarAlunos();
      }
    }

    setCarregando(false);
  }

  function iniciarEdicao(aluno: Aluno) {
    setIdEditando(aluno.id);
    setNomeAluno(aluno.nome);
    setTelefoneAluno(aluno.telefone);
    setStatusAluno(aluno.status || 'Ativo');
  }

  function cancelarEdicao() {
    setIdEditando(null);
    setNomeAluno('');
    setTelefoneAluno('');
    setStatusAluno('Ativo');
  }

  async function eliminarAluno(id: number, nome: string) {
    if (!confirm(`Eliminar o aluno ${nome}?`)) return;

    const { error } = await supabase.from('alunos').delete().eq('id', id);

    if (error) {
      alert(`Erro ao eliminar: ${error.message}`);
    } else {
      carregarAlunos();
    }
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        A carregar sistema...
      </div>
    );
  }

  // --- TELA DE LOGIN / REGISTO DA ACADEMIA ---
  if (!session) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 text-center">FitGestão</h1>
            <p className="text-gray-500 text-sm text-center mt-1">
              {isRegistering
                ? 'Registe a sua Academia Parceira'
                : 'Aceda ao painel da sua Academia'}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome da Academia
                </label>
                <input
                  type="text"
                  placeholder="Ex: Academia Fit Life"
                  value={nomeAcademia}
                  onChange={(e) => setNomeAcademia(e.target.value)}
                  required
                  className="w-full p-2.5 border rounded-lg text-sm text-gray-800"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                E-mail da Academia
              </label>
              <input
                type="email"
                placeholder="academia@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2.5 border rounded-lg text-sm text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Palavra-passe
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-2.5 border rounded-lg text-sm text-gray-800"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {carregando
                ? 'A processar...'
                : isRegistering
                ? 'Criar Conta da Academia'
                : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {isRegistering
                ? 'Já tem conta? Faça login aqui'
                : 'Ainda não tem conta? Registe a sua academia'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- TELA PRINCIPAL DA ACADEMIA LOGADA ---
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <header className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FitGestão</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Sessão iniciada como: <strong>{session.user.email}</strong>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors"
          >
            Sair
          </button>
        </header>

        {/* Formulário de Alunos */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {idEditando ? 'Editar Aluno' : 'Cadastrar Aluno na Minha Academia'}
            </h2>
            {idEditando && (
              <button
                type="button"
                onClick={cancelarEdicao}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancelar edição
              </button>
            )}
          </div>

          <form onSubmit={salvarAluno} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nome do Aluno"
              value={nomeAluno}
              onChange={(e) => setNomeAluno(e.target.value)}
              required
              className="p-2.5 border rounded-lg text-sm text-gray-800"
            />
            <input
              type="text"
              placeholder="Telefone (00) 00000-0000"
              value={telefoneAluno}
              onChange={(e) => setTelefoneAluno(formatarTelefone(e.target.value))}
              required
              className="p-2.5 border rounded-lg text-sm text-gray-800"
            />
            <select
              value={statusAluno}
              onChange={(e) => setStatusAluno(e.target.value)}
              className="p-2.5 border rounded-lg text-sm bg-white text-gray-800"
            >
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Vencido">Vencido</option>
            </select>
            <button
              type="submit"
              disabled={carregando}
              className={`font-medium px-5 py-2.5 rounded-lg text-sm text-white transition-colors ${
                idEditando ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {carregando ? 'A guardar...' : idEditando ? 'Atualizar' : 'Cadastrar'}
            </button>
          </form>
        </section>

        {/* Tabela de Alunos da Academia */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Alunos Registados</h2>
            <span className="text-xs text-gray-500">
              Total: <strong>{alunos.length}</strong>
            </span>
          </div>

          {alunos.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum aluno cadastrado nesta academia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Nome</th>
                    <th className="p-4">Telefone</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {alunos.map((aluno) => (
                    <tr key={aluno.id} className="hover:bg-gray-50/50">
                      <td className="p-4 font-medium text-gray-900">{aluno.nome}</td>
                      <td className="p-4 text-gray-600">{aluno.telefone}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                          {aluno.status || 'Ativo'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => iniciarEdicao(aluno)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarAluno(aluno.id, aluno.nome)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs"
                        >
                          Eliminar
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
    </main>
  );
}