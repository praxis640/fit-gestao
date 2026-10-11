export const MODELO_CONTRATO_ADULTO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPORTIVOS

CONTRATADA: {{ACADEMIA}}, CNPJ/CPF {{CNPJ_ACADEMIA}}, com endereço em {{ENDERECO_ACADEMIA}}.

ALUNO(A) / CONTRATANTE: {{ALUNO}}, {{IDADE}}, nascido(a) em {{NASCIMENTO}}, CPF {{CPF_ALUNO}}, telefone {{TELEFONE_ALUNO}}, residente em {{ENDERECO_ALUNO}}.

1. OBJETO. A CONTRATADA prestará ao(à) aluno(a) serviços de atividade física e aulas correspondentes ao plano informado, em suas instalações e conforme horários, regras de segurança e orientações dos profissionais responsáveis.

2. PLANO E PAGAMENTO. Plano: {{PLANO}}; mensalidade: {{MENSALIDADE}}; vencimento mensal: dia {{DIA_VENCIMENTO}}. Validade do plano cadastrada até {{FIM_PLANO}}. Regras adicionais de cobrança, renovação ou cancelamento devem ser informadas e aceitas pelas partes por escrito.

3. DEVERES DAS PARTES. O(A) aluno(a) deverá respeitar as orientações da equipe, as regras internas e os demais participantes, utilizando vestimenta e equipamentos adequados. A CONTRATADA deverá informar as regras de funcionamento e adotar os cuidados de segurança aplicáveis às atividades oferecidas.

4. DISPOSIÇÕES GERAIS. As partes declaram que puderam ler as condições, esclarecer dúvidas e receber uma via deste instrumento. Alterações de plano ou condições devem ser registradas pelas partes.

{{CIDADE}}, {{DATA}}.

____________________________________
{{ACADEMIA}} — CONTRATADA

{{ASSINATURA_ALUNO}}

____________________________________
Testemunha (opcional)`;

export const MODELO_CONTRATO_MENOR = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPORTIVOS — ALUNO MENOR DE IDADE

CONTRATADA: {{ACADEMIA}}, CNPJ/CPF {{CNPJ_ACADEMIA}}, com endereço em {{ENDERECO_ACADEMIA}}.

ALUNO(A): {{ALUNO}}, {{IDADE}}, nascido(a) em {{NASCIMENTO}}, CPF {{CPF_ALUNO}}, telefone {{TELEFONE_ALUNO}}, residente em {{ENDERECO_ALUNO}}.

RESPONSÁVEL LEGAL: {{RESPONSAVEL}}, CPF {{CPF_RESPONSAVEL}}, telefone {{TELEFONE_RESPONSAVEL}}, vínculo: {{PARENTESCO}}, que participa como {{PAPEL_RESPONSAVEL}}.

1. OBJETO. A CONTRATADA prestará ao(à) aluno(a) serviços de atividade física e aulas correspondentes ao plano informado, em suas instalações e conforme horários, regras de segurança e orientações dos profissionais responsáveis.

2. PLANO E PAGAMENTO. Plano: {{PLANO}}; mensalidade: {{MENSALIDADE}}; vencimento mensal: dia {{DIA_VENCIMENTO}}. Validade do plano cadastrada até {{FIM_PLANO}}. Regras adicionais de cobrança, renovação ou cancelamento devem ser informadas e aceitas pelas partes por escrito.

3. DEVERES DAS PARTES. O(A) aluno(a) deverá respeitar as orientações da equipe, as regras internas e os demais participantes, utilizando vestimenta e equipamentos adequados. A CONTRATADA deverá informar as regras de funcionamento e adotar os cuidados de segurança aplicáveis às atividades oferecidas.

4. AUTORIZAÇÃO DO RESPONSÁVEL. O(A) responsável identificado(a) declara possuir poderes para representar ou assistir o(a) aluno(a), autoriza sua matrícula e participação nas atividades descritas neste contrato e compromete-se a manter atualizados seus contatos e as informações necessárias à segurança do(a) aluno(a). Esta autorização não representa renúncia a direitos nem afasta deveres legais de qualquer das partes. {{TEXTO_ASSISTENCIA}}

5. DISPOSIÇÕES GERAIS. As partes declaram que puderam ler as condições, esclarecer dúvidas e receber uma via deste instrumento. Alterações de plano ou condições devem ser registradas pelas partes.

{{CIDADE}}, {{DATA}}.

____________________________________
{{ACADEMIA}} — CONTRATADA

{{ASSINATURA_ALUNO}}

{{ASSINATURA_RESPONSAVEL}}

____________________________________
Testemunha (opcional)`;

/** Alias mantido para compatibilidade com telas/versões anteriores. */
export const MODELO_CONTRATO_PADRAO = MODELO_CONTRATO_ADULTO;

export function preencherModeloContrato(modelo: string, campos: Record<string, string>) {
  return Object.entries(campos).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{{${chave}}}`, valor),
    modelo
  ).replace(/^\s*\n/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}
