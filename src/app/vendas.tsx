'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { supabase } from '@/lib/supabase';

type Produto = { id: string; nome: string; categoria: string; preco: number; ativo: boolean };
type Venda = {
  id: string;
  produto_nome: string;
  categoria: string;
  aluno_id: string | null;
  aluno_nome: string;
  valor_unitario: number;
  quantidade: number;
  valor_total: number;
  data_venda: string;
};
type Aluno = { id: string; nome: string; status: string };

const caixa: React.CSSProperties = { backgroundColor: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #2a2f42' };
const campo: React.CSSProperties = { width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid #3a3f55', backgroundColor: '#13151f', color: '#fff' };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#aeb5c6' };
const botao: React.CSSProperties = { padding: '0.6rem 1rem', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' };

export function Vendas({ userId, alunos, onVendaRegistrada }: {
  userId: string;
  alunos: Aluno[];
  onVendaRegistrada: () => void | Promise<void>;
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [dataVenda, setDataVenda] = useState(() => dataEmSaoPaulo(new Date()));
  const [nomeProduto, setNomeProduto] = useState('');
  const [categoriaProduto, setCategoriaProduto] = useState('');
  const [precoProduto, setPrecoProduto] = useState('');
  const [produtoEditando, setProdutoEditando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resProdutos, resVendas] = await Promise.all([
      supabase.from('gestao_produtos').select('id,nome,categoria,preco,ativo').eq('user_id', userId).order('nome').range(0, 999),
      supabase.from('gestao_vendas').select('id,produto_nome,categoria,aluno_id,aluno_nome,valor_unitario,quantidade,valor_total,data_venda')
        .eq('user_id', userId).order('data_venda', { ascending: false }).order('criado_em', { ascending: false }).range(0, 99)
    ]);
    if (resProdutos.error || resVendas.error) {
      setErro(`Não foi possível carregar as vendas: ${(resProdutos.error || resVendas.error)?.message}. Verifique se executou a migração 20260926_vendas_produtos_financeiro.sql.`);
    } else {
      setProdutos((resProdutos.data || []) as Produto[]);
      setVendas((resVendas.data || []) as Venda[]);
      setErro('');
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    // A consulta assíncrona atualiza a tela quando os dados chegam.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const totalMes = useMemo(() => {
    const mesAtual = dataEmSaoPaulo(new Date()).slice(0, 7);
    return vendas.filter((venda) => venda.data_venda.startsWith(mesAtual))
      .reduce((soma, venda) => soma + Number(venda.valor_total), 0);
  }, [vendas]);
  const produtoSelecionado = produtos.find((produto) => produto.id === produtoId && produto.ativo);

  async function salvarProduto(evento: React.FormEvent) {
    evento.preventDefault();
    const preco = Number(precoProduto);
    if (!nomeProduto.trim() || !Number.isFinite(preco) || preco <= 0) {
      setErro('Informe o nome do produto e um preço positivo.');
      return;
    }
    setSalvando(true);
    const dados = { nome: nomeProduto.trim(), categoria: categoriaProduto.trim(), preco };
    const resposta = produtoEditando
      ? await supabase.from('gestao_produtos').update(dados).eq('id', produtoEditando).eq('user_id', userId).select('id')
      : await supabase.from('gestao_produtos').insert({ ...dados, user_id: userId }).select('id');
    setSalvando(false);
    if (resposta.error || !resposta.data?.length) {
      setErro(resposta.error?.message || 'Produto não encontrado nesta conta.');
      return;
    }
    setNomeProduto('');
    setCategoriaProduto('');
    setPrecoProduto('');
    setProdutoEditando(null);