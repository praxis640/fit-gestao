import { montarPdfImagens } from './plano-pdf';

export type IndicadorRelatorio = { titulo: string; valor: string; detalhe?: string; cor?: string };
export type BarraRelatorio = { rotulo: string; valor: number; texto?: string; cor?: string };
export type SecaoRelatorio = { titulo: string; linhas: string[]; barras?: BarraRelatorio[] };
export type DadosRelatorioAcademia = {
  academia: string;
  periodo: string;
  emitidoEm: string;
  indicadores: IndicadorRelatorio[];
  secoes: SecaoRelatorio[];
};

const LARGURA = 595;
const ALTURA = 842;
const escala = 2;
const margem = 42;
const larguraConteudo = LARGURA - margem * 2;
const azulEscuro = '#171b2a';
const roxo = '#635bfc';
const texto = '#273044';
const cinza = '#657087';

export function gerarPdfRelatorioAcademia(dados: DadosRelatorioAcademia): Uint8Array {
  const paginas: HTMLCanvasElement[] = [];
  let canvas: HTMLCanvasElement;
  let ctx!: CanvasRenderingContext2D;
  let y = 0;
  let numeroPagina = 0;

  const novaPagina = () => {
    numeroPagina += 1;
    canvas = document.createElement('canvas');
    canvas.width = LARGURA * escala;
    canvas.height = ALTURA * escala;
    ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.scale(escala, escala);
    ctx.fillStyle = '#f6f7fb';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.fillStyle = azulEscuro;
    ctx.fillRect(0, 0, LARGURA, 116);
    ctx.fillStyle = roxo;
    ctx.fillRect(0, 112, LARGURA, 4);
    ctx.fillStyle = '#bfc5ff';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.fillText('FITGESTÃO  ·  RELATÓRIO DE GESTÃO', margem, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText(numeroPagina === 1 ? 'Panorama da academia' : 'Relatório da academia', margem, 60, larguraConteudo);
    ctx.fillStyle = '#d1d5e3';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(dados.academia.slice(0, 75), margem, 82, larguraConteudo);
    ctx.fillText(`Período: ${dados.periodo}  ·  Emitido em ${dados.emitidoEm}`, margem, 101, larguraConteudo);
    y = 142;
    paginas.push(canvas);
  };

  const caber = (altura: number) => {
    if (y + altura > 785) novaPagina();
  };

  const linhaTexto = (valor: string, opcoes: { tamanho?: number; peso?: string; cor?: string; recuo?: number; entrelinha?: number } = {}) => {
    const tamanho = opcoes.tamanho ?? 9;
    const recuo = opcoes.recuo ?? 0;
    const entrelinha = opcoes.entrelinha ?? tamanho + 5;
    ctx.font = `${opcoes.peso ?? 'normal'} ${tamanho}px Arial, sans-serif`;
    ctx.fillStyle = opcoes.cor ?? texto;
    const maximo = larguraConteudo - recuo;
    let linha = '';
    const palavras = (valor || '').split(/\s+/).filter(Boolean);
    for (const palavra of palavras) {
      const candidata = linha ? `${linha} ${palavra}` : palavra;
      if (ctx.measureText(candidata).width > maximo && linha) {
        caber(entrelinha);
        ctx.fillText(linha, margem + recuo, y, maximo);
        y += entrelinha;
        linha = palavra;
      } else linha = candidata;
    }
    if (linha) {
      caber(entrelinha);
      ctx.fillText(linha, margem + recuo, y, maximo);
      y += entrelinha;
    }
  };

  const secao = (titulo: string) => {
    caber(42);
    y += 5;
    ctx.fillStyle = '#e9e8ff';
    ctx.fillRect(margem, y - 12, larguraConteudo, 25);
    ctx.fillStyle = '#343077';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText(titulo.toLocaleUpperCase('pt-BR'), margem + 9, y + 4, larguraConteudo - 18);
    y += 25;
  };

  novaPagina();
  linhaTexto('Visão executiva', { tamanho: 13, peso: 'bold', cor: azulEscuro, entrelinha: 18 });
  linhaTexto('Indicadores consolidados a partir dos registros disponíveis no FitGestão.', { tamanho: 9, cor: cinza });
  y += 7;

  const cards = dados.indicadores.slice(0, 4);
  const gap = 8;
  const cardW = (larguraConteudo - gap * (cards.length - 1)) / Math.max(1, cards.length);
  const cardH = 71;
  caber(cardH + 12);
  cards.forEach((item, indice) => {
    const x = margem + indice * (cardW + gap);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.fillStyle = item.cor || roxo;
    ctx.fillRect(x, y, 3, cardH);
    ctx.fillStyle = cinza;
    ctx.font = 'bold 7px Arial, sans-serif';
    ctx.fillText(item.titulo.toLocaleUpperCase('pt-BR'), x + 9, y + 15, cardW - 15);
    ctx.fillStyle = texto;
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText(item.valor, x + 9, y + 38, cardW - 15);
    if (item.detalhe) {
      ctx.fillStyle = cinza;
      ctx.font = '7px Arial, sans-serif';
      ctx.fillText(item.detalhe, x + 9, y + 56, cardW - 15);
    }
  });
  y += cardH + 12;

  for (const secaoDados of dados.secoes) {
    secao(secaoDados.titulo);
    if (secaoDados.linhas.length === 0 && !secaoDados.barras?.length) {
      linhaTexto('Não há registros para este período.', { cor: cinza, recuo: 4 });
    }
    for (const linha of secaoDados.linhas) linhaTexto(`•  ${linha}`, { recuo: 3 });
    if (secaoDados.barras?.length) {
      const maior = Math.max(1, ...secaoDados.barras.map((barra) => barra.valor));
      for (const barra of secaoDados.barras.slice(0, 7)) {
        caber(32);
        ctx.fillStyle = texto;
        ctx.font = '8px Arial, sans-serif';
        ctx.fillText(barra.rotulo, margem + 3, y + 8, 205);
        ctx.textAlign = 'right';
        ctx.fillStyle = cinza;
        ctx.fillText(barra.texto || String(barra.valor), margem + larguraConteudo, y + 8);
        ctx.textAlign = 'left';
        const barX = margem + 215;
        const barW = larguraConteudo - 285;
        ctx.fillStyle = '#e7e9f0';
        ctx.fillRect(barX, y, barW, 8);
        ctx.fillStyle = barra.cor || roxo;
        ctx.fillRect(barX, y, Math.max(barra.valor ? 2 : 0, barW * barra.valor / maior), 8);
        y += 17;
      }
    }
    y += 5;
  }

  dados.secoes.forEach(() => undefined);
  const imagens = paginas.map((pagina, indice) => {
    const contexto = pagina.getContext('2d')!;
    contexto.strokeStyle = '#d9dce6';
    contexto.beginPath();
    contexto.moveTo(margem, 806);
    contexto.lineTo(LARGURA - margem, 806);
    contexto.stroke();
    contexto.fillStyle = cinza;
    contexto.font = '8px Arial, sans-serif';
    contexto.fillText('Documento gerado pelo FitGestão · Baseado nos dados cadastrados pela academia', margem, 822, larguraConteudo - 50);
    contexto.textAlign = 'right';
    contexto.fillText(`${indice + 1} / ${paginas.length}`, LARGURA - margem, 822);
    contexto.textAlign = 'left';
    const base64 = pagina.toDataURL('image/jpeg', 0.9).split(',')[1];
    const binario = atob(base64);
    return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  });
  return montarPdfImagens(imagens, LARGURA * escala, ALTURA * escala);
}
