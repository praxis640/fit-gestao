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
    const al