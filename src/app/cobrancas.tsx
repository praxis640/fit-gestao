'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatarDataBrasil, digitosTelefone, telefoneValido } from '@/lib/alunos';

type Aluno = { id: string | number; nome: string; telefone?: string | null; valor_mensalidade?: number | null; proximo_vencimento?: string | null };
type Cobranca = { id: string; aluno_id: string; valor: number; vencimento: string; status: string; url_fatura?: string | null; codigo_pix?: string | null; criado_em: string };

const dinheiro = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabel: Record<string, string> = { processando: 'Gerando', pendente: 'Pendente', recebido: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado', estornado: 'Estornado', falha: 'Falhou' };

export function Cobrancas({ userId, alunos }: { userId: string; alunos: Aluno[] }) {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('gestao_cobrancas').select('*').eq('user_id', userId).order('vencimento', { ascending: false }).limit(200);
    if (error) setMensagem(`Não foi possível carregar cobranças. Execute a migração 20261008_cobrancas_asaas.sql no Supabase. (${error.message})`);
    else setCobrancas((data || []) as Cobranca[]);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function gerarCobranca() {
    if (!selecionado) { setMensagem('Selecione um aluno.'); return; }
    setCarregando(true); setMensagem('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/cobrancas/asaas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ alunoId: selecionado }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível gerar a cobrança.');
      await carregar();
      setMensagem('Cobrança Pix criada. A confirmação de pagamento chega automaticamente pelo webhook.');
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao criar cobrança.');
    } finally { setCarregando(false); }
  }

  function abrirWhatsApp(cobranca: Cobranca) {
    const aluno = alunos.find((item) => String(item.id) === String(cobranca.aluno_id));
    if (!aluno?.telefone || !telefoneValido(aluno.telefone)) { setMensagem('Cadastre um telefone válido com DDD no perfil do aluno.'); return; }
    const phone = digitosTelefone(aluno.telefone);
    const text = `Olá, ${aluno.nome}! Sua mensalidade de ${dinheiro(cobranca.valor)} vence em ${formatarDataBrasil(cobranca.vencimento)}. Você pode pagar pelo link seguro: ${cobranca.url_fatura || ''}`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function copiarPix(codigo: string) {
    try { await navigator.clipboard.writeText(codigo); setMensagem('Código Pix copiado.'); }
    catch { setMensagem('Não foi possível copiar automaticamente. Abra a fatura para copiar o Pix.'); }
  }

  const alunosAtivos = alunos.filter((aluno) => Number(aluno.valor_mensalidade || 0) > 0);
  return <main style={{ display: 'grid', gap: '1rem' }}>
    <section style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div><h2 style={{ margin: 0 }}>Cobranças e mensagens</h2><p style={{ color: '#aeb5c6', marginBottom: 0 }}>Gere cobranças Pix do Asaas e envie o link ao aluno pelo WhatsApp.</p></div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <select aria-label="Selecionar aluno" value={selecionado} onChange={(event) => setSelecionado(event.target.value)} style={{ padding: '.7rem', borderRadius: 6, background: '#13151f', border: '1px solid #34394e', color: '#fff', minWidth: 190 }}>
            <option value="">Selecione um aluno</option>{alunosAtivos.map((aluno) => <option key={aluno.id} value={aluno.id}>{aluno.nome} · {dinheiro(Number(aluno.valor_mensalidade))}</option>)}
          </select>
          <button type="button" onClick={gerarCobranca} disabled={carregando || !selecionado} style={{ padding: '.7rem 1rem', border: 0, borderRadius: 6, background: '#635bfc', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{carregando ? 'Gerando…' : '＋ Gerar cobrança Pix'}</button>
        </div>
      </div>
      {mensagem && <p role="status" style={{ marginBottom: 0, color: mensagem.includes('criada') ? '#86efac' : '#fbbf24' }}>{mensagem}</p>}
    </section>
    <section style={{ overflowX: 'auto', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Histórico de cobranças</h3>
      {!cobrancas.length ? <p style={{ color: '#aeb5c6' }}>Ainda não há cobranças geradas.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, textAlign: 'left' }}><thead><tr style={{ color: '#aeb5c6' }}><th style={{ padding: '.65rem' }}>Aluno</th><th style={{ padding: '.65rem' }}>Valor</th><th style={{ padding: '.65rem' }}>Vencimento</th><th style={{ padding: '.65rem' }}>Status</th><th style={{ padding: '.65rem' }}>Ações</th></tr></thead><tbody>{cobrancas.map((charge) => {
        const aluno = alunos.find((item) => String(item.id) === String(charge.aluno_id));
        return <tr key={charge.id} style={{ borderTop: '1px solid #2a2f42' }}><td style={{ padding: '.65rem' }}>{aluno?.nome || 'Aluno removido'}</td><td style={{ padding: '.65rem' }}>{dinheiro(charge.valor)}</td><td style={{ padding: '.65rem' }}>{formatarDataBrasil(charge.vencimento)}</td><td style={{ padding: '.65rem' }}>{statusLabel[charge.status] || charge.status}</td><td style={{ padding: '.65rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>{charge.url_fatura && <a href={charge.url_fatura} target="_blank" rel="noreferrer" style={{ color: '#c4b5fd' }}>Abrir fatura Pix</a>}{charge.codigo_pix && <button type="button" onClick={() => void copiarPix(charge.codigo_pix!)} style={{ border: '1px solid #34394e', borderRadius: 5, padding: '.35rem .55rem', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Copiar código Pix</button>}{charge.status === 'pendente' && charge.url_fatura && <button type="button" onClick={() => abrirWhatsApp(charge)} style={{ border: 0, borderRadius: 5, padding: '.35rem .55rem', background: '#166534', color: '#fff', cursor: 'pointer' }}>Preparar WhatsApp</button>}</td></tr>;
      })}</tbody></table>}
    </section>
    <p style={{ color: '#8a8f9d', fontSize: '.85rem', margin: 0 }}>O WhatsApp abre uma mensagem pronta para revisão e envio manual. O envio automático pela API oficial exige conta WhatsApp Business, token e modelos de mensagem aprovados.</p>
  </main>;
}
