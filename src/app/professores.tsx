'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Professor {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criado_em: string;
}

const card: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.25rem' };
const input: React.CSSProperties = { width: '100%', padding: '.75rem', borderRadius: 7, border: '1px solid #3a3f55', background: '#13151f', color: '#fff', boxSizing: 'border-box' };
const button: React.CSSProperties = { padding: '.7rem 1rem', border: 0, borderRadius: 7, background: '#635bfc', color: '#fff', fontWeight: 600, cursor: 'pointer' };

export function Professores({ userId }: { userId: string }) {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('gestao_professores')
      .select('id,nome,email,ativo,criado_em').eq('owner_id', userId).order('nome');
    if (error) setErro(`Não foi possível carregar os professores: ${error.message}. Confirme se executou 20261026_contas_professores.sql no Supabase.`);
    else { setProfessores((data || []) as Professor[]); setErro(''); }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    // O carregamento consulta o Supabase e atualiza o estado após a resposta assíncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setMensagem(''); setSalvando(true);
    const { data: sessao } = await supabase.auth.getSession();
    const resposta = await fetch('/api/professores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.session?.access_token || ''}` },
      body: JSON.stringify({ nome, email, senha })
    });
    const resultado = await resposta.json().catch(() => ({}));
    setSalvando(false);
    if (!resposta.ok) { setErro(resultado.error || 'Não foi possível criar a conta.'); return; }
    setMensagem(`Conta criada para ${resultado.nome}. A senha não fica salva nesta tela; entregue a senha inicial ao professor com segurança.`);
    setNome(''); setEmail(''); setSenha(''); await carregar();
  }

  async function alternar(professor: Professor) {
    setErro(''); setMensagem('');
    const { data: sessao } = await supabase.auth.getSession();
    const resposta = await fetch('/api/professores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.session?.access_token || ''}` },
      body: JSON.stringify({ id: professor.id, ativo: !professor.ativo })
    });
    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) { setErro(resultado.error || 'Não foi possível alterar o acesso.'); return; }
    setMensagem(professor.ativo ? 'Acesso desativado. O professor perdeu acesso aos dados da academia.' : 'Acesso reativado.');
    await carregar();
  }

  return <section style={{ display: 'grid', gap: '1rem' }}>
    <div style={card}>
      <h2 style={{ margin: '0 0 .5rem' }}>Contas de professores</h2>
      <p style={{ color: '#aeb5c6', lineHeight: 1.5 }}>Crie um e-mail e uma senha inicial para cada professor. Eles terão acesso a alunos, presenças, exercícios, treinos e nutrição. Não terão acesso a Financeiro, Cobranças, Vendas ou relatórios financeiros.</p>
      <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '.8rem', alignItems: 'end' }}>
        <label style={labelStyle}>Nome do professor<input style={input} value={nome} onChange={e => setNome(e.target.value)} maxLength={120} required autoComplete="name" /></label>
        <label style={labelStyle}>E-mail de acesso<input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required autoComplete="email" /></label>
        <label style={labelStyle}>Senha inicial<input style={input} type="password" value={senha} onChange={e => setSenha(e.target.value)} minLength={10} maxLength={72} required autoComplete="new-password" placeholder="Mínimo 10 caracteres" /></label>
        <button type="submit" disabled={salvando} style={{ ...button, opacity: salvando ? .7 : 1 }}>{salvando ? 'Criando conta…' : '＋ Cadastrar professor'}</button>
      </form>
      <p style={{ color: '#9299ab', fontSize: '.82rem', marginBottom: 0 }}>A senha é enviada diretamente ao Supabase Auth para autenticação e não é guardada na tabela de professores.</p>
    </div>
    {erro && <div role="alert" style={{ ...card, borderColor: '#7f1d1d', color: '#fecaca' }}>{erro}</div>}
    {mensagem && <div role="status" style={{ ...card, borderColor: '#166534', color: '#bbf7d0' }}>{mensagem}</div>}
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Equipe cadastrada</h3>
      {carregando ? <p style={{ color: '#aeb5c6' }}>Carregando…</p> : professores.length === 0 ? <p style={{ color: '#aeb5c6' }}>Nenhum professor cadastrado.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}><thead><tr>{['Nome','E-mail','Acesso',''].map(item => <th key={item} style={thStyle}>{item}</th>)}</tr></thead><tbody>{professores.map(p => <tr key={p.id}><td style={tdStyle}>{p.nome}</td><td style={tdStyle}>{p.email}</td><td style={tdStyle}><span style={{ color: p.ativo ? '#86efac' : '#fca5a5' }}>{p.ativo ? 'Ativo' : 'Desativado'}</span></td><td style={tdStyle}><button type="button" onClick={() => void alternar(p)} style={{ ...button, background: p.ativo ? '#7f1d1d' : '#166534' }}>{p.ativo ? 'Desativar acesso' : 'Reativar acesso'}</button></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}

const labelStyle: React.CSSProperties = { display: 'grid', gap: '.4rem', color: '#cbd5e1', fontSize: '.85rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', color: '#aeb5c6', padding: '.7rem', borderBottom: '1px solid #34394c' };
const tdStyle: React.CSSProperties = { padding: '.7rem', borderBottom: '1px solid #292e40' };
