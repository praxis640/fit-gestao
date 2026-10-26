// Integração das rotas com duas academias em um Supabase HTTP simulado.
// Executar: node scripts/test-professores.cjs (não usa contas nem dados de produção).
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function carregarTs(arquivo) {
  if (cache.has(arquivo)) return cache.get(arquivo).exports;
  const mod = new Module(arquivo, module);
  mod.filename = arquivo;
  mod.paths = Module._nodeModulePaths(path.dirname(arquivo));
  cache.set(arquivo, mod);
  const resolver = mod.require.bind(mod);
  mod.require = nome => nome.startsWith('@/') ? carregarTs(path.join(root, 'src', `${nome.slice(2)}.ts`)) : resolver(nome);
  mod._compile(ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, arquivo);
  return mod.exports;
}

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const professorA = '11111111-1111-4111-8111-111111111111';
const professorB = '22222222-2222-4222-8222-222222222222';
const inativo = '33333333-3333-4333-8333-333333333333';
const alunoA = 'aaaa0001-0000-4000-8000-000000000001';
const alunoB = 'bbbb0001-0000-4000-8000-000000000001';
const hoje = carregarTs(path.join(root, 'src/lib/faturamento.ts')).dataEmSaoPaulo(new Date());
const banco = {
  gestao_professores: [
    { id: randomUUID(), auth_user_id: professorA, owner_id: A, nome: 'Professor A', ativo: true },
    { id: randomUUID(), auth_user_id: professorB, owner_id: B, nome: 'Professor B', ativo: true },
    { id: randomUUID(), auth_user_id: inativo, owner_id: A, nome: 'Inativo', ativo: false }
  ],
  alunos: [
    { id: alunoA, user_id: A, academia_id: A, nome: 'Aluno A', status: 'Ativo', plano_nome: 'Plano A', graduacao: 'Inicial', cpf: 'PRIVADO', valor_mensalidade: 999, status_pagamento: 'Atrasado' },
    { id: randomUUID(), user_id: null, academia_id: A, nome: 'Aluno legado A', status: 'Ativo', plano_nome: null, graduacao: null },
    { id: randomUUID(), user_id: A, academia_id: A, nome: 'Terceiro A', status: 'Inativo', plano_nome: null, graduacao: null },
    { id: alunoB, user_id: B, academia_id: B, nome: 'Aluno B', status: 'Ativo', plano_nome: null, graduacao: null }
  ],
  frequencias: [
    { id: randomUUID(), user_id: A, aluno_id: alunoA, data: hoje },
    { id: randomUUID(), user_id: A, aluno_id: alunoA, data: '2020-01-01' },
    { id: randomUUID(), user_id: A, aluno_id: alunoA, data: '2020-01-02' },
    { id: randomUUID(), user_id: B, aluno_id: alunoB, data: hoje }
  ],
  gestao_configuracoes: [{ user_id: A, nome_academia: 'Academia A' }, { user_id: B, nome_academia: 'Academia B' }],
  gestao_registros: [
    { id: randomUUID(), user_id: A, tipo: 'exercicio', titulo: 'Exercício A', categoria: 'Grupo', detalhes: '', aluno_id: null, data_registro: hoje, criado_em: hoje, valor: 999 },
    { id: randomUUID(), user_id: B, tipo: 'exercicio', titulo: 'Exercício B', categoria: 'Grupo', detalhes: '', aluno_id: null, data_registro: hoje, criado_em: hoje },
    { id: randomUUID(), user_id: A, tipo: 'venda', titulo: 'VENDA PRIVADA', categoria: '', detalhes: '', aluno_id: alunoA, data_registro: hoje, criado_em: hoje, valor: 999 }
  ]
};
const chamadas = [];
let falharTabela = '';
const serviceKey = 'service-key-somente-teste';

function corresponde(linha, params) {
  for (const [campo, filtro] of params) {
    if (filtro.startsWith('eq.') && String(linha[campo]) !== filtro.slice(3)) return false;
  }
  const ou = params.get('or');
  if (ou && !ou.slice(1, -1).split(',').some(parte => {
    const [campo, operador, ...valor] = parte.split('.');
    return operador === 'eq' && String(linha[campo]) === valor.join('.');
  })) return false;
  return true;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const enviar = (status, dados, total) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    if (total !== undefined) res.setHeader('Content-Range', `0-1/${total}`);
    res.end(JSON.stringify(dados));
  };
  if (url.pathname === '/auth/v1/user') {
    const id = req.headers.authorization?.replace('Bearer ', '');
    if (!id || id === 'token-invalido') return enviar(401, { message: 'Token inválido' });
    // Metadado antigo aponta para B; a autorização precisa usar o vínculo real em A.
    return enviar(200, { id, aud: 'authenticated', email: 'teste@example.com', app_metadata: { fitgestao_owner_id: B } });
  }
  const tabela = url.pathname.split('/').pop();
  chamadas.push({ tabela, metodo: req.method, params: url.searchParams });
  if (req.headers.authorization !== `Bearer ${serviceKey}`) return enviar(401, { message: 'Consulta sem credencial de servidor' });
  if (!banco[tabela]) return enviar(404, { message: 'Tabela não permitida no teste' });
  if (tabela === falharTabela) return enviar(400, { message: 'Falha simulada na consulta' });
  const selecionados = banco[tabela].filter(linha => corresponde(linha, url.searchParams));
  if (req.method === 'GET') {
    const inicio = Number(url.searchParams.get('offset') || 0);
    // Simula um limite de resposta menor que a página pedida, para testar paginação real.
    const fim = inicio + Math.min(2, Number(url.searchParams.get('limit') || 2));
    const dados = selecionados.slice(inicio, fim);
    return enviar(200, req.headers.accept?.includes('vnd.pgrst.object') ? dados[0] : dados, selecionados.length);
  }
  let corpo = '';
  for await (const parte of req) corpo += parte;
  const dados = corpo ? JSON.parse(corpo) : null;
  if (req.method === 'POST') {
    const inseridos = (Array.isArray(dados) ? dados : [dados]).map(linha => ({ id: randomUUID(), ...linha }));
    banco[tabela].push(...inseridos);
    return enviar(201, inseridos);
  }
  if (req.method === 'PATCH') {
    selecionados.forEach(linha => Object.assign(linha, dados));
    return enviar(200, selecionados);
  }
  if (req.method === 'DELETE') {
    banco[tabela] = banco[tabela].filter(linha => !selecionados.includes(linha));
    return enviar(200, selecionados);
  }
  enviar(405, {});
});

async function principal() {
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${servidor.address().port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  const portal = carregarTs(path.join(root, 'src/app/api/professores/portal/route.ts'));
  const registros = carregarTs(path.join(root, 'src/app/api/professores/registros/route.ts'));
  async function chamar(rota, metodo = 'GET', token = professorA, corpo, query = '') {
    const resposta = await rota[metodo](new Request(`http://app.test/api/professores/teste${query}`, {
      method: metodo, headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) })
    }));
    return { status: resposta.status, dados: await resposta.json(), cache: resposta.headers.get('cache-control') };
  }
  assert.equal((await chamar(portal, 'GET', '')).status, 401);
  assert.equal((await chamar(portal, 'GET', 'token-invalido')).status, 401);
  console.log('✓ Autenticação obrigatória');

  const inicio = await chamar(portal, 'GET', professorA, undefined, `?owner_id=${B}`);
  assert.equal(inicio.status, 200);
  assert.equal(inicio.dados.academia.owner_id, A);
  assert.equal(inicio.dados.academia.nome, 'Academia A');
  assert.equal(inicio.dados.alunos.length, 3);
  const aluno = inicio.dados.alunos.find(a => a.id === alunoA);
  assert.equal(aluno.total_presencas, 3);
  assert.equal(aluno.presencas_mes, 1);
  assert.equal(aluno.ultima_presenca, hoje);
  assert(!JSON.stringify(inicio.dados).match(/PRIVADO|valor_mensalidade|status_pagamento|cpf/));
  assert.equal(inicio.cache, 'private, no-store');
  const outro = await chamar(portal, 'GET', professorB);
  assert.equal(outro.dados.alunos.length, 1);
  assert.equal(outro.dados.alunos[0].id, alunoB);
  console.log('✓ Academia compartilhada, metadados antigos ignorados e paginação completa');
  console.log('✓ Isolamento entre academias e ausência de campos financeiros');

  assert.equal((await chamar(portal, 'GET', inativo)).status, 403);
  assert.equal((await chamar(portal, 'GET', randomUUID())).status, 403);
  assert.equal((await chamar(registros, 'GET', inativo, undefined, '?tipo=exercicio')).status, 403);
  console.log('✓ Conta desativada ou sem vínculo não recebe registros');

  const proibido = await chamar(registros, 'GET', professorA, undefined, '?tipo=venda');
  assert.equal(proibido.status, 403);
  const biblioteca = await chamar(registros, 'GET', professorA, undefined, `?tipo=exercicio&owner_id=${B}`);
  assert.equal(biblioteca.dados.data.length, 1);
  assert.equal(biblioteca.dados.data[0].titulo, 'Exercício A');
  assert.equal(biblioteca.dados.data[0].valor, null);
  assert(!JSON.stringify(biblioteca.dados).includes('VENDA PRIVADA'));
  console.log('✓ Biblioteca da academia correta e vendas bloqueadas');

  const qtdPresencas = banco.frequencias.length;
  assert.equal((await chamar(portal, 'POST', professorA, { aluno_id: alunoB, data: '2020-01-03', owner_id: B })).status, 404);
  assert.equal(banco.frequencias.length, qtdPresencas);
  assert.equal((await chamar(portal, 'POST', professorA, { aluno_id: alunoA, data: '2020-01-03', user_id: B })).status, 201);
  assert.equal(banco.frequencias.at(-1).user_id, A);
  assert.equal((await chamar(portal, 'POST', professorA, { aluno_id: alunoA, data: '2020-01-03' })).status, 409);
  assert.equal((await chamar(portal, 'POST', professorA, { aluno_id: alunoA, data: '2026-02-31' })).status, 400);
  assert.equal((await chamar(portal)).dados.alunos.find(a => a.id === alunoA).total_presencas, 4);
  console.log('✓ Presenças gravadas na academia, com bloqueio de aluno externo e duplicata');

  const exercicio = { tipo: 'exercicio', titulo: 'Criado pelo professor', categoria: '', detalhes: '', data_registro: hoje, user_id: B };
  const criado = await chamar(registros, 'POST', professorA, { registros: [exercicio] });
  assert.equal(criado.status, 201);
  const id = criado.dados.data[0].id;
  assert.equal(banco.gestao_registros.find(r => r.id === id).user_id, A);
  assert.equal((await chamar(registros, 'PATCH', professorB, { ...exercicio, id })).status, 404);
  assert.equal((await chamar(registros, 'DELETE', professorB, undefined, `?tipo=exercicio&id=${id}`)).status, 404);
  assert.equal((await chamar(registros, 'PATCH', professorA, { ...exercicio, titulo: 'Atualizado', id })).status, 200);
  assert.equal((await chamar(registros, 'POST', professorA, { ...exercicio, valor: 100 })).status, 403);
  const ficha = [{ exercicioId: id, nome: 'Exercício', grupo: '', series: 3, repeticoes: '12', descanso: 60, observacoes: '' }];
  assert.equal((await chamar(registros, 'POST', professorA, { tipo: 'treino', titulo: 'Treino', aluno_id: alunoB, ficha })).status, 404);
  assert.equal((await chamar(registros, 'POST', professorA, { tipo: 'treino', titulo: 'Treino', aluno_id: alunoA, ficha })).status, 201);
  assert.equal((await chamar(registros, 'DELETE', professorA, undefined, `?tipo=exercicio&id=${id}`)).status, 200);
  console.log('✓ Criação, edição e exclusão compartilhadas, sem permitir alterar outra academia');

  falharTabela = 'alunos';
  assert.equal((await chamar(portal)).status, 502);
  falharTabela = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  assert.equal((await chamar(portal)).status, 503);
  assert(chamadas.every(c => !['pagamentos', 'gestao_vendas', 'gestao_cobrancas'].includes(c.tabela)));
  console.log('✓ Falhas de conexão/configuração geram erro, sem apresentar totais zerados');
  console.log('Todos os cenários passaram.');
}

principal().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => servidor.close());
