'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataEmSaoPaulo } from '@/lib/faturamento';
import { supabase } from '@/lib/supabase';

type Produto = { id: string; nome: string; categoria: string; preco: number; custo: number | null; ativo: boolean };
type Venda = {
  id: string;
  produto_nome: string;
  categoria: string;
  aluno_id: string | null;
  aluno_nome: string;
  valor_unitario: number;
  custo_unitario: number | null;
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
  const [custoProduto, setCustoProduto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [custoVenda, setCustoVenda] = useState('');
  const [produtoEditando, setProdutoEditando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resProdutos, resVendas] = await Promise.all([
      supabase.from('gestao_produtos').select('id,nome,categoria,preco,custo,ativo').eq('user_id', userId).order('nome').range(0, 999),
      supabase.from('gestao_vendas').select('id,produto_nome,categoria,aluno_id,aluno_nome,valor_unitario,custo_unitario,quantidade,valor_total,data_venda')
        .eq('user_id', userId).order('data_venda', { ascending: false }).order('criado_em', { ascending: false }).range(0, 99)
    ]);
    if (resProdutos.error || resVendas.error) {
      setErro(`Não foi possível carregar as vendas: ${(resProdutos.error || resVendas.error)?.message}. Execute a migração 20261006_perfil_frequencia_lucro.sql no Supabase.`);
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
  const lucroBrutoMes = useMemo(() => {
    const mesAtual = dataEmSaoPaulo(new Date()).slice(0, 7);
    return vendas.filter((venda) => venda.data_venda.startsWith(mesAtual) && venda.custo_unitario != null)
      .reduce((soma, venda) => soma + Number(venda.valor_total) - Number(venda.custo_unitario) * Number(venda.quantidade), 0);
  }, [vendas]);
  const produtoSelecionado = produtos.find((produto) => produto.id === produtoId && produto.ativo);
  const custoUnitarioSelecionado = Number(custoVenda || 0);
  const custoVendaInformado = custoVenda.trim() !== '' && Number.isFinite(custoUnitarioSelecionado) && custoUnitarioSelecionado >= 0;
  const precoUnitarioSelecionado = Number(precoVenda || produtoSelecionado?.preco || 0);
  const quantidadeCalculada = Math.max(1, Number(quantidade) || 1);

  async function salvarProduto(evento: React.FormEvent) {
    evento.preventDefault();
    const preco = Number(precoProduto);
    const custo = Number(custoProduto);
    if (!nomeProduto.trim() || !Number.isFinite(preco) || preco <= 0 || !Number.isFinite(custo) || custo < 0) {
      setErro('Informe o nome, preço de venda positivo e custo igual ou maior que zero.');
      return;
    }
    setSalvando(true);
    const dados = { nome: nomeProduto.trim(), categoria: categoriaProduto.trim(), preco, custo };
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
    setCustoProduto('');
    setProdutoEditando(null);
    setErro('');
    setMensagem(produtoEditando ? 'Produto atualizado.' : 'Produto cadastrado no catálogo.');
    await carregar();
  }

  async function alternarProduto(produto: Produto) {
    const { error: erroAtualizacao } = await supabase.from('gestao_produtos').update({ ativo: !produto.ativo })
      .eq('id', produto.id).eq('user_id', userId);
    if (erroAtualizacao) setErro(`Não foi possível atualizar o produto: ${erroAtualizacao.message}`);
    else {
      if (produtoId === produto.id && produto.ativo) setProdutoId('');
      await carregar();
    }
  }

  async function registrarVenda(evento: React.FormEvent) {
    evento.preventDefault();
    const quantidadeNumero = Number(quantidade);
    const alunoSelecionado = alunos.find((aluno) => aluno.id === alunoId && aluno.status === 'Ativo');
    if (!produtoSelecionado || !alunoSelecionado || !Number.isInteger(quantidadeNumero) || quantidadeNumero < 1 || quantidadeNumero > 10000) {
      setErro('Selecione um produto, um aluno e uma quantidade inteira entre 1 e 10000.');
      return;
    }
    const precoPraticado = Number(precoVenda || produtoSelecionado.preco);
    const custoPraticado = Number(custoVenda);
    if (!Number.isFinite(precoPraticado) || precoPraticado <= 0 || !custoVenda.trim() || !Number.isFinite(custoPraticado) || custoPraticado < 0) {
      setErro('Informe um preço de venda positivo e o custo pago por unidade (zero ou maior).');
      return;
    }
    setSalvando(true);
    const precoUnitario = precoPraticado;
    const custoUnitario = custoPraticado;
    const { data: vendaCriada, error: erroVenda } = await supabase.from('gestao_vendas').insert({
      user_id: userId,
      produto_id: produtoSelecionado.id,
      produto_nome: produtoSelecionado.nome,
      categoria: produtoSelecionado.categoria,
      aluno_id: alunoSelecionado.id,
      aluno_nome: alunoSelecionado.nome,
      valor_unitario: precoUnitario,
      custo_unitario: custoUnitario,
      quantidade: quantidadeNumero,
      valor_total: precoUnitario * quantidadeNumero,
      data_venda: dataVenda
    }).select('id');
    setSalvando(false);
    if (erroVenda || !vendaCriada?.length) {
      setErro(`Não foi possível registrar a venda: ${erroVenda?.message || 'o banco não confirmou o lançamento.'}`);
      return;
    }
    setErro('');
    setMensagem(`Venda registrada: ${quantidadeNumero} × ${produtoSelecionado.nome} · lucro bruto R$ ${((precoUnitario - custoUnitario) * quantidadeNumero).toFixed(2)}.`);
    setQuantidade('1');
    setPrecoVenda('');
    setCustoVenda(String(custoUnitario));
    setDataVenda(dataEmSaoPaulo(new Date()));
    await Promise.all([carregar(), onVendaRegistrada()]);
  }

  return <div style={{ display: 'grid', gap: '1.5rem' }}>
    <section style={caixa}>
      <h2 style={{ margin: '0 0 0.4rem' }}>Vendas da academia</h2>
      <p style={{ color: '#aeb5c6', fontSize: '0.9rem', margin: '0 0 1.2rem' }}>
        Cadastre seus produtos, lance a venda para um aluno e veja a receita somada ao Financeiro.
      </p>
      {erro && <p role="alert" style={{ color: '#fecaca' }}>{erro}</p>}
      {mensagem && <p role="status" style={{ color: '#86efac' }}>{mensagem}</p>}
      <div className="aluno-kpis" style={{ marginBottom: '1.3rem' }}>
        <div><small>🛍️ Produtos ativos</small><strong>{produtos.filter((produto) => produto.ativo).length}</strong></div>
        <div><small>💵 Vendas neste mês</small><strong>R$ {totalMes.toFixed(2)}</strong></div>
        <div><small>📈 Lucro bruto neste mês</small><strong>R$ {lucroBrutoMes.toFixed(2)}</strong></div>
        <div><small>🧾 Lançamentos recentes</small><strong>{vendas.length}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <form onSubmit={salvarProduto} style={{ display: 'grid', alignContent: 'start', gap: '0.8rem', padding: '1rem', border: '1px solid #3a3f55', borderRadius: '8px' }}>
          <h3 style={{ margin: 0 }}>{produtoEditando ? 'Editar produto' : 'Cadastrar produto'}</h3>
          <label style={label}>Nome do produto *
            <input style={campo} value={nomeProduto} maxLength={120} required onChange={(e) => setNomeProduto(e.target.value)} placeholder="Ex.: Luvas de boxe" />
          </label>
          <label style={label}>Categoria
            <input style={campo} value={c