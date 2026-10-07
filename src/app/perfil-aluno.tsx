'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

import { calcularIdade, digitosTelefone, formatarDataBrasil, formatarTelefone, telefoneValido } from '@/lib/alunos';
import { adicionarDias, dataEmSaoPaulo, vencimentoPagamento } from '@/lib/faturamento';
import { MODELO_CONTRATO_ADULTO, MODELO_CONTRATO_MENOR, preencherModeloContrato } from '@/lib/contrato';

type Aluno = {
  id?: string | number;
  nome: string;
  telefone?: string;
  cpf?: string | null;
  endereco?: string | null;
  data_nascimento?: string | null;
  status: 'Ativo' | 'Inativo';
  graduacao?: string;
  plano_nome?: string;
  valor_mensalidade?: number;
  dia_vencimento?: number;
  criado_em?: string;
  fim_plano?: string | null;
  proximo_vencimento?: string | null;
  observacoes?: string | null;
  foto_storage_path?: string | null;
  contrato_responsavel_nome?: string | null;
  contrato_responsavel_cpf?: string | null;
  contrato_responsavel_telefone?: string | null;
  contrato_responsavel_parentesco?: string | null;
  contrato_texto?: string | null;
  contrato_personalizado?: boolean;
};

type Pagamento = { aluno_id: string; valor: number; competencia: string };
type Frequencia = { aluno_id: string | number; data: string };

const item: React.CSSProperties = { padding: '0.85rem', background: '#171a25', borderRadius: '8px', minWidth: 0 };
const campoContrato: React.CSSProperties = { width: '100%', padding: '0.65rem', color: '#fff', background: '#13151f', border: '1px solid #3a3f55', borderRadius: 6 };

export function PerfilAluno({ aluno, hoje, pagamentos, frequencias, situacao, diasRestantes, userId, academia, abaInicial = 'resumo', onAtualizar, onEditar, onFechar }: {
  aluno: Aluno;
  hoje: string;
  pagamentos: Pagamento[];
  frequencias: Frequencia[];
  situacao: 'Em Dia' | 'Pendente' | 'Atrasado';
  diasRestantes: string;
  userId: string;
  academia: string;
  abaInicial?: 'resumo' | 'sobre' | 'foto' | 'contrato';
  onAtualizar: () => void | Promise<void>;
  onEditar: () => void;
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<'resumo' | 'sobre' | 'foto' | 'contrato'>(abaInicial);
  const [observacoes, setObservacoes] = useState(aluno.observacoes || '');
  const [fotoUrl, setFotoUrl] = useState('');
  const [totalPresencas, setTotalPresencas] = useState(0);
  const [cpfAluno, setCpfAluno] = useState(aluno.cpf || '');
  const [enderecoAluno, setEnderecoAluno] = useState(aluno.endereco || '');
  const [responsavelNome, setResponsavelNome] = useState(aluno.contrato_responsavel_nome || '');
  const [responsavelCpf, setResponsavelCpf] = useState(aluno.contrato_responsavel_cpf || '');
  const [responsavelTelefone, setResponsavelTelefone] = useState(aluno.contrato_responsavel_telefone || '');
  const [responsavelParentesco, setResponsavelParentesco] = useState(aluno.contrato_responsavel_parentesco || '');
  const [cnpjAcademia, setCnpjAcademia] = useState('');
  const [enderecoAcademia, setEnderecoAcademia] = useState('');
  const [modeloContratoAdulto, setModeloContratoAdulto] = useState(MODELO_CONTRATO_ADULTO);
  const [modeloContratoMenor, setModeloContratoMenor] = useState(MODELO_CONTRATO_MENOR);
  const [textoContrato, setTextoContrato] = useState(aluno.contrato_texto || '');
  const [contratoPersonalizado, setContratoPersonalizado] = useState(aluno.contrato_personalizado === true);
  const [mensagemContrato, setMensagemContrato] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const idade = calcularIdade(aluno.data_nascimento, hoje);
  const id = String(aluno.id);
  const historico = pagamentos.filter((pagamento) => String(pagamento.aluno_id) === id)
    .sort((a, b) => b.competencia.localeCompare(a.competencia));
  const presencas = frequencias.filter((frequencia) => String(frequencia.aluno_id) === id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const inicio30Dias = adicionarDias(hoje, -29);
  const recentes = presencas.filter((frequencia) => frequencia.data >= inicio30Dias && frequencia.data <= hoje);
  const menorDeIdade = idade !== null && idade < 18;
  const modeloContratoSelecionado = menorDeIdade ? modeloContratoMenor : modeloContratoAdulto;
  const camposContrato: Record<string, string> = {
    ACADEMIA: academia || 'FitGestão',
    CNPJ_ACADEMIA: cnpjAcademia || '________________________________',
    ENDERECO_ACADEMIA: enderecoAcademia || '________________________________',
    ALUNO: aluno.nome,
    IDADE: idade === null ? 'idade não informada' : `${idade} anos`,
    NASCIMENTO: formatarDataBrasil(aluno.data_nascimento),
    CPF_ALUNO: cpfAluno || '________________________________',
    TELEFONE_ALUNO: aluno.telefone || '________________________________',
    ENDERECO_ALUNO: enderecoAluno || '________________________________',
    RESPONSAVEL: responsavelNome || '________________________________',
    CPF_RESPONSAVEL: responsavelCpf || '________________',
    TELEFONE_RESPONSAVEL: responsavelTelefone || '________________',
    PARENTESCO: responsavelParentesco || '________________',
    PAPEL_RESPONSAVEL: idade !== null && idade < 16 ? 'representante legal' : 'responsável legal e assistente',
    PLANO: aluno.plano_nome || 'não informado',
    MENSALIDADE: `R$ ${Number(aluno.valor_mensalidade || 0).toFixed(2)}`,
    DIA_VENCIMENTO: String(aluno.dia_vencimento || 10),
    FIM_PLANO: formatarDataBrasil(aluno.fim_plano),
    TEXTO_ASSISTENCIA: idade !== null && idade >= 16 && idade < 18
      ? 'O(A) aluno(a) adolescente também assina este instrumento, assistido(a) pelo responsável.'
      : '',
    AUTORIZACAO_MENOR: menorDeIdade
      ? `4. AUTORIZAÇÃO DO RESPONSÁVEL. O(A) responsável identificado(a) declara possuir poderes para representar ou assistir o(a) aluno(a), autoriza sua matrícula e participação nas atividades descritas neste contrato e compromete-se a manter atualizados seus contatos e as informações necessárias à segurança do(a) aluno(a). Esta autorização não representa renúncia a direitos nem afasta deveres legais de qualquer das partes.${idade !== null && idade >= 16 ? ' O(A) aluno(a) adolescente também assina este instrumento, assistido(a) pelo responsável.' : ''}`
      : '',
    BLOCO_RESPONSAVEL: menorDeIdade
      ? `RESPONSÁVEL LEGAL: ${responsavelNome || '________________________________'}, CPF ${responsavelCpf || '________________'}, telefone ${responsavelTelefone || '________________'}, vínculo: ${responsavelParentesco || '________________'}, que participa deste instrumento como ${idade !== null && idade < 16 ? 'representante legal do(a) aluno(a)' : 'responsável legal e assistente do(a) aluno(a)'}.`
      : '',
    ASSINATURA_ALUNO: menorDeIdade && idade !== null && idade < 16
      ? ''
      : `____________________________________\n${aluno.nome} — ${menorDeIdade ? 'Aluno(a) adolescente' : 'Aluno(a) / contratante'}`,
    ASSINATURA_RESPONSAVEL: menorDeIdade
      ? `____________________________________\n${responsavelNome || 'RESPONSÁVEL LEGAL'} — ${idade !== null && idade < 16 ? 'Representante legal' : 'Responsável / assistente'}`
      : '',
    CIDADE: '____________________________',
    DATA: formatarDataBrasil(hoje)
  };
  const textoModeloAplicado = contratoPersonalizado ? textoContrato : modeloContratoSelecionado;
  const contratoPreenchido = preencherModeloContrato(textoModeloAplicado || modeloContratoSelecionado, camposContrato);

  useEffect(() => {
    let ativo = true;
    if (aluno.foto_storage_path) {
      void supabase.storage.from('fitgestao-alunos').createSignedUrl(aluno.foto_storage_path, 3600)
        .then(({ data }) => { if (ativo) setFotoUrl(data?.signedUrl || ''); });
    }
    return () => { ativo = false; };
  }, [aluno.id, aluno.observacoes, aluno.foto_storage_path]);

  useEffect(() => {
    let ativo = true;
    void supabase.from('gestao_configuracoes').select('cnpj_cpf,endereco,modelo_contrato,modelo_contrato_adulto,modelo_contrato_menor').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) {
          setMensagemContrato(`Não foi possível carregar os modelos de contrato: ${error.message}. Execute a migração atualizada de contratos no Supabase.`);
          return;
        }
        const modeloAdulto = data?.modelo_contrato_adulto?.trim() || data?.modelo_contrato?.trim() || MODELO_CONTRATO_ADULTO;
        const modeloMenor = data?.modelo_contrato_menor?.trim() || MODELO_CONTRATO_MENOR;
        setModeloContratoAdulto(modeloAdulto);
        setModeloContratoMenor(modeloMenor);
        const personalizado = aluno.contrato_personalizado === true;
        setContratoPersonalizado(personalizado);
        setTextoContrato(personalizado && aluno.contrato_texto?.trim()
          ? aluno.contrato_texto
          : (menorDeIdade ? modeloMenor : modeloAdulto));
        if (data) {
          setCnpjAcademia(data.cnpj_cpf || '');
          setEnderecoAcademia(data.endereco || '');
        }
      });
    return () => { ativo = false; };
  }, [userId, aluno.id, aluno.contrato_texto, aluno.contrato_personalizado, menorDeIdade]);

  useEffect(() => {
    if (aluno.id == null) return;
    let ativo = true;
    void supabase.from('frequencias').select('id', { count: 'exact', head: true })
      .eq('aluno_id', aluno.id).eq('user_id', userId)
      .then(({ count, error }) => {
        if (!ativo) return;
        setTotalPresencas(error ? presencas.length : count || 0);
      });
    return () => { ativo = false; };
  }, [aluno.id, userId, presencas.length]);

  async function salvarObservacoes() {
    if (!aluno.id) return;
    setSalvando(true);
    setMensagem('');
    const { error } = await supabase.from('alunos').update({ observacoes }).eq('id', aluno.id)
      .or(`user_id.eq.${userId},academia_id.eq.${userId}`);
    setSalvando(false);
    setMensagem(error ? `Não foi possível salvar: ${error.message}` : 