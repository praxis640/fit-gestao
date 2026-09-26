export function digitosTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  return (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)
    ? digitos.slice(2) : digitos).slice(0, 11);
}

export function formatarTelefone(telefone: string): string {
  const digitos = digitosTelefone(telefone);
  if (!digitos) return '';
  if (digitos.length < 3) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const tamanhoPrefixo = digitos.length === 11 ? 5 : 4;
  if (numero.length <= tamanhoPrefixo) return `(${ddd})${numero}`;
  return `(${ddd})${numero.slice(0, tamanhoPrefixo)}-${numero.slice(tamanhoPrefixo)}`;
}

export function telefoneValido(telefone: string): boolean {
  const digitos = digitosTelefone(telefone);
  return digitos.length >= 10 && Number(digitos.slice(0, 2)) >= 11 &&
    !/^0+$/.test(digitos.slice(2));
}

export function dataNascimentoValida(data: string, hoje: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hoje) return false;
  const [ano, mes, dia] = data.split('-').map(Number);
  const conferida = new Date(Date.UTC(ano, mes - 1, dia));
  return ano >= 1900 && conferida.toISOString().slice(0, 10) === data;
}

export function calcularIdade(nascimento: string | null | undefined, hoje: string): number | null {
  if (!nascimento || !dataNascimentoValida(nascimento, hoje)) return null;
  const [ano, mes, dia] = nascimento.split('-').map(Number);
  const [anoAtual, mesAtual, diaAtual] = hoje.split('-').map(Number);
  return anoAtual - ano - (mesAtual < mes || (mesAtual === mes && diaAtual < dia) ? 1 : 0);
}

export function formatarDataBrasil(data: string | null | undefined): string {
  if (!data || !/^\d{4}-\d{2}-\d{2}/.test(data)) return 'Não informado';
  return data.slice(0, 10).split('-').reverse().join('/');
}

export function csvSeguro(valor: string | number | null | undefined): string {
  const texto = String(valor ?? '');
  const seguro = /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}
