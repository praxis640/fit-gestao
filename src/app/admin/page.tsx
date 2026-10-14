'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Building2, Users, Wallet, CircleAlert, RefreshCw, LogOut, ArrowUpRight, ShieldCheck, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { dinheiroSaas, hojeSaas, metricasSaas, proximoMesSaas, situacaoSaas, type AcademiaSaas, type PagamentoSaas } from '@/lib/saas';
import styles from './painel.module.css';

type Painel = { academias: AcademiaSaas[]; pagamentos: PagamentoSaas[] };
const vazio: Painel = { academias: [], pagamentos: [] };
const dataBR = (d: string | null) => d ? new Date(`${d.slice(0,10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definido';
const erroBanco = (message: string) => /schema cache|does not exist|Could not find/i.test(message)
  ? 'O painel ainda não foi instalado no Supabase. Execute o SQL 20261014_painel_administrativo.sql e autorize sua conta conforme o guia.' : message;

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [inicializando, setInicializando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [dados, setDados] = useState<Painel>(vazio);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [aba, setAba] = useState<'academias' | 'pagamentos'>('academias');
  const [editando, setEditando] = useState<AcademiaSaas | null>(null);
  const [pagando, setPagando] = useState<AcademiaSaas | null>(null);
  const [hoje, setHoje] = useState(hojeSaas);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const usuario = useRef<string | null>(null);
  const requisicao = useRef(0);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo) return;
      setSession(data.session); setInicializando(false);
      if (error) setMensagem(error.message);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      if (ativo) { setSession(nova); setInicializando(false); }
    });
    const timer = window.setInterval(() => setHoje(hojeSaas()), 60_000);
    return () => { ativo = false; data.subscription.unsubscribe(); window.clearInterval(timer); };
  }, []);

  const carregar = useCallback(async (id: string) => {
    const numero = ++requisicao.current;
    setCarregando(true); setMensagem('');
    try {
      const { data: admin, error: erroAdmin } = await supabase.rpc('saas_eh_admin');
      if (erroAdmin) throw new Error(erroBanco(erroAdmin.message));
      if (!admin) throw new Error('Sua conta não tem permissão administrativa. Autorize seu e-mail no SQL Editor conforme o guia.');
      const { data, error } = await supabase.rpc('saas_painel');
      if (error) throw new Error(erroBanco(error.message));
      if (usuario.current !== id || numero !== requisicao.current) return;
      setDados(data as Painel); setPermitido(true);
      setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    } catch (error) {
      if (usuario.current !== id || numero !== requisicao.current) return;
      setPermitido(false); setDados(vazio); setMensagem(error instanceof Error ? error.message : 'Não foi possível carregar o painel.');
    } finally {
      if (usuario.current === id && numero === requisicao.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    usuario.current = session?.user.id || null; requisicao.current += 1;
    setDados(vazio); setPermitido(false); setEditando(null); setPagando(null);
    if (session?.user.id) void carregar(session.user.id);
    else setCarregando(false);
    return () => { usuario.current = null; requisicao.current += 1; };
  }, [session?.user.id, carregar]);

  useEffect(() => {
    if (editando || pagando) document.getElementById(editando ? 'assinatura' : 'pagamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editando, pagando]);

  async function entrar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setMensagem('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) setMensagem('Não foi possível entrar. Confira seu e-mail e senha.');
    } catch { setMensagem('Falha de conexão. Tente novamente.'); }
    finally { setOcupado(false); }
  }
  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) setMensagem(error.message);
  }
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editando || !session) return;
    const f = new FormData(e.currentTarget); setOcupado(true); setMensagem('');
    try {
      const { error } = await supabase.rpc('saas_salvar_assinatura', {
        p_user_id: editando.user_id, p_nome: String(f.get('nome')).trim(), p_responsavel: String(f.get('responsavel')),
        p_telefone: String(f.get('telefone')), p_plano: String(f.get('plano')), p_valor: Number(f.get('valor')),
        p_status: String(f.get('status')), p_vencimento: f.get('vencimento') || null, p_observacoes: String(f.get('observacoes')),
      });
      if (error) throw new Error(erroBanco(error.message));
      setEditando(null); await carregar(session.user.id); setMensagem('Assinatura salva.');
    } catch (error) { setMensagem(error instanceof Error ? error.message : 'Falha ao salvar.'); }
    finally { setOcupado(false); }
  }
  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!pagando || !session) return;
    const f = new FormData(e.currentTarget); setOcupado(true); setMensagem('');
    try {
      const { error } = await supabase.rpc('saas_registrar_pagamento', {
        p_id: crypto.randomUUID(), p_user_id: pagando.user_id, p_competencia: `${f.get('competencia')}-01`,
        p_valor: Number(f.get('valor')), p_pago_em: String(f.get('pago_em')), p_forma: String(f.get('forma')),
        p_proximo_vencimento: String(f.get('proximo')), p_observacoes: String(f.get('observacoes')),
      });
      if (error) throw new Error(erroBanco(error.message));
      setPagando(null); await carregar(session.user.id); setMensagem('Pagamento registrado e vencimento atualizado.');
    } catch (error) { setMensagem(error instanceof Error ? error.message : 'Falha ao registrar.'); }
    finally { setOcupado(false); }
  }

  const m = metricasSaas(dados.academias, dados.pagamentos, hoje);
  const lista = dados.academias.filter(a => `${a.nome} ${a.email} ${a.responsavel}`.toLowerCase().includes(busca.toLowerCase())
    && (filtro === 'todas' || (filtro === 'atraso' ? situacaoSaas(a,hoje) === 'Em atraso' : a.status === filtro)));
  const nomes = new Map(dados.academias.map(a => [a.user_id, a.nome]));
  const historico = dados.pagamentos.filter(p => !pagando || p.user_id === pagando.user_id);
  const kpis = [
    { nome: 'Receita mensal contratada', valor: dinheiroSaas(m.recorrente), nota: 'Soma das assinaturas ativas', icon: Wallet },
    { nome: 'Recebido neste mês', valor: dinheiroSaas(m.recebido), nota: 'Pela data do pagamento registrado', icon: ArrowUpRight },
    { nome: 'Academias ativas', valor: String(m.ativas), nota: `${m.testes} em período de teste`, icon: Building2 },
    { nome: 'Assinaturas em atraso', valor: String(m.atrasadas), nota: 'Ativas com prazo vencido', icon: CircleAlert },
    { nome: 'Alunos cadastrados', valor: String(m.alunos), nota: `Em ${dados.academias.length} contas de academia`, icon: Users },
  ];

  if (inicializando) return <main className={styles.login}><p>Carregando acesso…</p></main>;
  if (!session) return <main className={styles.login}>
    <section className={styles.loginCard}><div className={styles.logo}><ShieldCheck size={24}/> ProGestFit <span>ADMIN</span></div>
      <h1>Seu centro de controle.</h1><p>Acompanhe academias e mensalidades em um único lugar.</p>
      <form onSubmit={entrar} className={styles.form}>
        <label>E-mail<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required/></label>
        <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required/></label>
        <button className={styles.primary} disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar no painel'}</button>
      </form>{mensagem && <p role="alert" className={styles.notice}>{mensagem}</p>}
      <p className={styles.small}>Use uma conta do sistema autorizada como administrador.</p><a href="/">Voltar ao sistema / recuperar senha</a>
    </section></main>;

  return <main className={styles.shell}>
    <header className={styles.header}><div className={styles.logo}><ShieldCheck size={24}/> ProGestFit <span>ADMIN</span></div>
      <div className={styles.actions}><span className={styles.small}>{session.user.email}</span><button onClick={sair}><LogOut size={16}/> Sair</button></div>
    </header>
    <div className={styles.content}>
      <div className={styles.title}><div><p className={styles.eyebrow}>GESTÃO DO SEU SISTEMA</p><h1>Visão do negócio</h1><p>Academias, assinaturas e recebimentos.</p></div>
        <button disabled={carregando || ocupado} onClick={() => carregar(session.user.id)}><RefreshCw size={16}/> {carregando ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
      {mensagem && <div role="status" className={styles.notice}>{mensagem}</div>}
      {!permitido ? <section className={styles.panel}><h2>{carregando ? 'Verificando acesso…' : 'Acesso administrativo'}</h2><p>O painel precisa do SQL de instalação e da autorização da sua conta. Consulte docs/painel-administrativo.md no repositório.</p><a href="/">Abrir o sistema</a></section> : <>
        <section className={styles.kpis}>{kpis.map(k => <article key={k.nome}><k.icon size={20}/><p>{k.nome}</p><strong>{k.valor}</strong><small>{k.nota}</small></article>)}</section>
        <section className={styles.panel}>
          <div className={styles.toolbar}><div className={styles.tabs}><button aria-pressed={aba==='academias'} onClick={() => setAba('academias')}>Academias <span>{dados.academias.length}</span></button><button aria-pressed={aba==='pagamentos'} onClick={() => setAba('pagamentos')}>Pagamentos <span>{dados.pagamentos.length}</span></button></div>
          <span className={styles.small}>Atualizado às {ultimaAtualizacao}</span></div>
          {aba === 'academias' ? <>
            <div className={styles.filters}><label className={styles.search}><Search size={18}/><input aria-label="Buscar academia" placeholder="Buscar academia, e-mail ou responsável" value={busca} onChange={e => setBusca(e.target.value)}/></label>
              <select aria-label="Filtrar situação" value={filtro} onChange={e=>setFiltro(e.target.value)}><option value="todas">Todas as situações</option><option value="ativa">Ativas</option><option value="teste">Em teste</option><option value="atraso">Em atraso</option><option value="pausada">Pausadas</option><option value="cancelada">Canceladas</option></select></div>
            <div className={styles.tableWrap}><table><thead><tr><th>Academia / conta</th><th>Alunos</th><th>Plano mensal</th><th>Vencimento</th><th>Situação</th><th>Último login</th><th>Ações</th></tr></thead><tbody>{lista.map(a => {
              const situacao = situacaoSaas(a,hoje);
              return <tr key={a.user_id}><td><strong>{a.nome}</strong><small>{a.email}</small></td><td>{a.alunos}<small>{a.alunos_ativos} ativos</small></td><td>{dinheiroSaas(a.valor)}<small>{a.plano}</small></td><td>{dataBR(a.vencimento)}</td><td><span className={styles.badge} data-status={situacao}>{situacao}</span></td><td>{dataBR(a.ultimo_login)}</td><td><div className={styles.rowActions}><button disabled={ocupado} onClick={() => {setEditando(a); setPagando(null); setMensagem('');}}>Editar assinatura</button><button disabled={ocupado} onClick={() => {setPagando(a); setEditando(null); setMensagem('');}}>Registrar pagamento</button></div></td></tr>;
            })}</tbody></table></div>
            {!lista.length && <p className={styles.empty}>Nenhuma academia encontrada. As contas criadas no sistema aparecerão aqui automaticamente.</p>}
          </> : <><div className={styles.tableWrap}><table><thead><tr><th>Academia</th><th>Competência</th><th>Valor recebido</th><th>Data do pagamento</th><th>Forma</th></tr></thead><tbody>{dados.pagamentos.map(p => <tr key={p.id}><td>{nomes.get(p.user_id) || 'Academia'}</td><td>{dataBR(p.competencia).slice(3)}</td><td>{dinheiroSaas(p.valor)}</td><td>{dataBR(p.pago_em)}</td><td>{p.forma}</td></tr>)}</tbody></table></div>{!dados.pagamentos.length && <p className={styles.empty}>Registre o primeiro pagamento na ficha de uma academia.</p>}</>}
        </section>
        {editando && <section className={styles.panel} id="assinatura"><div className={styles.title}><div><h2>Assinatura · {editando.nome}</h2><p>{editando.email}</p></div><button disabled={ocupado} onClick={()=>setEditando(null)}>Fechar</button></div>
          <form key={editando.user_id} onSubmit={salvar} className={styles.formGrid}>
            <label>Nome da academia<input name="nome" defaultValue={editando.nome} maxLength={160} required/></label>
            <label>Responsável<input name="responsavel" defaultValue={editando.responsavel} maxLength={160}/></label>
            <label>WhatsApp com DDD<input name="telefone" defaultValue={editando.telefone} maxLength={30}/></label>
            <label>Plano (cobrança mensal)<input name="plano" defaultValue={editando.plano} maxLength={80} required/></label>
            <label>Valor mensal (R$)<input type="number" name="valor" min="0" max="9999999999.99" step="0.01" defaultValue={editando.valor} required/></label>
            <label>Próximo vencimento<input type="date" name="vencimento" defaultValue={editando.vencimento || ''}/></label>
            <label>Status comercial<select name="status" defaultValue={editando.status}><option value="teste">Em teste</option><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="cancelada">Cancelada</option></select></label>
            <label className={styles.wide}>Observações<textarea name="observacoes" defaultValue={editando.observacoes} rows={3} maxLength={3000}/></label>
            <p className={`${styles.small} ${styles.wide}`}>O status organiza sua carteira comercial. Pausar ou cancelar aqui não bloqueia o acesso da academia ao sistema.</p>
            <button className={styles.primary} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar assinatura'}</button>
          </form>
        </section>}
        {pagando && <section className={styles.panel} id="pagamento"><div className={styles.title}><div><h2>Pagamento · {pagando.nome}</h2><p>Confirme apenas valores que você já recebeu. O registro ativa a assinatura e avança o vencimento.</p></div><button disabled={ocupado} onClick={()=>setPagando(null)}>Fechar</button></div>
          <form key={pagando.user_id} onSubmit={registrar} className={styles.formGrid}>
            <label>Competência<input type="month" name="competencia" defaultValue={hoje.slice(0,7)} required/></label>
            <label>Valor recebido (R$)<input type="number" name="valor" min="0.01" step="0.01" defaultValue={pagando.valor || ''} required/></label>
            <label>Data do pagamento<input type="date" name="pago_em" max={hoje} defaultValue={hoje} required/></label>
            <label>Forma<select name="forma"><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></select></label>
            <label>Novo vencimento<input type="date" name="proximo" defaultValue={proximoMesSaas(pagando.vencimento && pagando.vencimento > hoje ? pagando.vencimento : hoje)} required/></label>
            <label>Observações<input name="observacoes" maxLength={3000}/></label>
            <button className={styles.primary} disabled={ocupado}>{ocupado ? 'Registrando…' : 'Confirmar pagamento'}</button>
          </form><p className={styles.small}>Salve a assinatura antes do primeiro pagamento. É permitido um pagamento por academia e competência.</p>
          <h3>Histórico desta academia</h3><div className={styles.history}>{historico.length ? historico.map(p => <div key={p.id}><strong>{dinheiroSaas(p.valor)}</strong><span>{dataBR(p.pago_em)} · {p.forma} · competência {dataBR(p.competencia).slice(3)}</span>{p.observacoes && <small>{p.observacoes}</small>}</div>) : <p>Nenhum pagamento registrado.</p>}</div>
        </section>}
        <footer className={styles.small}>Contas administrativas não entram na lista de academias. “Último login” indica autenticação, não atividade em tempo real. Receita contratada não representa dinheiro recebido.</footer>
      </>}
    </div>
  </main>;
}
