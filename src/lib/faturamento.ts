export type AlunoParaCobranca = {
  id?: string | number;
  dia_vencimento?: number;
  criado_em?: string;
  fim_plano?: string | null;
  proximo_vencimento?: string | null;
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

function dataVencimentoNoMes(ano: number, mes: number, dia: number): string {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(Math.max(dia, 1), ultimoDia)).padStart(2, '0')}`;
}

export function proximoVencimentoDoDia(diaVencimento: number, hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number);
  const diaDoMes = Math.min(Math.max(Number(diaVencimento) || 10, 1), 31);
  const desteMes = dataVencimentoNoMes(ano, mes, diaDoMes);
  if (desteMes >= hoje) return desteMes;
  const proximoMes = new Date(Date.UTC(ano, mes, 1));
  return dataVencimentoNoMes(proximoMes.getUTCFullYear(), proximoMes.getUTCMonth() + 1, diaDoMes);
}

export function vencimentoPagamento(aluno: AlunoParaCobranca, hoje: string): string {
  if (aluno.proximo_vencimento) return aluno.proximo_vencimento.slice(0, 10);

  const [ano, mes] = hoje.split('-').map(Number);
  const dia = Math.min(Math.max(Number(aluno.dia_vencimento) || 10, 1), 31);
  let vencimento = dataVencimentoNoMes(ano, mes, dia);

  // A matrícula feita depois do vencimento deste mês começa a cobrar no próximo ciclo.
  if (aluno.criado_em) {
    const cadastro = dataEmSaoPaulo(new Date(aluno.criado_em));
    if (cadastro.slice(0, 7) === hoje.slice(0, 7) && cadastro > vencimento) {
      vencimento = proximoVencimentoDoDia(dia, adicionarDias(vencimento, 1));
    }
  }
  return vencimento;
}

export function dataISOValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === data;
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
  const vencimento = vencimentoPagamento(aluno, hoje);
  if (vencimento < hoje) return 'Atrasado';
  if (vencimento === hoje) return 'Pendente';
  return 'Em Dia';
}
