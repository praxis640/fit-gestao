export type AlimentoPlano = {
  id: string;
  nome: string;
  quantidade: string;
  unidade: string;
  preparo: string;
  substituicoes: string;
};

export type RefeicaoPlano = {
  id: string;
  nome: string;
  horario: string;
  alimentos: AlimentoPlano[];
  observacoes: string;
};

export type PlanoAlimentar = {
  versao: 1;
  dataEmissao: string;
  validade: string;
  objetivo: string;
  avaliacao: {
    peso: string; altura: string; cintura: string; composicao: string;
    atividade: string; historico: string; alergias: string;
    restricoes: string; preferencias: string; medicamentos: string;
    exames: string; recordatorio: string; rotina: string; sintomas: string;
  };
  metas: { energia: string; proteinas: string; carboidratos: string; gorduras: string; fibras: string; agua: string };
  refeicoes: RefeicaoPlano[];
  orientacoes: string;
  observacoesInternas: string;
};

export function novoPlano(data: string): PlanoAlimentar {
  return {
    versao: 1, dataEmissao: data, validade: '', objetivo: '',
    avaliacao: { peso: '', altura: '', cintura: '', composicao: '', atividade: '', historico: '', alergias: '', restricoes: '', preferencias: '', medicamentos: '', exames: '', recordatorio: '', rotina: '', sintomas: '' },
    metas: { energia: '', proteinas: '', carboidratos: '', gorduras: '', fibras: '', agua: '' },
    refeicoes: [], orientacoes: '', observacoesInternas: ''
  };
}

export function criarRefeicao(): RefeicaoPlano {
  return { id: crypto.randomUUID(), nome: '', horario: '', alimentos: [], observacoes: '' };
}

export function criarAlimento(): AlimentoPlano {
  return { id: crypto.randomUUID(), nome: '', quantidade: '', unidade: 'g', preparo: '', substituicoes: '' };
}

export function lerPlano(valor: unknown): PlanoAlimentar | null {
  if (!valor || typeof valor !== 'object') return null;
  const plano = valor as Partial<PlanoAlimentar>;
  if (plano.versao !== 1 || !Array.isArray(plano.refeicoes) ||
    !plano.avaliacao || !plano.metas) return null;
  return plano as PlanoAlimentar;
}

export function validarPlano(plano: PlanoAlimentar): string | null {
  if (!plano.dataEmissao) return 'Informe a data de emissão.';
  if (plano.validade && plano.validade < plano.dataEmissao) return 'A validade não pode anteceder a emissão.';
  if (plano.refeicoes.length < 1) return 'Adicione pelo menos uma refeição.';
  for (const [i, refeicao] of plano.refeicoes.entries()) {
    if (!refeicao.nome.trim()) return `Informe o nome da refeição ${i + 1}.`;
    if (!refeicao.alimentos.length) return `Inclua pelo menos um alimento em ${refeicao.nome}.`;
    for (const alimento of refeicao.alimentos) {
      if (!alimento.nome.trim() || !alimento.quantidade.trim() || !alimento.unidade.trim())
        return `Preencha alimento, quantidade e unidade em ${refeicao.nome}.`;
    }
  }
  return null;
}

// Informação clínica permanece no prontuário interno, nunca no documento compartilhável.
export function resumoCompartilhavel(plano: PlanoAlimentar, aluno: string) {
  return {
    aluno, emissao: plano.dataEmissao, validade: plano.validade,
    objetivo: plano.objetivo,
    metas: plano.metas, refeicoes: plano.refeicoes, orientacoes: plano.orientacoes
  };
}
