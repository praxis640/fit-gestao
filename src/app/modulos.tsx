'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { formatarTelefone, telefoneValido } from '@/lib/alunos';
import { catalogoExercicios, gruposMusculares } from '@/lib/catalogo-exercicios';
import { lerFicha, textoDaFicha, type ItemFicha } from '@/lib/fichas';
import { supabase } from '@/lib/supabase';
import { MODELO_CONTRATO_ADULTO, MODELO_CONTRATO_MENOR } from '@/lib/contrato';

export type TipoModulo = 'exercicio' | 'treino' | 'nutricao' | 'venda';
export type AlunoResumo = { id: string; nome: string; status: string; telefone?: string };

type Registro = {
  id: string;
  titulo: string;
  categoria: string;
  detalhes: string;
  aluno_id: string | null;
  valor: number | null;
  quantidade: number;
  data_registro: string;
  criado_em: string;
  ficha?: unknown;
};

const rotulos: Record<TipoModulo, { titulo: string; item: string; categoria: string; detalhes: string }> = {
  exercicio: { titulo: 'Biblioteca de Exercícios', item: 'Nome do exercício', categoria: 'Grupo muscular / modalidade', detalhes: 'Instruções de execução' },
  treino: { titulo: 'Fichas de Treino', item: 'Nome da ficha', categoria: 'Objetivo', detalhes: 'Observações gerais da ficha' },
  nutricao: { titulo: 'Rotinas de Nutrição', item: 'Nome da rotina', categoria: 'Objetivo', detalhes: 'Refeições e observações' },
  venda: { titulo: 'Registro de Vendas', item: 'Produto ou serviço', categoria: 'Categoria', detalhes: 'Observações da venda' }
};

const caixa: React.CSSProperties = { backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' };
const campo: React.CSSProperties = { width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid #3a3f55', backgroundColor: '#13151f', color: '#fff' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#aeb5c6' };
const botao: React.CSSProperties = { padding: '0.6rem 1rem', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' };
const POR_PAGINA = 20;

export function ModuloGestao({ tipo, userId, alunos }: { tipo: TipoModulo; userId: string; alunos: AlunoResumo[] }) {
  const config = rotulos[tipo];
  const formularioRef = useRef<HTMLDivElement>(null);
  const consultaAtualRef = useRef(0);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [filtroAluno, setFiltroAluno] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [valor, setValor] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [dataRegistro, setDataRegistro] = useState(() => dataEmSaoPaulo(new Date()));
  const [exercicios, setExercicios] = useState<{ id: string; titulo: string; categoria: string }[]>([]);
  const [exercicioId, setExercicioId] = useState('');
  const [series, setSeries] = useState('3');
  const [repeticoes, setRepeticoes] = useState('12');
  const [descanso, setDescanso] = useState('60');
  const [ficha, setFicha] = useState<ItemFicha[]>([]);
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [buscaExercicio, setBuscaExercicio] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState('');

  const carregar = useCallback(async () => {
    const numeroConsulta = ++consultaAtualRef.current;
    setCarregando(true);
    const campos: string = tipo === 'treino'
      ? 'id,titulo,categoria,detalhes,aluno_id,valor,quantidade,data_registro,criado_em,ficha'
      : 'id,titulo,categoria,detalhes,aluno_id,valor,quantidade,data_registro,criado_em';
    let consulta = supabase.from('gestao_registros')
      .select(campos, { count: 'exact' })
      .eq('user_id', userId).eq('tipo', tipo);
    if (filtroAluno) consulta = consulta.eq('aluno_id', filtroAluno);
    if (tipo === 'exercicio') {
      if (grupoFiltro) consulta = consulta.eq('categoria', grupoFiltro);
      if (buscaExercicio.trim()) consulta = consulta.ilike('titulo', `%${buscaExercicio.trim().replace(/[%_\\]/g, '')}%`);
    }
    const { data, count, error } = await consulta.order('criado_em', { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1);
    if (numeroConsulta !== consultaAtualRef.current) return;
    if (error) setErro(`Não foi possível carregar ${config.titulo.toLowerCase()}: ${error.message}. Verifique se executou o SQL dos módulos e da ficha.`);
    else {
      setErro('');
      // Os dois conjuntos de colunas são conhecidos acima; o parser de tipos do Supabase exige literal estático.
      setRegistros((data || []) as unknown as Registro[]);
      setTotal(count || 0);
    }
    setCarregando(false);
  }, [userId, tipo, pagina, filtroAluno, grupoFiltro, buscaExercicio, config.titulo]);

  useEffect(() => {
    // A consulta assíncrona atualiza o estado depois de receber os registros.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (tipo !== 'treino') return;
    supabase.from('gestao_registros').select('id,titulo,categoria').eq('user_id', userId)
      .eq('tipo', 'exercicio').order('titulo').range(0, 999).then(({ data, error }) => {
        setExercicios(data || []);
        if (error) setErro(`Não foi possível carregar a biblioteca: ${error.message}`);
      });
  }, [tipo, userId]);

  function adicionarExercicio() {
    const exercicio = exercicios.find((item) => item.id === exercicioId);
    const numeroSeries = Number(series);
    const numeroDescanso = Number(descanso);
    if (!exercicio || !Number.isInteger(numeroSeries) || numeroSeries < 1 || numeroSeries > 50 ||
      !repeticoes.trim() || repeticoes.length > 30 || !Number.isInteger(numeroDescanso) || numeroDescanso < 0 || numeroDescanso > 600) {
      setErro('Selecione o exercício e informe séries, repetições/tempo e descanso válidos.');
      return;
    }
    setFicha((atual) => [...atual, { exercicioId: exercicio.id, nome: exercicio.titulo, grupo: exercicio.categoria,
      series: numeroSeries, repeticoes: repeticoes.trim(), descanso: numeroDescanso, observacoes: '' }]);
    setExercicioId('');
    setErro('');
  }

  async function importarCatalogo() {
    setImportando(true);
    setMensagem('');
    const { data: existentes, error } = await supabase.from('gestao_registros').select('titulo,categoria')
      .eq('user_id', userId).eq('tipo', 'exercicio').range(0, 1999);
    if (error) {
      setErro(`Não foi possível ler a biblioteca: ${error.message}`);
      setImportando(false);
      return;
    }
    const chave = (titulo: string, categoria: string) => `${titulo.trim().toLocaleLowerCase('pt-BR')}|${categoria.trim().toLocaleLowerCase('pt-BR')}`;
    const cadastrados = new Set((existentes || []).map((item) => chave(item.titulo, item.categoria)));
    const novos = catalogoExercicios.filter((item) => !cadastrados.has(chave(item.titulo, item.categoria)));
    let adicionados = 0;
    for (let inicio = 0; inicio < novos.length; inicio += 40) {
      const lote = novos.slice(inicio, inicio + 40).map((item) => ({ ...item, tipo: 'exercicio', user_id: userId }));
      const { error: erroLote } = await supabase.from('gestao_registros').insert(lote);
      if (erroLote) {
        setErro(`Foram adicionados ${adicionados} exercícios; o restante falhou: ${erroLote.message}`);
        setImportando(false);
        await carregar();
        return;
      }
      adicionados += lote.length;
    }
    setImportando(false);
    setErro('');
    setMensagem(adicionados ? `${adicionados} exercícios adicionados à sua biblioteca.` : 'A biblioteca inicial já está cadastrada nesta conta.');
    setPagina(0);
    await carregar();
  }

  function moverExercicio(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= ficha.length) return;
    setFicha((atual) => {
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  function atualizarItem(indice: number, alteracao: Partial<ItemFicha>) {
    setFicha((atual) => atual.map((item, posicao) => posicao === indice ? { ...item, ...alteracao } : item));
  }

  function textoRegistro(registro: Registro) {
    const aluno = alunos.find((item) => item.id === registro.aluno_id);
    return textoDaFicha(registro.titulo, aluno?.nome || 'Aluno não encontrado', registro.categoria, registro.detalhes, lerFicha(registro.ficha));
  }

  function baixarFicha(registro: Registro) {
    const conteudo = textoRegistro(registro);
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ficha-${registro.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copiarFicha(registro: Registro) {
    try {
      await navigator.clipboard.writeText(textoRegistro(registro));
      setMensagem('Ficha copiada. Cole na conversa do aluno.');
    } catch {
      setErro('Não foi possível copiar automaticamente. Use “Baixar ficha” para compartilhar o arquivo.');
    }
  }

  function abrirWhatsApp(registro: Registro) {
    const aluno = alunos.find((item) => item.id === registro.aluno_id);
    const digitos = (aluno?.telefone || '').replace(/\D/g, '');
    if (!telefoneValido(aluno?.telefone || '')) {
      setErro('Cadastre um telefone com DDD no perfil do aluno para abrir o WhatsApp. Você também pode copiar ou baixar a ficha.');
      return;
    }
    window.open(`https://wa.me/55${digitos}?text=${encodeURIComponent(textoRegistro(registro))}`, '_blank', 'noopener,noreferrer');
  }

  function limpar() {
    setEditando(null);
    setTitulo('');
    setCategoria('');
    setDetalhes('');
    setAlunoId('');
    setValor('');
    setQuantidade('1');
    setDataRegistro(dataEmSaoPaulo(new Date()));
    setFicha([]);
    setExercicioId('');
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!titulo.trim()) return;
    if ((tipo === 'treino' || tipo === 'nutricao') && !alunoId) {
      setErro('Selecione o aluno para salvar este registro.');
      return;
    }
    if (tipo === 'treino' && !editando && ficha.length === 0) {
      setErro('Adicione pelo menos um exercício à ficha.');
      return;
    }
    if (tipo === 'treino' && ficha.some((item) => !Number.isInteger(item.series) || item.series < 1 || item.series > 50 ||
      !item.repeticoes.trim() || item.repeticoes.length > 30 || !Number.isInteger(item.descanso) || item.descanso < 0 || item.descanso > 600)) {
      setErro('Corrija as séries, repetições/tempo ou descanso dos exercícios da ficha.');
      return;
    }
    const valorNumero = Number(valor);
    const quantidadeNumero = Number(quantidade);
    if (tipo === 'venda' && (!Number.isFinite(valorNumero) || valorNumero <= 0 ||
      !Number.isInteger(quantidadeNumero) || quantidadeNumero <= 0)) {
      setErro('Informe valor unitário positivo e quantidade inteira maior que zero.');
      return;
    }

    const registro = {
      user_id: userId,
      tipo,
      titulo: titulo.trim(),
      categoria: categoria.trim(),
      detalhes: detalhes.trim(),
      aluno_id: alunoId || null,
      valor: tipo === 'venda' ? valorNumero : null,
      quantidade: tipo === 'venda' ? quantidadeNumero : 1,
      data_registro: dataRegistro,
      ...(tipo === 'treino' ? { ficha } : {})
    };
    setSalvando(true);
    const resposta = editando
      ? await supabase.from('gestao_registros').update(registro).eq('id', editando).eq('user_id', userId).eq('tipo', tipo).select('id')
      : await supabase.from('gestao_registros').insert(registro).select('id');
    setSalvando(false);
    if (resposta.error) {
      setErro('Não foi possível salvar: ' + resposta.error.message + (tipo === 'treino' ? '. Execute a migração SQL da ficha, se ainda não o fez.' : ''));
      return;
    }
    if (!resposta.data?.length) {
      setErro('O registro não foi encontrado nesta conta.');
      return;
    }
    setErro('');
    limpar();
    if (pagina !== 0) setPagina(0);
    else await carregar();
  }

  function editar(registro: Registro) {
    setEditando(registro.id);
    setTitulo(registro.titulo);
    setCategoria(registro.categoria);
    setDetalhes(registro.detalhes);
    setAlunoId(registro.aluno_id || '');
    setValor(registro.valor == null ? '' : String(registro.valor));
    setQuantidade(String(registro.quantidade));
    setDataRegistro(registro.data_registro);
    setFicha(tipo === 'treino' ? lerFicha(registro.ficha) : []);
    setErro('');
    formularioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function excluir(registro: Registro) {
    if (!confirm(`Excluir “${registro.titulo}”?`)) return;
    const { data, error } = await supabase.from('gestao_registros').delete()
      .eq('id', registro.id).eq('user_id', userId).eq('tipo', tipo).select('id');
    if (error || !data?.length) {
      setErro(error?.message || 'Registro não encontrado nesta conta.');
      return;
    }
    if (editando === registro.id) limpar();
    if (pagina > 0 && registros.length === 1) setPagina(pagina - 1);
    else await carregar();
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section ref={formularioRef} style={caixa}>
        <h2 style={{ margin: '0 0 0.4rem' }}>{config.titulo}</h2>
        <p style={{ color: '#aeb5c6', fontSize: '0.9rem', margin: '0 0 1.2rem' }}>
          {tipo === 'exercicio' && 'Cadastre exercícios para consultar sua biblioteca na hora de montar um treino.'}
          {tipo === 'treino' && 'Monte uma ficha por aluno, salve os exercícios em ordem e compartilhe pelo WhatsApp ou como arquivo.'}
          {tipo === 'nutricao' && 'Organize rotinas e observações de alimentação por aluno.'}
          {tipo === 'venda' && 'Anote produtos e serviços vendidos. Estes valores não entram em Pagamentos ou Financeiro.'}
        </p>
        {erro && <p role="alert" style={{ color: '#fecaca' }}>{erro}</p>}
        {mensagem && <p role="status" style={{ color: '#86efac' }}>{mensagem}</p>}
        {tipo === 'exercicio' && <div style={{ marginBottom: '1.3rem', padding: '1rem', border: '1px solid #3a3f55', borderRadius: '8px' }}>
          <strong>Biblioteca inicial: {catalogoExercicios.length} exercícios · {gruposMusculares.length} grupos</strong>
          <p style={{ color: '#aeb5c6', margin: '0.5rem 0 0.8rem' }}>Inclui membros superiores, inferiores, core, cardio e mobilidade. Você pode editar os exercícios depois de importar e cadastrar outros abaixo.</p>
          <button type="button" disabled={importando} onClick={() => void importarCatalogo()} style={{ ...botao, backgroundColor: '#2563eb' }}>
            {importando ? 'Importando...' : 'Adicionar biblioteca inicial à minha conta'}
          </button>
        </div>}
        <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
          <label style={label}>{config.item} *
            <input style={campo} value={titulo} required maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label style={label}>{config.categoria}
            <input style={campo} list={tipo === 'exercicio' ? 'grupos-musculares' : undefined} value={categoria} maxLength={120} onChange={(e) => setCategoria(e.target.value)} />
          </label>
          {tipo === 'exercicio' && <datalist id="grupos-musculares">{gruposMusculares.map((grupo) => <option key={grupo} value={grupo} />)}</datalist>}
          {tipo !== 'exercicio' && <label style={label}>Aluno {tipo !== 'venda' ? '*' : '(opcional)'}
            <select style={campo} value={alunoId} required={tipo !== 'venda'} onChange={(e) => setAlunoId(e.target.value)}>
              <option value="">{tipo === 'venda' ? 'Sem aluno vinculado' : 'Selecione um aluno'}</option>
              {alunos.filter((aluno) => aluno.status === 'Ativo' || aluno.id === alunoId).map((aluno) =>
                <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>)}
            </select>
          </label>}
          {tipo === 'venda' && <>
            <label style={label}>Valor unitário (R$) *
              <input style={campo} type="number" min="0.01" step="0.01" value={valor} required onChange={(e) => setValor(e.target.value)} />
            </label>
            <label style={label}>Quantidade *
              <input style={campo} type="number" min="1" step="1" value={quantidade} required onChange={(e) => setQuantidade(e.target.value)} />
            </label>
            <label style={label}>Data da venda
              <input style={campo} type="date" value={dataRegistro} required onChange={(e) => setDataRegistro(e.target.value)} />
            </label>
          </>}
          {tipo === 'treino' && <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ ...label, flex: '3 1 250px' }}>Adicionar da biblioteca
                <select style={campo} value={exercicioId} onChange={(e) => setExercicioId(e.target.value)}>
                  <option value="">Selecione um exercício</option>
                  {exercicios.map((item) => <option key={item.id} value={item.id}>{item.categoria ? `${item.categoria} · ` : ''}{item.titulo}</option>)}
                </select>
              </label>
              <label style={{ ...label, flex: '1 1 80px' }}>Séries
                <input style={campo} type="number" min="1" max="50" value={series} onChange={(e) => setSeries(e.target.value)} />
              </label>
              <label style={{ ...label, flex: '1 1 130px' }}>Repetições / tempo
                <input style={campo} value={repeticoes} maxLength={30} placeholder="12 ou 30 segundos" onChange={(e) => setRepeticoes(e.target.value)} />
              </label>
              <label style={{ ...label, flex: '1 1 110px' }}>Descanso (s)
                <input style={campo} type="number" min="0" max="600" value={descanso} onChange={(e) => setDescanso(e.target.value)} />
              </label>
              <button type="button" onClick={adicionarExercicio} disabled={!exercicioId} style={{ ...botao, backgroundColor: '#3a3f55' }}>Adicionar à ficha</button>
            </div>
            {exercicios.length === 0 && <p style={{ color: '#aeb5c6', margin: 0 }}>Sua biblioteca está vazia. Vá à aba Exercícios e clique em “Adicionar biblioteca inicial”.</p>}
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <strong>Exercícios da ficha ({ficha.length})</strong>
              {ficha.map((item, indice) => <div key={`${item.exercicioId}-${indice}`} style={{ padding: '0.8rem', backgroundColor: '#13151f', border: '1px solid #3a3f55', borderRadius: '6px', display: 'grid', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <strong style={{ flex: 1 }}>{indice + 1}. {item.nome} <small style={{ color: '#aeb5c6' }}>{item.grupo}</small></strong>
                  <button type="button" aria-label={`Subir ${item.nome}`} disabled={indice === 0} onClick={() => moverExercicio(indice, -1)} style={{ ...botao, backgroundColor: '#3a3f55' }}>↑</button>
                  <button type="button" aria-label={`Descer ${item.nome}`} disabled={indice === ficha.length - 1} onClick={() => moverExercicio(indice, 1)} style={{ ...botao, backgroundColor: '#3a3f55' }}>↓</button>
                  <button type="button" onClick={() => setFicha((atual) => atual.filter((_, posicao) => posicao !== indice))} style={{ ...botao, backgroundColor: '#b91c1c' }}>Remover</button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ ...label, flex: '1 1 85px' }}>Séries<input style={campo} type="number" min="1" max="50" value={item.series} onChange={(e) => atualizarItem(indice, { series: Number(e.target.value) })} /></label>
                  <label style={{ ...label, flex: '1 1 130px' }}>Repetições / tempo<input style={campo} value={item.repeticoes} maxLength={30} onChange={(e) => atualizarItem(indice, { repeticoes: e.target.value })} /></label>
                  <label style={{ ...label, flex: '1 1 110px' }}>Descanso (s)<input style={campo} type="number" min="0" max="600" value={item.descanso} onChange={(e) => atualizarItem(indice, { descanso: Number(e.target.value) })} /></label>
                  <label style={{ ...label, flex: '3 1 200px' }}>Observações de execução<input style={campo} value={item.observacoes} maxLength={240} onChange={(e) => atualizarItem(indice, { observacoes: e.target.value })} placeholder="Opcional" /></label>
                </div>
              </div>)}
            </div>
          </div>}
          <label style={{ ...label, gridColumn: '1 / -1' }}>{config.detalhes}
            <textarea style={{ ...campo, resize: 'vertical' }} rows={4} maxLength={4000} value={detalhes} onChange={(e) => setDetalhes(e.target.value)} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.8rem' }}>
            <button type="submit" disabled={salvando || ((tipo === 'treino' || tipo === 'nutricao') && alunos.length === 0)} style={{ ...botao, backgroundColor: '#635bfc' }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editando && <button type="button" onClick={limpar} style={{ ...botao, backgroundColor: '#3a3f55' }}>Cancelar edição</button>}
          </div>
        </form>
        {alunos.length === 0 && (tipo === 'treino' || tipo === 'nutricao') &&
          <p style={{ color: '#aeb5c6' }}>Cadastre primeiro um aluno na aba Usuários.</p>}
      </section>

      <section style={caixa}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>Registros ({total})</h3>
          {tipo === 'exercicio' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <input type="search" aria-label="Pesquisar exercício" placeholder="Pesquisar exercício" style={{ ...campo, width: '190px' }} value={buscaExercicio} onChange={(e) => { setBuscaExercicio(e.target.value); setPagina(0); }} />
            <select aria-label="Filtrar grupo muscular" style={{ ...campo, width: 'auto' }} value={grupoFiltro} onChange={(e) => { setGrupoFiltro(e.target.value); setPagina(0); }}>
              <option value="">Todos os grupos</option>
              {gruposMusculares.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
            </select>
          </div>}
          {tipo !== 'exercicio' && tipo !== 'venda' && <select aria-label="Filtrar por aluno" style={{ ...campo, width: 'auto' }} value={filtroAluno} onChange={(e) => { setFiltroAluno(e.target.value); setPagina(0); }}>
            <option value="">Todos os alunos</option>
            {alunos.map((aluno) => <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>)}
          </select>}
        </div>
        {carregando && <p style={{ color: '#aeb5c6' }}>Carregando...</p>}
        {!carregando && !erro && registros.length === 0 && <p style={{ color: '#aeb5c6' }}>Nenhum registro encontrado.</p>}
        {!carregando && !erro && registros.map((registro) => <div key={registro.id} style={{ padding: '1rem 0', borderBottom: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '200px', flex: 1 }}>
            <strong>{registro.titulo}</strong>
            <div style={{ color: '#aeb5c6', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {[registro.categoria, registro.aluno_id ? alunos.find((aluno) => aluno.id === registro.aluno_id)?.nome || 'Aluno removido' : '',
                tipo === 'venda' ? `${registro.quantidade} × R$ ${Number(registro.valor || 0).toFixed(2)} = R$ ${(registro.quantidade * Number(registro.valor || 0)).toFixed(2)} · ${registro.data_registro.split('-').reverse().join('/')}` : '']
                .filter(Boolean).join(' · ')}
            </div>
            {registro.detalhes && <p style={{ color: '#c9ced9', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0.5rem 0 0' }}>{registro.detalhes}</p>}
            {tipo === 'treino' && <>
              <p style={{ color: '#aeb5c6', margin: '0.5rem 0' }}>{lerFicha(registro.ficha).length} exercício(s) na ficha</p>
              {fichaAberta === registro.id && <ol style={{ paddingLeft: '1.3rem', color: '#c9ced9' }}>
                {lerFicha(registro.ficha).map((item, indice) => <li key={`${item.exercicioId}-${indice}`} style={{ margin: '0.4rem 0' }}>
                  {item.nome}: {item.series} séries · repetições/tempo {item.repeticoes} · descanso {item.descanso}s{item.observacoes ? ` · ${item.observacoes}` : ''}
                </li>)}
              </ol>}
            </>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {tipo === 'treino' && <>
              <button type="button" onClick={() => setFichaAberta((atual) => atual === registro.id ? null : registro.id)} style={{ ...botao, backgroundColor: '#3a3f55' }}>{fichaAberta === registro.id ? 'Ocultar ficha' : 'Ver ficha'}</button>
              {lerFicha(registro.ficha).length > 0 && <>
                <button type="button" onClick={() => baixarFicha(registro)} style={{ ...botao, backgroundColor: '#3a3f55' }}>Baixar ficha</button>
                <button type="button" onClick={() => void copiarFicha(registro)} style={{ ...botao, backgroundColor: '#3a3f55' }}>Copiar</button>
                <button type="button" onClick={() => abrirWhatsApp(registro)} style={{ ...botao, backgroundColor: '#166534' }}>WhatsApp</button>
              </>}
            </>}
            <button type="button" onClick={() => editar(registro)} style={{ ...botao, backgroundColor: '#3b82f6' }}>Editar</button>
            <button type="button" onClick={() => void excluir(registro)} style={{ ...botao, backgroundColor: '#b91c1c' }}>Excluir</button>
          </div>
        </div>)}
        {total > POR_PAGINA && <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
          <button type="button" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} style={botao}>Anterior</button>
          <span>Página {pagina + 1} de {Math.ceil(total / POR_PAGINA)}</span>
          <button type="button" disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina(pagina + 1)} style={botao}>Próxima</button>
        </div>}
      </section>
    </div>
  );
}

export function Configuracoes({ userId, onNomeAtualizado }: { userId: string; onNomeAtualizado: (nome: string) => void }) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [modeloContratoAdulto, setModeloContratoAdulto] = useState(MODELO_CONTRATO_ADULTO);
  const [modeloContratoMenor, setModeloContratoMenor] = useState(MODELO_CONTRATO_MENOR);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;
    supabase.from('gestao_configuracoes').select('nome_academia,telefone,observacoes,modelo_contrato,modelo_contrato_adulto,modelo_contrato_menor')
      .eq('user_id', userId).maybeSingle().then(({ data, error }) => {
        if (!ativo) return;
        if (error) setMensagem(`Não foi possível carregar as configurações: ${error.message}. Execute a migração atualizada de contratos no Supabase.`);
        else if (data) {
          setNome(data.nome_academia);
          setTelefone(formatarTelefone(data.telefone || ''));
          setObservacoes(data.observacoes || '');
          setModeloContratoAdulto(data.modelo_contrato_adulto || data.modelo_contrato || MODELO_CONTRATO_ADULTO);
          setModeloContratoMenor(data.modelo_contrato_menor || MODELO_CONTRATO_MENOR);
        }
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, [userId]);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    if (telefone && !telefoneValido(telefone)) {
      setMensagem('Informe telefone com DDD e 10 ou 11 dígitos, ou deixe vazio.');
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from('gestao_configuracoes').upsert({
      user_id: userId,
      nome_academia: nome.trim(),
      telefone: telefone ? formatarTelefone(telefone) : '',
      observacoes: observacoes.trim(),
      modelo_contrato: modeloContratoAdulto.trim() || MODELO_CONTRATO_ADULTO,
      modelo_contrato_adulto: modeloContratoAdulto.trim() || MODELO_CONTRATO_ADULTO,
      modelo_contrato_menor: modeloContratoMenor.trim() || MODELO_CONTRATO_MENOR,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'user_id' });
    setSalvando(false);
    setMensagem(error ? `Não foi possível salvar: ${error.message}` : 'Configurações salvas.');
    if (!error) onNomeAtualizado(nome.trim());
  }

  return <section style={caixa}>
    <h2 style={{ marginTop: 0 }}>Configurações da Academia</h2>
    <p style={{ color: '#aeb5c6' }}>Personalize os dados da academia e mantenha um modelo de contrato para adultos e outro para menores.</p>
    {mensagem && <p role="status" style={{ color: mensagem.startsWith('Configurações salvas') ? '#86efac' : '#fecaca' }}>{mensagem}</p>}
    {carregando ? <p>Carregando...</p> : <form onSubmit={salvar} style={{ display: 'grid', gap: '1rem', maxWidth: '620px' }}>
      <label style={label}>Nome da academia *
        <input style={campo} required value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} placeholder="Nome da sua academia" />
      </label>
      <label style={label}>Telefone de contato
        <input style={campo} type="tel" value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} placeholder="(54)99999-9999" />
      </label>
      <label style={label}>Observações internas
        <textarea style={{ ...campo, resize: 'vertical' }} rows={4} value={observacoes} maxLength={2000} onChange={(e) => setObservacoes(e.target.value)} />
      </label>
      <section aria-labelledby="modelos-contrato-titulo" style={{ display: 'grid', gap: '1rem', padding: '1rem', border: '1px solid #454b63', borderRadius: 10, background: '#191c28' }}>
        <div>
          <h3 id="modelos-contrato-titulo" style={{ margin: '0 0 0.4rem', color: '#fff' }}>Modelos de contrato</h3>
          <p style={{ margin: 0, color: '#aeb5c6' }}>Edite e salve separadamente o contrato usado para adultos e o contrato usado para menores de 18 anos. O perfil do aluno seleciona o modelo pela data de nascimento.</p>
        </div>
        <label style={label}>Opção 1 — Adultos (18 anos ou mais)
          <small>Aplicado automaticamente aos alunos adultos. Os campos entre chaves são preenchidos com os dados do aluno e da academia.</small>
          <textarea aria-label="Modelo de contrato para adultos" style={{ ...campo, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }} rows={18} value={modeloContratoAdulto} maxLength={20000} onChange={(e) => setModeloContratoAdulto(e.target.value)} />
        </label>
        <button type="button" onClick={() => setModeloContratoAdulto(MODELO_CONTRATO_ADULTO)} style={{ ...botao, backgroundColor: '#353a4c', justifySelf: 'start' }}>Restaurar modelo adulto</button>
        <label style={label}>Opção 2 — Menores de 18 anos
          <small>Aplicado automaticamente conforme a data de nascimento. Inclui os campos do responsável legal.</small>
          <textarea aria-label="Modelo de contrato para menores de idade" style={{ ...campo, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }} rows={18} value={modeloContratoMenor} maxLength={20000} onChange={(e) => setModeloContratoMenor(e.target.value)} />
        </label>
        <button type="button" onClick={() => setModeloContratoMenor(MODELO_CONTRATO_MENOR)} style={{ ...botao, backgroundColor: '#353a4c', justifySelf: 'start' }}>Restaurar modelo de menor</button>
        <small style={{ color: '#aeb5c6' }}>Campos automáticos: {'{{ACADEMIA}}'}, {'{{CNPJ_ACADEMIA}}'}, {'{{ENDERECO_ACADEMIA}}'}, {'{{ALUNO}}'}, {'{{IDADE}}'}, {'{{NASCIMENTO}}'}, {'{{CPF_ALUNO}}'}, {'{{TELEFONE_ALUNO}}'}, {'{{ENDERECO_ALUNO}}'}, {'{{RESPONSAVEL}}'}, {'{{CPF_RESPONSAVEL}}'}, {'{{TELEFONE_RESPONSAVEL}}'}, {'{{PARENTESCO}}'}, {'{{PAPEL_RESPONSAVEL}}'}, {'{{PLANO}}'}, {'{{MENSALIDADE}}'}, {'{{DIA_VENCIMENTO}}'}, {'{{FIM_PLANO}}'}, {'{{TEXTO_ASSISTENCIA}}'}, {'{{ASSINATURA_ALUNO}}'}, {'{{ASSINATURA_RESPONSAVEL}}'}, {'{{CIDADE}}'} e {'{{DATA}}'}.</small>
      </section>
      <button type="submit" disabled={salvando} style={{ ...botao, backgroundColor: '#635bfc', justifySelf: 'start' }}>{salvando ? 'Salvando...' : 'Salvar configurações'}</button>
    </form>}
  </section>;
}
