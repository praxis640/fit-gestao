export type AcademiaSaas = {
  user_id: string; email: string; nome: string; responsavel: string; telefone: string;
  plano: string; valor: number; status: 'teste' | 'ativa' | 'pausada' | 'cancelada';
  vencimento: string | null; observacoes: string; alunos: number; alunos_ativos: number;
  cadastrado_em: string; ultimo_login: string | null;
};
export type PagamentoSaas = { id: string; user_id: string; competencia: string; valor: number; pago_em: string; forma: string; observacoes: string };
export const dinheiroSaas = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const hojeSaas = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function situacaoSaas(a: AcademiaSaas, hoje: string) {
  if (a.status === 'cancelada') return 'Cancelada';
  if (a.status === 'pausada') return 'Pausada';
  if (a.vencimento && a.vencimento < hoje) return a.status === 'teste' ? 'Teste encerrado' : 'Em atraso';
  if (a.status === 'teste') return 'Em teste';
  return a.vencimento ? 'Em dia' : 'Sem vencimento';
}
export function proximoMesSaas(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo))).toISOString().slice(0, 10);
}
export function metricasSaas(academias: AcademiaSaas[], pagamentos: PagamentoSaas[], hoje: string) {
  const ativas = academias.filter(a => a.status === 'ativa');
  return {
    ativas: ativas.length, testes: academias.filter(a => a.status === 'teste').length,
    atrasadas: ativas.filter(a => situacaoSaas(a, hoje) === 'Em atraso').length,
    recorrente: ativas.reduce((s, a) => s + Number(a.valor), 0),
    recebido: pagamentos.filter(p => p.pago_em.slice(0,7) === hoje.slice(0,7)).reduce((s,p) => s + Number(p.valor),0),
    alunos: academias.reduce((s,a) => s + Number(a.alunos),0),
  };
}
