'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatarDataBrasil, digitosTelefone, telefoneValido } from '@/lib/alunos';

type Aluno = { id?: string | number; nome: string; telefone?: string | null; valor_mensalidade?: number | null; proximo_vencimento?: string | null };
type Cobranca = { id: string; aluno_id: string; valor: number; vencimento: string; status: string; url_fatura?: string | null; codigo_pix?: string | null; criado_em: string };
type ModeloMensagem = 'cobranca' | 'lembrete' | 'atraso' | 'pagamento';
type MensagensEditaveis = Record<ModeloMensagem, string>;

const mensagensPadrao: MensagensEditaveis = {
  cobranca: 'Olá, {{NOME}}! Sua cobrança de {{VALOR}} vence em {{VENCIMENTO}}.\n\nPague com segurança: {{LINK_PAGAMENTO}}\n\nDepois de pagar, avise a academia por aqui: {{LINK_AVISAR}}',
  lembrete: 'Olá, {{NOME}}! Passando para lembrar da mensalidade de {{VALOR}}, com vencimento em {{VENCIMENTO}}.\n\nLink para pagamento: {{LINK_PAGAMENTO}}\n\nSe já pagou, avise a academia: {{LINK_AVISAR}}',
  atraso: 'Olá, {{NOME}}! Consta uma cobrança de {{VALOR}}, vencida em {{VENCIMENTO}}, ainda em aberto. Se já pagou, avise a academia e envie o comprovante: {{LINK_AVISAR}}\n\nLink para pagamento: {{LINK_PAGAMENTO}}',
  pagamento: 'Olá, {{NOME}}! Confirmamos o recebimento de {{VALOR}}. Obrigado pelo pagamento!'
};

const dinheiro = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabel: Record<string, string> = { processando: 'Gerando', pendente: 'Pendente', recebido: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado', estornado: 'Estornado', falha: 'Falhou' };

export function Cobrancas({ userId, alunos }: { userId: string; alunos: Aluno[] }) {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [modeloMensagem, setModeloMensagem] = useState<ModeloMensagem>('cobranca');
  const [mensagensEditaveis, setMensagensEditaveis] = useState<MensagensEditaveis>(mensagensPadrao);
  const [modelosCarregados, setModelosCarregados] = useState(false);
  const [telefoneAcademia, setTelefoneAcademia] = useState('');
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

  useEffect(() => {
    let ativo = true;
    supabase.from('gestao_configuracoes').select('telefone').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (ativo) setTelefoneAcademia(data?.telefone || ''); });
    return () => { ativo = false; };
  }, [userId]);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(`fitgestao:cobrancas:mensagens:${userId}`);
      if (salvo) {
        const parsed = JSON.parse(salvo) as Partial<MensagensEditaveis>;
        setMensagensEditaveis({ ...mensagensPadrao, ...parsed });
      }
    } catch {
      setMensagem('Não foi possível carregar os modelos salvos neste navegador.');
    } finally {
      setModelosCarregados(true);
    }
  }, [userId]);

  async function gerarCobranca(alunoId = selecionado) {
    if (!alunoId) { setMensagem('Selecione um aluno ou use a lista de vencimentos próximos.'); return; }
    setCarregando(true); setMensagem('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/cobrancas/asaas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ alunoId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível gerar a cobrança.');
      await carregar();
      setMensagem('Cobrança Pix criada. A confirmação de pagamento chega automaticamente pelo webhook.');
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao criar cobrança.');
    } finally { setCarregando(false); }
  }

  function abrirWhatsApp(cobranca: Cobranca, modelo = modeloMensagem) {
    const aluno = alunos.find((item) => String(item.id) === String(cobranca.aluno_id));
    if (!aluno?.telefone || !telefoneValido(aluno.telefone)) { setMensagem('Cadastre um telefone válido com DDD no perfil do aluno.'); return; }
    const phone = digitosTelefone(aluno.telefone);
    const cobrancaLabel = `${dinheiro(cobranca.valor)} com vencimento em ${formatarDataBrasil(cobranca.vencimento)}`;
    const telefoneAcademiaLimpo = digitosTelefone(telefoneAcademia);
    const linkAviso = telefoneValido(telefoneAcademia)
      ? `https://wa.me/55${telefoneAcademiaLimpo}?text=${encodeURIComponent(`Olá! Sou ${aluno.nome} e já realizei o pagamento de ${dinheiro(cobranca.valor)}, com vencimento em ${formatarDataBrasil(cobranca.vencimento)}. Segue o comprovante.`)}`
      : '';
    const valores: Record<string, string> = {
      NOME: aluno.nome,
      VALOR: dinheiro(cobranca.valor),
      VENCIMENTO: formatarDataBrasil(cobranca.vencimento),
      LINK_PAGAMENTO: cobranca.url_fatura || 'Link de pagamento não disponível; entre em contato com a academia.',
      LINK_AVISAR: linkAviso || 'responda a esta conversa e envie o comprovante'
    };
    const text = mensagensEditaveis[modelo].replace(/\{\{(NOME|VALOR|VENCIMENTO|LINK_PAGAMENTO|LINK_AVISAR)\}\}/g, (_match, chave: string) => valores[chave] || '').replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n').trim();
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function salvarModelos() {
    try {
      window.localStorage.setItem(`fitgestao:cobrancas:mensagens:${userId}`, JSON.stringify(mensagensEditaveis));
      setMensagem('Modelos de mensagem salvos neste navegador.');
    } catch {
      setMensagem('Não foi possível salvar os modelos neste navegador.');
    }
  }

  async function copiarPix(codigo: string) {
    try { await navigator.clipboard.writeText(codigo); setMensagem('Código Pix copiado.'); }
    catch { setMensagem('Não foi possível copiar automaticamente. Abra a fatura para copiar o Pix.'); }
  }

  const alunosAtivos = alunos.filter((aluno): aluno is Aluno & { id: string | number } =>
    aluno.id != null && Number(aluno.valor_mensalidade || 0) > 0
  );
  const hojeData = new Date();
  const hojeIso = `${hojeData.getFullYear()}-${String(hojeData.getMonth() + 1).padStart(2, '0')}-${String(hojeData.getDate()).padStart(2, '0')}`;
  const vencimentosProximos = alunosAtivos.map((aluno) => {
    const vencimento = aluno.proximo_vencimento?.slice(0, 10);
    if (!vencimento) return null;
    const dias = Math.round((new Date(`${vencimento}T12:00:00`).getTime() - new Date(`${hojeIso}T12:00:00`).getTime()) / 86400000);
    return dias >= 0 && dias <= 7 ? { aluno, vencimento, dias } : null;
  }).filter((item): item is { aluno: Aluno & { id: string | number }; vencimento: string; dias: number } => item !== null)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return <main style={{ display: 'grid', gap: '1rem' }}>
    <section style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div><h2 style={{ margin: 0 }}>Cobranças e mensagens</h2><p style={{ color: '#aeb5c6', marginBottom: 0 }}>Gere cobranças Pix e prepare mensagens para enviar pelo WhatsApp.</p></div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <select aria-label="Selecionar aluno" value={selecionado} onChange={(event) => setSelecionado(event.target.value)} style={{ padding: '.7rem', borderRadius: 6, background: '#13151f', border: '1px solid #34394e', color: '#fff', minWidth: 190 }}>
            <option value="">Selecione um aluno</option>{alunosAtivos.map((aluno) => <option key={aluno.id} value={aluno.id}>{aluno.nome} · {dinheiro(Number(aluno.valor_mensalidade))}</option>)}
          </select>
          <button type="button" onClick={() => void gerarCobranca()} disabled={carregando || !selecionado} style={{ padding: '.7rem 1rem', border: 0, borderRadius: 6, background: '#635bfc', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{carregando ? 'Gerando…' : '＋ Gerar cobrança Pix'}</button>
        </div>
      </div>
      {mensagem && <p role="status" style={{ marginBottom: 0, color: mensagem.includes('criada') || mensagem.includes('Modelos de mensagem salvos') ? '#86efac' : '#fbbf24' }}>{mensagem}</p>}
    </section>
    <section style={{ display: 'grid', gap: '.55rem', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1rem' }}>
      <strong>Como o aluno avisa que pagou</strong>
      <p style={{ color: '#c6cbda', margin: 0, lineHeight: 1.55 }}>Ao preparar a cobrança, a mensagem inclui a orientação para o aluno responder no WhatsApp com o comprovante. Se o telefone da academia estiver preenchido em <b>Configurações → Telefone de contato</b>, também incluiremos um link para o aluno tocar e abrir essa conversa já com o aviso escrito.</p>
      <p style={{ color: '#aeb5c6', margin: 0, fontSize: '.88rem' }}>O aviso do aluno não confirma o pagamento sozinho. A cobrança muda para “Pago” quando o Asaas confirmar pelo webhook; se recebeu por outro meio, confira o comprovante e registre a baixa manualmente no financeiro.</p>
    </section>
    <section style={{ display: 'grid', gap: '.75rem', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1rem' }}>
      <div><h3 style={{ margin: '0 0 .35rem' }}>Alunos com vencimento nos próximos 7 dias</h3><p style={{ color: '#aeb5c6', margin: 0, fontSize: '.9rem' }}>A lista usa a data de próximo vencimento cadastrada no perfil do aluno.</p></div>
      {vencimentosProximos.length === 0 ? <p style={{ color: '#aeb5c6', margin: 0 }}>Nenhum aluno com vencimento nos próximos 7 dias.</p> : <div style={{ display: 'grid', gap: '.55rem' }}>{vencimentosProximos.map(({ aluno, vencimento, dias }) => <div key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap', padding: '.7rem', borderRadius: 8, background: '#171a25' }}>
        <div><strong>{aluno.nome}</strong><div style={{ color: '#aeb5c6', fontSize: '.88rem' }}>{dinheiro(Number(aluno.valor_mensalidade))} · vence em {formatarDataBrasil(vencimento)}{dias === 0 ? ' · vence hoje' : ` · ${dias} dia${dias === 1 ? '' : 's'}`}</div></div>
        <button type="button" disabled={carregando} onClick={() => void gerarCobranca(String(aluno.id))} style={{ padding: '.55rem .75rem', border: 0, borderRadius: 6, background: '#635bfc', color: '#fff', fontWeight: 700, cursor: carregando ? 'wait' : 'pointer' }}>{carregando ? 'Gerando…' : 'Gerar cobrança Pix'}</button>
      </div>)}</div>}
    </section>
    <section style={{ display: 'grid', gap: '.75rem', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1rem' }}>
      <div><h3 style={{ margin: '0 0 .35rem' }}>Editar mensagens prontas</h3><p style={{ color: '#aeb5c6', margin: 0, fontSize: '.9rem' }}>Personalize o texto usado ao preparar o WhatsApp. Use os campos entre chaves para inserir os dados da cobrança.</p></div>
      <label style={{ display: 'grid', gap: '.4rem', color: '#c6cbda' }}>Mensagem para editar
        <select aria-label="Escolher mensagem para editar" value={modeloMensagem} onChange={(event) => setModeloMensagem(event.target.value as ModeloMensagem)} style={{ padding: '.6rem', borderRadius: 6, background: '#13151f', border: '1px solid #34394e', color: '#fff', width: 'fit-content', maxWidth: '100%' }}>
          <option value="cobranca">Enviar cobrança</option><option value="lembrete">Lembrete de vencimento</option><option value="atraso">Cobrança em aberto</option><option value="pagamento">Agradecer pagamento</option>
        </select>
      </label>
      <textarea aria-label="Texto do modelo de mensagem" rows={6} value={mensagensEditaveis[modeloMensagem]} onChange={(event) => setMensagensEditaveis((anterior) => ({ ...anterior, [modeloMensagem]: event.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '.75rem', borderRadius: 6, background: '#13151f', border: '1px solid #34394e', color: '#fff', resize: 'vertical', font: 'inherit', lineHeight: 1.5 }} />
      <small style={{ color: '#aeb5c6' }}>Campos disponíveis: {'{{NOME}}'}, {'{{VALOR}}'}, {'{{VENCIMENTO}}'}, {'{{LINK_PAGAMENTO}}'} e {'{{LINK_AVISAR}}'}.</small>
      <button type="button" disabled={!modelosCarregados} onClick={salvarModelos} style={{ justifySelf: 'start', padding: '.6rem .85rem', border: 0, borderRadius: 6, background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Salvar mensagens</button>
      <small style={{ color: '#8a8f9d' }}>Os modelos ficam salvos neste navegador e nesta conta. Para usá-los em outro aparelho, será necessário editá-los lá também.</small>
    </section>
    <section style={{ overflowX: 'auto', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ marginTop: 0 }}>Histórico de cobranças</h3>
        <span style={{ color: '#aeb5c6', fontSize: '.9rem' }}>Modelo atual: {modeloMensagem === 'cobranca' ? 'Enviar cobrança' : modeloMensagem === 'lembrete' ? 'Lembrete de vencimento' : modeloMensagem === 'atraso' ? 'Cobrança em aberto' : 'Agradecer pagamento'}</span>
      </div>
      {!cobrancas.length ? <p style={{ color: '#aeb5c6' }}>Ainda não há cobranças geradas.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, textAlign: 'left' }}><thead><tr style={{ color: '#aeb5c6' }}><th style={{ padding: '.65rem' }}>Aluno</th><th style={{ padding: '.65rem' }}>Valor</th><th style={{ padding: '.65rem' }}>Vencimento</th><th style={{ padding: '.65rem' }}>Status</th><th style={{ padding: '.65rem' }}>Ações</th></tr></thead><tbody>{cobrancas.map((charge) => {
        const aluno = alunos.find((item) => String(item.id) === String(charge.aluno_id));
        const podePrepararMensagem = charge.status === 'pendente' && modeloMensagem !== 'pagamento' || charge.status === 'recebido' && modeloMensagem === 'pagamento';
        return <tr key={charge.id} style={{ borderTop: '1px solid #2a2f42' }}><td style={{ padding: '.65rem' }}>{aluno?.nome || 'Aluno removido'}</td><td style={{ padding: '.65rem' }}>{dinheiro(charge.valor)}</td><td style={{ padding: '.65rem' }}>{formatarDataBrasil(charge.vencimento)}</td><td style={{ padding: '.65rem' }}>{statusLabel[charge.status] || charge.status}</td><td style={{ padding: '.65rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>{charge.url_fatura && <a href={charge.url_fatura} target="_blank" rel="noreferrer" style={{ color: '#c4b5fd' }}>Abrir fatura Pix</a>}{charge.codigo_pix && <button type="button" onClick={() => void copiarPix(charge.codigo_pix!)} style={{ border: '1px solid #34394e', borderRadius: 5, padding: '.35rem .55rem', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Copiar código Pix</button>}{podePrepararMensagem && <button type="button" onClick={() => abrirWhatsApp(charge)} style={{ border: 0, borderRadius: 5, padding: '.35rem .55rem', background: '#166534', color: '#fff', cursor: 'pointer' }}>Preparar WhatsApp</button>}</td></tr>;
      })}</tbody></table>}
    </section>
    <p style={{ color: '#8a8f9d', fontSize: '.85rem', margin: 0 }}>As mensagens ficam prontas para você revisar e enviar. Para avisar que pagou, o aluno toca no link incluído ou responde à conversa e anexa o comprovante. A confirmação automática continua sendo feita pelo retorno do Asaas.</p>
  </main>;
}
