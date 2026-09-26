import { resumoCompartilhavel, type PlanoAlimentar } from './plano-alimentar';

const enc = new TextEncoder();
const ascii = (valor: string) => enc.encode(valor);

export function montarPdfImagens(imagens: Uint8Array[], largura = 1190, altura = 1684): Uint8Array {
  if (!imagens.length) throw new Error('O documento precisa ter pelo menos uma página.');
  const partes: Uint8Array[] = [];
  const offsets = [0];
  let posicao = 0;
  const escrever = (dados: Uint8Array | string) => {
    const bloco = typeof dados === 'string' ? ascii(dados) : dados;
    partes.push(bloco);
    posicao += bloco.length;
  };
  const objeto = (id: number, conteudo: () => void) => {
    offsets[id] = posicao;
    escrever(`${id} 0 obj\n`);
    conteudo();
    escrever('\nendobj\n');
  };
  escrever(ascii('%PDF-1.4\n'));
  escrever(new Uint8Array([37, 226, 227, 207, 211, 10]));
  objeto(1, () => escrever('<< /Type /Catalog /Pages 2 0 R >>'));
  objeto(2, () => escrever(`<< /Type /Pages /Count ${imagens.length} /Kids [${imagens.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
  imagens.forEach((imagem, indice) => {
    const pagina = 3 + indice * 3;
    const figura = pagina + 1;
    const conteudo = pagina + 2;
    objeto(pagina, () => escrever(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Pg ${figura} 0 R >> >> /Contents ${conteudo} 0 R >>`));
    objeto(figura, () => {
      escrever(`<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagem.length} >>\nstream\n`);
      escrever(imagem);
      escrever('\nendstream');
    });
    const comandos = 'q\n595 0 0 842 0 0 cm\n/Pg Do\nQ\n';
    objeto(conteudo, () => escrever(`<< /Length ${ascii(comandos).length} >>\nstream\n${comandos}endstream`));
  });
  const xref = posicao;
  escrever(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) escrever(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  escrever(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const resultado = new Uint8Array(posicao);
  let cursor = 0;
  for (const parte of partes) { resultado.set(parte, cursor); cursor += parte.length; }
  return resultado;
}

const dataBrasil = (data: string) => data ? data.split('-').reverse().join('/') : '';

export function gerarPdfPlano(plano: PlanoAlimentar, aluno: string, academia: string): Uint8Array {
  const dados = resumoCompartilhavel(plano, aluno);
  const paginas: HTMLCanvasElement[] = [];
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let y = 0;
  const largura = 595;
  const criarPagina = () => {
    canvas = document.createElement('canvas');
    canvas.width = 1190;
    canvas.height = 1684;
    ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, largura, 842);
    ctx.fillStyle = '#191d2d'; ctx.fillRect(0, 0, largura, 103);
    ctx.fillStyle = '#7c72ff'; ctx.fillRect(0, 100, largura, 3);
    ctx.fillStyle = '#e7e6ff'; ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(academia.slice(0, 60), 42, 30, 510);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 23px Arial, sans-serif';
    ctx.fillText('MATERIAL ALIMENTAR DIDÁTICO', 42, 67, 510);
    y = 128;
    paginas.push(canvas);
  };
  const caber = (altura: number) => {
    if (y + altura > 783) {
      const fonte = ctx.font;
      const cor = ctx.fillStyle;
      criarPagina();
      ctx.font = fonte;
      ctx.fillStyle = cor;
    }
  };
  const texto = (valor: string, opcoes: { tamanho?: number; cor?: string; peso?: string; recuo?: number } = {}) => {
    const tamanho = opcoes.tamanho ?? 10;
    const recuo = opcoes.recuo ?? 0;
    ctx.font = `${opcoes.peso ?? 'normal'} ${tamanho}px Arial, sans-serif`;
    ctx.fillStyle = opcoes.cor ?? '#263043';
    const maximo = 510 - recuo;
    for (const paragrafo of (valor || '').replace(/\r/g, '').split('\n')) {
      let linha = '';
      for (const palavraOriginal of paragrafo.split(/\s+/)) {
        let palavra = palavraOriginal;
        while (palavra && ctx.measureText(palavra).width > maximo) {
          let corte = palavra.length - 1;
          while (corte > 1 && ctx.measureText(palavra.slice(0, corte)).width > maximo) corte--;
          if (linha) { caber(tamanho + 5); ctx.fillText(linha, 42 + recuo, y); y += tamanho + 5; linha = ''; }
          caber(tamanho + 5); ctx.fillText(palavra.slice(0, corte), 42 + recuo, y); y += tamanho + 5;
          palavra = palavra.slice(corte);
        }
        const proxima = linha ? `${linha} ${palavra}` : palavra;
        if (ctx.measureText(proxima).width > maximo && linha) {
          caber(tamanho + 5); ctx.fillText(linha, 42 + recuo, y); y += tamanho + 5;
          linha = palavra;
        } else linha = proxima;
      }
      caber(tamanho + 5);
      if (linha) ctx.fillText(linha, 42 + recuo, y);
      y += tamanho + 5;
    }
  };
  const secao = (rotulo: string) => {
    caber(48);
    y += 12;
    ctx.fillStyle = '#f0efff'; ctx.fillRect(42, y - 13, 511, 25);
    ctx.fillStyle = '#333076'; ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillText(rotulo.toUpperCase(), 51, y + 4);
    y += 29;
  };
  const campo = (rotulo: string, valor: string) => { if (valor.trim()) texto(`${rotulo}: ${valor}`); };

  criarPagina();
  secao('Identificação');
  campo('Aluno(a)', dados.aluno);
  campo('Emissão', dataBrasil(dados.emissao));
  campo('Validade', dataBrasil(dados.validade));
  campo('Objetivo', dados.objetivo);
  const metas = [
    dados.metas.energia && `Energia: ${dados.metas.energia} kcal/dia`,
    dados.metas.proteinas && `Proteínas: ${dados.metas.proteinas} g/dia`,
    dados.metas.carboidratos && `Carboidratos: ${dados.metas.carboidratos} g/dia`,
    dados.metas.gorduras && `Gorduras: ${dados.metas.gorduras} g/dia`,
    dados.metas.fibras && `Fibras: ${dados.metas.fibras} g/dia`,
    dados.metas.agua && `Água: ${dados.metas.agua} mL/dia`
  ].filter(Boolean).join('  |  ');
  if (metas) { secao('Valores ilustrativos informados'); texto(metas); }
  secao('Refeições e alimentos');
  for (const refeicao of dados.refeicoes) {
    caber(65);
    texto(`${refeicao.nome}${refeicao.horario ? `  ·  ${refeicao.horario}` : ''}`, { tamanho: 12, peso: 'bold', cor: '#333076' });
    for (const alimento of refeicao.alimentos) {
      texto(`• ${alimento.nome}: ${alimento.quantidade} ${alimento.unidade}${alimento.preparo ? ` · ${alimento.preparo}` : ''}`, { recuo: 9 });
      if (alimento.substituicoes.trim()) texto(`Substituições: ${alimento.substituicoes}`, { recuo: 20, cor: '#566172', tamanho: 9 });
    }
    if (refeicao.observacoes.trim()) texto(`Observações: ${refeicao.observacoes}`, { recuo: 9, tamanho: 9, cor: '#566172' });
    y += 9;
  }
  if (dados.orientacoes.trim()) { secao('Orientações gerais'); texto(dados.orientacoes); }
  secao('Sobre este material');
  texto('Exemplo didático de organização de refeições. Não constitui prescrição alimentar individual.', { tamanho: 9, cor: '#566172' });

  return montarPdfImagens(paginas.map((pagina, indice) => {
    const contexto = pagina.getContext('2d')!;
    contexto.strokeStyle = '#d8dce5';
    contexto.beginPath(); contexto.moveTo(42, 804); contexto.lineTo(553, 804); contexto.stroke();
    contexto.fillStyle = '#647087'; contexto.font = '9px Arial, sans-serif';
    contexto.fillText(`${dados.aluno}  ·  ${dataBrasil(dados.emissao)}`, 42, 823, 430);
    contexto.fillText(`${indice + 1} / ${paginas.length}`, 522, 823);
    const base64 = pagina.toDataURL('image/jpeg', 0.88).split(',')[1];
    const binario = atob(base64);
    return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  }));
}
