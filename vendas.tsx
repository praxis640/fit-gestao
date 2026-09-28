      valor_unitario: precoUnitario,
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
    setMensagem(`Venda registrada: ${quantidadeNumero} × ${produtoSelecionado.nome} · R$ ${(Number(produtoSelecionado.preco) * quantidadeNumero).toFixed(2)}.`);
    setQuantidade('1');
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
        <div><small>🧾 Lançamentos recentes</small><strong>{vendas.length}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <form onSubmit={salvarProduto} style={{ display: 'grid', alignContent: 'start', gap: '0.8rem', padding: '1rem', border: '1px solid #3a3f55', borderRadius: '8px' }}>
          <h3 style={{ margin: 0 }}>{produtoEditando ? 'Editar produto' : 'Cadastrar produto'}</h3>
          <label style={label}>Nome do produto *
            <input style={campo} value={nomeProduto} maxLength={120} required onChange={(e) => setNomeProduto(e.target.value)} placeholder="Ex.: Luvas de boxe" />
          </label>
          <label style={label}>Categoria
            <input style={campo} value={categoriaProduto} maxLength={120} onChange={(e) => setCategoriaProduto(e.target.value)} placeholder="Ex.: Equipamentos" />
          </label>
          <label style={label}>Preço de venda (R$) *
            <input style={campo} type="number" min="0.01" step="0.01" value={precoProduto} required onChange={(e) => setPrecoProduto(e.target.value)} placeholder="0,00" />
          </label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="submit" disabled={salvando} style={{ ...botao, backgroundColor: '#635bfc' }}>{salvando ? 'Salvando...' : produtoEditando ? 'Salvar produto' : 'Adicionar produto'}</button>
            {produtoEditando && <button type="button" onClick={() => { setProdutoEditando(null); setNomeProduto(''); setCategoriaProduto(''); setPrecoProduto(''); }} style={{ ...botao, backgroundColor: '#3a3f55' }}>Cancelar</button>}
          </div>
        </form>

        <form onSubmit={registrarVenda} style={{ display: 'grid', alignContent: 'start', gap: '0.8rem', padding: '1rem', border: '1px solid #3a3f55', borderRadius: '8px' }}>
          <h3 style={{ margin: 0 }}>Registrar venda</h3>
          <label style={label}>Produto *
            <select style={campo} value={produtoId} required onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">Selecione um produto</option>
              {produtos.filter((produto) => produto.ativo).map((produto) => <option key={produto.id} value={produto.id}>{produto.nome} · R$ {Number(produto.preco).toFixed(2)}</option>)}
            </select>
          </label>
          <label style={label}>Aluno *
            <select style={campo} value={alunoId} required onChange={(e) => setAlunoId(e.target.value)}>
              <option value="">Selecione o aluno</option>
              {alunos.filter((aluno) => aluno.status === 'Ativo').map((aluno) => <option key={aluno.id} value={aluno.id}>{aluno.nome}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label style={label}>Quantidade *
              <input style={campo} type="number" min="1" max="10000" step="1" value={quantidade} required onChange={(e) => setQuantidade(e.target.value)} />
            </label>
            <label style={label}>Data da venda *
              <input style={campo} type="date" value={dataVenda} required onChange={(e) => setDataVenda(e.target.value)} />
            </label>
          </div>
          {produtoSelecionado && <p style={{ margin: 0, color: '#86efac' }}>Total da venda: R$ {(Number(produtoSelecionado.preco) * Math.max(1, Number(quantidade) || 1)).toFixed(2)}</p>}
          <button type="submit" disabled={salvando || produtos.every((produto) => !produto.ativo) || alunos.every((aluno) => aluno.status !== 'Ativo')} style={{ ...botao, backgroundColor: '#166534' }}>
            {salvando ? 'Registrando...' : 'Registrar venda e lançar nos ganhos'}
          </button>
          {alunos.every((aluno) => aluno.status !== 'Ativo') && <small style={{ color: '#fbbf24' }}>Cadastre um aluno ativo para vincular a venda.</small>}
        </form>
      </div>
    </section>

    <section style={caixa}>
      <h3 style={{ margin: '0 0 1rem' }}>Catálogo de produtos</h3>
      {produtos.length === 0 && !carregando && <p style={{ color: '#aeb5c6' }}>Nenhum produto cadastrado ainda.</p>}
      {produtos.map((produto) => <div key={produto.id} style={{ padding: '0.8rem 0', borderBottom: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.7rem' }}>
        <div>
          <strong>{produto.nome}</strong> <span style={{ color: '#86efac' }}>R$ {Number(produto.preco).toFixed(2)}</span>
          <div style={{ color: '#aeb5c6', fontSize: '0.85rem' }}>{produto.categoria || 'Sem categoria'} · {produto.ativo ? 'Disponível para venda' : 'Inativo'}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => { setProdutoEditando(produto.id); setNomeProduto(produto.nome); setCategoriaProduto(produto.categoria); setPrecoProduto(String(produto.preco)); }} style={{ ...botao, backgroundColor: '#3b82f6' }}>Editar</button>
          <button type="button" onClick={() => void alternarProduto(produto)} style={{ ...botao, backgroundColor: produto.ativo ? '#7c2d12' : '#166534' }}>{produto.ativo ? 'Desativar' : 'Ativar'}</button>
        </div>
      </div>)}
    </section>

    <section style={caixa}>
      <h3 style={{ margin: '0 0 0.4rem' }}>Histórico de vendas</h3>
      <p style={{ color: '#aeb5c6', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>As vendas ficam registradas com o preço praticado e entram na receita da academia na data informada.</p>
      {carregando && <p style={{ color: '#aeb5c6' }}>Carregando vendas...</p>}
      {!carregando && vendas.length === 0 && <p style={{ color: '#aeb5c6' }}>Nenhuma venda registrada.</p>}
      {vendas.map((venda) => <div key={venda.id} style={{ padding: '0.8rem 0', borderBottom: '1px solid #2a2f42', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.7rem' }}>
        <div><strong>{venda.produto_nome}</strong><div style={{ color: '#aeb5c6', fontSize: '0.85rem' }}>{venda.aluno_nome} · {venda.quantidade} × R$ {Number(venda.valor_unitario).toFixed(2)} · {venda.data_venda.split('-').reverse().join('/')}</div></div>
        <strong style={{ color: '#86efac' }}>R$ {Number(venda.valor_total).toFixed(2)}</strong>
      </div>)}
    </section>
  </div>;
}
