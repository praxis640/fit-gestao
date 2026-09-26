export type ItemFicha = {
  exercicioId: string;
  nome: string;
  grupo: string;
  series: number;
  repeticoes: string;
  descanso: number;
  observacoes: string;
};

// A ficha registra uma cópia do nome e grupo; excluir um item da biblioteca não apaga fichas antigas.
export function lerFicha(valor: unknown): ItemFicha[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is ItemFicha =>
    typeof item === 'object' && item !== null &&
    typeof item.nome === 'string' && typeof item.grupo === 'string' &&
    typeof item.exercicioId === 'string' &&
    Number.isInteger(item.series) && item.series >= 1 && item.series <= 50 &&
    typeof item.repeticoes === 'string' && typeof item.descanso === 'number' &&
    typeof item.observacoes === 'string'
  );
}

export function textoDaFicha(titulo: string, aluno: string, objetivo: string, observacoes: string, itens: ItemFicha[]): string {
  return [
    `FICHA DE TREINO — ${titulo}`,
    `Aluno(a): ${aluno}`,
    objetivo ? `Objetivo: ${objetivo}` : '',
    '',
    ...itens.flatMap((item, indice) => [
      `${indice + 1}. ${item.nome}${item.grupo ? ` (${item.grupo})` : ''}`,
      `   Séries: ${item.series} · Repetições/tempo: ${item.repeticoes} · Descanso: ${item.descanso}s`,
      item.observacoes ? `   Observações: ${item.observacoes}` : ''
    ]),
    observacoes ? `\nObservações gerais: ${observacoes}` : ''
  ].filter((linha) => linha !== '').join('\n');
}
