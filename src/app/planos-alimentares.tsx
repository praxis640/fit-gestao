'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { criarAlimento, criarRefeicao, lerPlano, novoPlano, validarPlano, type PlanoAlimentar } from '@/lib/plano-alimentar';
import { gerarPdfPlano } from '@/lib/plano-pdf';
import { supabase } from '@/lib/supabase';

type AlunoResumo = { id: string; nome: string; status: string; telefone?: string };

type Registro = {
  id: string; titulo: string; categoria: string; detalhes: string;
  aluno_id: string | null; criado_em: string; plano_alimentar: unknown;
};
const caixa: React.CSSProperties = { background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '1.5rem' };
const campo: React.CSSProperties = { background: '#13151f', color: '#fff', border: '1px solid #3a3f55', borderRadius: 6, padding: '0.7rem', width: '100%' };
const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#c2c9d8' };
const botao: React.CSSProperties = { border: 0, color: '#fff', borderRadius: 6, padding: '0.65rem 0.9rem', cursor: 'pointer', background: '#635bfc' };
const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 };
const tamanho = 20;

export function PlanosAlimentares({ userId, alunos, academia }: { userId: string; alunos: AlunoResumo[]; academia: string }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [filtroAluno, setFiltroAluno] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [plano, setPlano] = useState<PlanoAlimentar>(() => novoPlano(dataEmSaoPaulo(new Date())));
  const [editando, setEditando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const formularioRef = useRef<HTMLDivElement>(null);
  const consultaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const indiceConsulta = ++consultaAtual.current;
    setCarregando(true);
    let consulta = supabase.from('gestao_registros')
      .select('id,titulo,categoria,detalhes,aluno_id,criado_em,plano_alimentar', { count: 'exact' })
      .eq('user_id', userId).eq('tipo', 'nutricao');
    if (filtroAluno) consulta = consulta.eq('aluno_id', filtroAluno);
    const { data, count, error } = await consulta.order('criado_em', { ascending: false })
      .range(pagina * tamanho, (pagina + 1) * tamanho - 1);
    if (indiceConsulta !== consultaAtual.current) return;
    if (error) setErro(`Não foi possível carregar os planos: ${error.message}. Confira se executou o SQL dos planos alimentares.`);
    else { setRegistros((data || []) as Registro[]); setTotal(count || 0); setErro(''); }
    setCarregando(false);
  }, [userId, filtroAluno, pagina]);

  useEffect(() => {
    // A resposta assíncrona preenche os registros da página atual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function definir<K extends keyof PlanoAlimentar>(chave: K, valor: PlanoAlimentar[K]) {
    setPlano((anterior) => ({ ...anterior, [chave]: valor }));
  }

  function alterarRefeicao(indice: number, mudanca: Partial<PlanoAlimentar['refeicoes'][number]>) {
    setPlano((anterior) => ({ ...anterior, refeicoes: anterior.refeicoes.map((item, posicao) => posicao === indice ? { ...item, ...mudanca } : item) }));
  }

  function alterarAlimento(refeicao: number, alimento: number, mudanca: Partial<PlanoAlimentar['refeicoes'][number]['alimentos'][number]>) {
    setPlano((anterior) => ({ ...anterior, refeicoes: anterior.refeicoes.map((item, indice) => indice !== refeicao ? item : {
      ...item, alimentos: item.alimentos.map((comida, posicao) => posicao === alimento ? { ...comida, ...mudanca } : comida)
    }) }));
  }

  function limpar() {
    setEditando(null); setTitulo(''); setAlunoId('');
    setPlano(novoPlano(dataEmSaoPaulo(new Date())));
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!alunoId || !titulo.trim()) { setErro('Informe o nome do plano e selecione um aluno.'); return; }
    const validacao = validarPlano(plano);
    if (validacao) { setErro(validacao); return; }
    const registro = {
      user_id: userId, tipo: 'nutricao', titulo: titulo.trim(), categoria: plano.objetivo.trim(),
      detalhes: plano.orientacoes.trim(), aluno_id: alunoId, plano_alimentar: plano
    };
    setSalvando(true);
    const resposta = editando
      ? await supabase.from('gestao_registros').update(registro).eq('id', editando).eq('user_id', userId).eq('tipo', 'nutricao').select('id')
      : await supabase.from('gestao_registros').insert(registro).select('id');
    setSalvando(false);
    if (resposta.error || !resposta.data?.length) {
      setErro(`Não foi possível salvar: ${resposta.error?.message || 'Registro não encontrado nesta conta.'}. Confira a migração SQL dos planos alimentares.`);
      return;
    }
    setMensagem('Plano alimentar salvo para o aluno.'); setErro(''); limpar();
    if (pagina !== 0) setPagina(0);
    else await carregar();
  }

  function editar(registro: Registro) {
    const existente = lerPlano(registro.plano_alimentar);
    setEditando(registro.id); setTitulo(registro.titulo); setAlunoId(registro.aluno_id || '');
    const vazio = novoPlano(dataEmSaoPaulo(new Date()));
    setPlano(existente ? { ...vazio, ...existente, avaliacao: { ...vazio.avaliacao, ...existente.avaliacao }, metas: { ...vazio.metas, ...existente.metas } }
      : { ...vazio, objetivo: registro.categoria || '', orientacoes: registro.detalhes || '' });
    setErro(''); setMensagem('');
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function excluir(registro: Registro) {
    if (!confirm(`Excluir “${registro.titulo}”?`)) return;
    const { data, error } = await supabase.from('gestao_registros').delete()
      .eq('id', registro.id).eq('user_id', userId).eq('tipo', 'nutricao').select('id');
    if (error || !data?.length) { setErro(error?.message || 'Plano não encontrado nesta conta.'); return; }
    if (editando === registro.id) limpar();
    if (pagina > 0 && registros.length === 1) setPagina(pagina - 1);
    else await carregar();
  }

  function arquivoPdf(registro: Registro) {
    const existente = lerPlano(registro.plano_alimentar);
    const aluno = alunos.find((item) => item.id === registro.aluno_id);
    if (!existente || !aluno) { setErro('Edite este registro para montar uma dieta estruturada vinculada a um aluno.'); return null; }
    try {
      const bytes = gerarPdfPlano(existente, aluno.nome, academia);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const nome = `plano-alimentar-${aluno.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase()}.pdf`;
      return { blob, nome, aluno };
    } catch { setErro('Não foi possível gerar o PDF neste navegador. Tente novamente em um navegador atualizado.'); return null; }
  }

  function baixar(blob: Blob, nome: string) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url; link.download = nome;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function baixarPdf(registro: Registro) {
    const arquivo = arquivoPdf(registro);
    if (arquivo) { baixar(arquivo.blob, arquivo.nome); setErro(''); setMensagem('PDF baixado.'); }
  }

  async function compartilhar(registro: Registro) {
    const arquivo = arquivoPdf(registro);
    if (!arquivo) return;
    setErro('');
    const arquivoNativo = new File([arquivo.blob], arquivo.nome, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [arquivoNativo] })) {
      try {
        await navigator.share({ files: [arquivoNativo], title: registro.titulo });
        setMensagem('Escolha o aplicativo e confirme o envio do PDF.');
      } catch (erroCompartilhar) {
        if ((erroCompartilhar as Error).name !== 'AbortError') setErro('Compartilhamento indisponível. Use “Baixar PDF” para anexar o arquivo manualmente.');
      }
      return;
    }
    baixar(arquivo.blob, arquivo.nome);
    const telefone = (arquivo.aluno.telefone || '').replace(/\D/g, '');
    if (telefone.length === 10 || telefone.length === 11) {
      window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(`Olá, ${arquivo.aluno.nome}! Segue seu plano alimentar em PDF.`)}`, '_blank', 'noopener,noreferrer');
      setMensagem('PDF baixado. Anexe o arquivo à conversa aberta no WhatsApp e confirme o envio.');
    } else setMensagem('PDF baixado. Envie o arquivo pelo aplicativo que preferir; o aluno está sem telefone com DDD.');
  }

  const linha = (tituloCampo: string, valor: string, aoMudar: (valor: string) => void, opcoes?: { tipo?: string; unidade?: string; maximo?: number }) =>
    <label style={rotulo}>{tituloCampo}{opcoes?.unidade ? ` (${opcoes.unidade})` : ''}
      <input style={campo} type={opcoes?.tipo || 'text'} maxLength={opcoes?.maximo || 240} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </label>;

  return <div style={{ display: 'grid', gap: '1.5rem' }}>
    <section ref={formularioRef} style={caixa}>
      <h2 style={{ marginTop: 0 }}>Modelos alimentares didáticos</h2>
      <p style={{ color: '#b5bdcb' }}>Organize exemplos de refeições para fins educativos. Os valores são preenchidos manualmente; o aplicativo não cria orientações individualizadas.</p>
      {erro && <p role="alert" style={{ color: '#fecaca' }}>{erro}</p>}
      {mensagem && <p role="status" style={{ color: '#86efac' }}>{mensagem}</p>}
      <form onSubmit={(evento) => void salvar(evento)} style={{ display: 'grid', gap: '1.4rem' }}>
        <div style={grade}>
          {linha('Nome do plano *', titulo, setTitulo, { maximo: 120 })}
          <label style={rotulo}>Aluno *<select style={campo} value={alunoId} required onChange={(e) => setAlunoId(e.target.value)}>
            <option value="">Selecione um aluno</option>
            {alunos.filter((item) => item.status === 'Ativo' || item.id === alunoId).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select></label>
          {linha('Tema ou objetivo didático', plano.objetivo, (v) => definir('objetivo', v))}
          {linha('Data de emissão', plano.dataEmissao, (v) => definir('dataEmissao', v), { tipo: 'date' })}
          {linha('Válido até', plano.validade, (v) => definir('validade', v), { tipo: 'date' })}
        </div>

        <fieldset style={{ border: '1px solid #3a3f55', borderRadius: 8, padding: '1rem' }}>
          <legend>Avaliação interna · dados não incluídos no PDF do aluno</legend>
          <div style={grade}>
            {linha('Peso', plano.avaliacao.peso, (v) => definir('avaliacao', { ...plano.avaliacao, peso: v }), { unidade: 'kg' })}
            {linha('Altura', plano.avaliacao.altura, (v) => definir('avaliacao', { ...plano.avaliacao, altura: v }), { unidade: 'cm' })}
            {linha('Circunferência da cintura', plano.avaliacao.cintura, (v) => definir('avaliacao', { ...plano.avaliacao, cintura: v }), { unidade: 'cm' })}
            {linha('Composição corporal / evolução', plano.avaliacao.composicao, (v) => definir('avaliacao', { ...plano.avaliacao, composicao: v }))}
            {linha('Atividade física', plano.avaliacao.atividade, (v) => definir('avaliacao', { ...plano.avaliacao, atividade: v }))}
            {linha('Histórico/condições relevantes', plano.avaliacao.historico, (v) => definir('avaliacao', { ...plano.avaliacao, historico: v }))}
            {linha('Alergias alimentares', plano.avaliacao.alergias, (v) => definir('avaliacao', { ...plano.avaliacao, alergias: v }))}
            {linha('Restrições e preferências', plano.avaliacao.restricoes, (v) => definir('avaliacao', { ...plano.avaliacao, restricoes: v }))}
            {linha('Preferências e aversões', plano.avaliacao.preferencias, (v) => definir('avaliacao', { ...plano.avaliacao, preferencias: v }))}
            {linha('Medicamentos informados', plano.avaliacao.medicamentos, (v) => definir('avaliacao', { ...plano.avaliacao, medicamentos: v }))}
            {linha('Exames e dados relevantes', plano.avaliacao.exames, (v) => definir('avaliacao', { ...plano.avaliacao, exames: v }))}
            {linha('Recordatório alimentar habitual', plano.avaliacao.recordatorio, (v) => definir('avaliacao', { ...plano.avaliacao, recordatorio: v }))}
            {linha('Rotina e horários de trabalho', plano.avaliacao.rotina, (v) => definir('avaliacao', { ...plano.avaliacao, rotina: v }))}
            {linha('Sintomas digestivos / sono', plano.avaliacao.sintomas, (v) => definir('avaliacao', { ...plano.avaliacao, sintomas: v }))}
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #3a3f55', borderRadius: 8, padding: '1rem' }}>
          <legend>Valores ilustrativos · preenchimento manual</legend>
          <div style={grade}>
            {linha('Energia', plano.metas.energia, (v) => definir('metas', { ...plano.metas, energia: v }), { unidade: 'kcal' })}
            {linha('Proteínas', plano.metas.proteinas, (v) => definir('metas', { ...plano.metas, proteinas: v }), { unidade: 'g' })}
            {linha('Carboidratos', plano.metas.carboidratos, (v) => definir('metas', { ...plano.metas, carboidratos: v }), { unidade: 'g' })}
            {linha('Gorduras', plano.metas.gorduras, (v) => definir('metas', { ...plano.metas, gorduras: v }), { unidade: 'g' })}
            {linha('Fibras', plano.metas.fibras, (v) => definir('metas', { ...plano.metas, fibras: v }), { unidade: 'g' })}
            {linha('Água', plano.metas.agua, (v) => definir('metas', { ...plano.metas, agua: v }), { unidade: 'mL' })}
          </div>
        </fieldset>

        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Refeições ({plano.refeicoes.length})</h3>
          {plano.refeicoes.map((refeicao, indice) => <fieldset key={refeicao.id} style={{ border: '1px solid #3a3f55', borderRadius: 8, padding: '1rem', display: 'grid', gap: 12 }}>
            <legend>Refeição {indice + 1}</legend>
            <div style={grade}>
              {linha('Nome *', refeicao.nome, (v) => alterarRefeicao(indice, { nome: v }), { maximo: 80 })}
              {linha('Horário', refeicao.horario, (v) => alterarRefeicao(indice, { horario: v }), { tipo: 'time' })}
            </div>
            {refeicao.alimentos.map((alimento, posicao) => <div key={alimento.id} style={{ ...grade, padding: '0.8rem', background: '#151925', borderRadius: 6 }}>
              {linha('Alimento *', alimento.nome, (v) => alterarAlimento(indice, posicao, { nome: v }))}
              {linha('Quantidade *', alimento.quantidade, (v) => alterarAlimento(indice, posicao, { quantidade: v }), { maximo: 30 })}
              {linha('Unidade *', alimento.unidade, (v) => alterarAlimento(indice, posicao, { unidade: v }), { maximo: 30 })}
              {linha('Preparo', alimento.preparo, (v) => alterarAlimento(indice, posicao, { preparo: v }))}
              {linha('Substituições equivalentes', alimento.substituicoes, (v) => alterarAlimento(indice, posicao, { substituicoes: v }), { maximo: 500 })}
              <button type="button" style={{ ...botao, background: '#9f3030', alignSelf: 'end' }} onClick={() => alterarRefeicao(indice, { alimentos: refeicao.alimentos.filter((item) => item.id !== alimento.id) })}>Remover alimento</button>
            </div>)}
            {linha('Observações da refeição', refeicao.observacoes, (v) => alterarRefeicao(indice, { observacoes: v }), { maximo: 500 })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" style={{ ...botao, background: '#394466' }} onClick={() => alterarRefeicao(indice, { alimentos: [...refeicao.alimentos, criarAlimento()] })}>+ Adicionar alimento</button>
              <button type="button" style={{ ...botao, background: '#9f3030' }} onClick={() => definir('refeicoes', plano.refeicoes.filter((item) => item.id !== refeicao.id))}>Remover refeição</button>
            </div>
          </fieldset>)}
          <button type="button" style={{ ...botao, justifySelf: 'start' }} onClick={() => definir('refeicoes', [...plano.refeicoes, criarRefeicao()])}>+ Adicionar refeição</button>
        </div>

        <div style={grade}>
          <label style={rotulo}>Orientações para o aluno<textarea style={{ ...campo, minHeight: 95 }} maxLength={4000} value={plano.orientacoes} onChange={(e) => definir('orientacoes', e.target.value)} /></label>
          <label style={rotulo}>Anotações internas (fora do PDF)<textarea style={{ ...campo, minHeight: 95 }} maxLength={4000} value={plano.observacoesInternas} onChange={(e) => definir('observacoesInternas', e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="submit" style={botao} disabled={salvando || !alunos.length}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar plano'}</button>
          {editando && <button type="button" style={{ ...botao, background: '#394466' }} onClick={limpar}>Cancelar edição</button>}
        </div>
        {!alunos.length && <p style={{ color: '#b5bdcb' }}>Cadastre primeiro um aluno na aba Usuários.</p>}
      </form>
    </section>

    <section style={caixa}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Planos salvos ({total})</h3>
        <select aria-label="Filtrar planos por aluno" style={{ ...campo, width: 'auto' }} value={filtroAluno} onChange={(e) => { setFiltroAluno(e.target.value); setPagina(0); }}>
          <option value="">Todos os alunos</option>
          {alunos.map((aluno) => <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>)}
        </select>
      </div>
      <p style={{ marginTop: 16, fontSize: 14, color: '#c2c9d8' }}>
        Material didático: confira as informações antes de compartilhar o PDF.
      </p>
      {carregando && <p>Carregando...</p>}
      {!carregando && !erro && !registros.length && <p style={{ color: '#b5bdcb' }}>Nenhum plano encontrado.</p>}
      {!carregando && registros.map((registro) => {
        const existente = lerPlano(registro.plano_alimentar);
        return <article key={registro.id} style={{ borderTop: '1px solid #3a3f55', marginTop: 18, paddingTop: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div><strong>{registro.titulo}</strong><div style={{ color: '#b5bdcb', fontSize: 13, marginTop: 4 }}>
            {alunos.find((aluno) => aluno.id === registro.aluno_id)?.nome || 'Aluno removido'} · {existente ? `${existente.refeicoes.length} refeições` : 'Registro antigo · edite para montar a dieta'}
          </div><details style={{ marginTop: 8 }}><summary>Ver informações</summary>
            {existente ? existente.refeicoes.map((item) => <p key={item.id} style={{ margin: '6px 0', color: '#c2c9d8' }}>{item.nome} {item.horario} · {item.alimentos.map((alimento) => `${alimento.nome} (${alimento.quantidade} ${alimento.unidade})`).join(', ')}</p>) : <p style={{ whiteSpace: 'pre-wrap' }}>{registro.detalhes}</p>}
          </details></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'start' }}>
            {existente && <><button type="button" style={{ ...botao, background: '#394466' }} onClick={() => baixarPdf(registro)}>Baixar PDF</button>
              <button type="button" style={{ ...botao, background: '#166534' }} onClick={() => void compartilhar(registro)}>Enviar PDF</button></>}
            <button type="button" style={{ ...botao, background: '#2563eb' }} onClick={() => editar(registro)}>Editar</button>
            <button type="button" style={{ ...botao, background: '#9f3030' }} onClick={() => void excluir(registro)}>Excluir</button>
          </div>
        </article>;
      })}
      {total > tamanho && <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <button type="button" style={botao} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina + 1} de {Math.ceil(total / tamanho)}</span>
        <button type="button" style={botao} disabled={(pagina + 1) * tamanho >= total} onClick={() => setPagina(pagina + 1)}>Próxima</button>
      </div>}
    </section>
  </div>;
}
