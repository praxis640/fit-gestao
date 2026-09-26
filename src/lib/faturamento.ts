export type AlunoParaCobranca = {
  id?: string | number;
  dia_vencimento?: number;
  criado_em?: string;
  fim_plano?: string | null;
  status_pagamento?: 'Em Dia' | 'Pendente' | 'Atrasado';
};

export function dataEmSaoPaulo(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(data);
  const obter = (tipo: string) => partes.find(parte => parte.type === tipo)?.value || '';
  return `${obter('year')}-${obter('month')}-${obter('day')}`;
}

export function adicionarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function diasAteVencimento(vencimento: string, hoje: string): number {
  const [ano, mes, dia] = vencimento.slice(0, 10).split('-').map(Number);
  const [anoAtual, mesAtual, diaAtual] = hoje.split('-').map(Number);
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(anoAtual, mesAtual - 1, diaAtual)) / 86_400_000);
}

export function vencimentoPlano(
  aluno: { fim_plano?: string | null; criado_em?: string; plano_nome?: string },
  planos: { nome: string; duracao_dias: number }[],
  hoje: string
): string {
  if (aluno.fim_plano) return aluno.fim_plano.slice(0, 10);
  const dataCadastro = aluno.criado_em ? dataEmSaoPaulo(new Date(aluno.criado_em)) : hoje;
  const duracao = planos.find(plano => plano.nome === aluno.plano_nome)?.duracao_dias || 30;
  return adicionarDias(dataCadastro, duracao);
}

export function situacaoPagamento(
  aluno: AlunoParaCobranca,
  pagosNoMes: Set<string>,
  hoje: string
): 'Em Dia' | 'Pendente' | 'Atrasado' {
  if (aluno.id != null && pagosNoMes.has(String(aluno.id))) return 'Em Dia';
  // A baixa também atualiza o status do aluno. Use-o como respaldo enquanto
  // o plano estiver vigente, mesmo se o histórico mensal demorar a carregar.
  if (aluno.status_pagamento === 'Em Dia' && aluno.fim_plano && aluno.fim_plano.slice(0, 10) >= hoje) {
    return 'Em Dia';
  }
  // A mensalidade não fica atrasada retroativamente quando alguém adere
  // depois do dia de cobrança escolhido para o mês do cadastro.
  if (aluno.criado_em) {
    const cadastro = dataEmSaoPaulo(new Date(aluno.criado_em));
    const fim = aluno.fim_plano?.slice(0, 10) || adicionarDias(cadastro, 30);
    if (cadastro.slice(0, 7) === hoje.slice(0, 7) && fim >= hoje) return 'Pendente';
  }
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const vencimento = Math.min(Math.max(Number(aluno.dia_vencimento) || 10, 1), ultimoDia);
  return dia > vencimento ? 'Atrasado' : 'Pendente';
}
