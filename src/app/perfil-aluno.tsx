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
    setMensagem(error ? `Não foi possível salvar: ${error.message}` : 'Anotações salvas.');
    if (!error) await onAtualizar();
  }

  async function enviarFoto(arquivo?: File) {
    if (!arquivo || !aluno.id) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
      setMensagem('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');
      return;
    }
    setSalvando(true);
    setMensagem('');
    const extensao = arquivo.type === 'image/png' ? 'png' : arquivo.type === 'image/webp' ? 'webp' : 'jpg';
    const caminho = `${userId}/${aluno.id}/${Date.now()}.${extensao}`;
    const { error: erroUpload } = await supabase.storage.from('fitgestao-alunos').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (erroUpload) {
      setSalvando(false);
      setMensagem(`Não foi possível enviar a foto: ${erroUpload.message}. Execute a migração de perfil do aluno.`);
      return;
    }
    const { error } = await supabase.from('alunos').update({ foto_storage_path: caminho }).eq('id', aluno.id)
      .or(`user_id.eq.${userId},academia_id.eq.${userId}`);
    if (error) {
      await supabase.storage.from('fitgestao-alunos').remove([caminho]);
      setMensagem(`A foto foi enviada, mas não vinculada: ${error.message}`);
    } else {
      const { data } = await supabase.storage.from('fitgestao-alunos').createSignedUrl(caminho, 3600);
      setFotoUrl(data?.signedUrl || '');
      setMensagem('Foto do perfil atualizada.');
      await onAtualizar();
    }
    setSalvando(false);
  }

  async function salvarContrato(imprimir = false) {
    if (aluno.id == null) return;
    if (idade === null) {
      setMensagemContrato('Preencha a data de nascimento no cadastro do aluno para identificar corretamente se o contrato é de adulto ou menor.');
      return;
    }
    if (menorDeIdade && (!responsavelNome.trim() || !responsavelCpf.trim() || !responsavelParentesco.trim())) {
      setMensagemContrato('Para contrato de menor, informe nome, CPF e parentesco do responsável legal.');
      return;
    }
    if (!textoContrato.trim()) {
      setMensagemContrato('O texto do contrato está vazio. Escreva o contrato ou restaure o modelo nas configurações.');
      return;
    }
    setSalvando(true);
    setMensagemContrato('');
    const [resAluno, resAcademia] = await Promise.all([
      supabase.from('alunos').update({
        cpf: cpfAluno.trim() || null,
        endereco: enderecoAluno.trim() || null,
        contrato_responsavel_nome: responsavelNome.trim(),
        contrato_responsavel_cpf: responsavelCpf.trim(),
        contrato_responsavel_telefone: responsavelTelefone.trim(),
        contrato_responsavel_parentesco: responsavelParentesco.trim(),
        contrato_texto: contratoPersonalizado ? textoContrato.trim() : '',
        contrato_personalizado: contratoPersonalizado
      }).eq('id', aluno.id).or(`user_id.eq.${userId},academia_id.eq.${userId}`),
      supabase.from('gestao_configuracoes').upsert({
        user_id: userId,
        nome_academia: academia || 'FitGestão',
        cnpj_cpf: cnpjAcademia.trim(),
        endereco: enderecoAcademia.trim()
      }, { onConflict: 'user_id' })
    ]);
    setSalvando(false);
    if (resAluno.error || resAcademia.error) {
      setMensagemContrato(`Não foi possível salvar os dados: ${(resAluno.error || resAcademia.error)?.message}. Confira se executou a migração de contratos.`);
      return;
    }
    setMensagemContrato('Dados do contrato salvos.');
    await onAtualizar();
    if (imprimir) window.setTimeout(() => window.print(), 150);
  }

  return <section aria-label={`Perfil de ${aluno.nome}`} style={{ background: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #635bfc' }}>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
        <label title="Alterar foto do aluno" style={{ width: 68, height: 68, borderRadius: '50%', background: '#353a4c', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto', cursor: 'pointer', border: '2px solid #635bfc' }}>
          {fotoUrl ? <Image src={fotoUrl} alt={`Foto de ${aluno.nome}`} width={68} height={68} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>👤</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={salvando} onChange={(e) => void enviarFoto(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
        <div>
        <span style={{ color: '#aaa7ff', fontSize: '0.8rem' }}>PERFIL DO ALUNO</span>
        <h2 style={{ margin: '0.2rem 0' }}>{aluno.nome}</h2>
        <p style={{ margin: 0, color: '#aeb5c6' }}>
          {aluno.status} · {idade === null ? 'Idade não informada' : `${idade} anos`} · {aluno.plano_nome || 'Sem plano definido'}
        </p>
        <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'baseline', marginTop: '0.5rem', padding: '0.35rem 0.65rem', borderRadius: 7, background: '#12352d', border: '1px solid #1f654f' }}>
          <strong style={{ color: '#4ade80', fontSize: '1.1rem' }}>{totalPresencas}</strong>
          <span style={{ color: '#c3e8d8', fontSize: '0.8rem' }}>treinos frequentados</span>
        </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {aluno.telefone && telefoneValido(aluno.telefone) && <a href={`https://wa.me/55${digitosTelefone(aluno.telefone)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '0.6rem 0.8rem', background: '#166534', borderRadius: '6px', color: '#fff', textDecoration: 'none' }}>WhatsApp</a>}
        <button type="button" onClick={onEditar} style={{ padding: '0.6rem 0.8rem', background: '#3b82f6', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Editar cadastro</button>
        <button type="button" onClick={onFechar} aria-label="Fechar perfil" style={{ padding: '0.6rem 0.8rem', background: '#353a4c', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Fechar</button>
      </div>
    </div>

    <nav aria-label="Abas do perfil" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', borderBottom: '1px solid #353a4c', paddingBottom: '0.6rem' }}>
      {([['resumo', 'Resumo'], ['sobre', 'Sobre o aluno'], ['foto', 'Foto do perfil'], ['contrato', 'Contrato']] as const).map(([idAba, titulo]) => <button key={idAba} type="button" onClick={() => setAba(idAba)} aria-pressed={aba === idAba} style={{ padding: '0.55rem 0.9rem', border: 0, borderRadius: 6, background: aba === idAba ? '#635bfc' : '#353a4c', color: '#fff', cursor: 'pointer' }}>{titulo}</button>)}
    </nav>
    {aba === 'resumo' ? <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem', marginTop: '1.3rem' }}>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Nascimento</small><div>{formatarDataBrasil(aluno.data_nascimento)}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Telefone</small><div>{aluno.telefone ? formatarTelefone(aluno.telefone) : 'Não informado'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Cadastro</small><div>{aluno.criado_em ? formatarDataBrasil(dataEmSaoPaulo(new Date(aluno.criado_em))) : 'Não informado'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Graduação / faixa</small><div>{aluno.graduacao || 'Não informada'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Plano válido até</small><div>{formatarDataBrasil(aluno.fim_plano)} · {diasRestantes}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Próximo vencimento</small><div>{formatarDataBrasil(vencimentoPagamento(aluno, hoje))}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Matrícula</small><div>{aluno.status}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Mensalidade</small><div>R$ {Number(aluno.valor_mensalidade || 0).toFixed(2)} · dia {aluno.dia_vencimento || 10}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Pagamento do mês</small><div>{situacao}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Presenças nos últimos 30 dias</small><div>{recentes.length}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Presenças totais</small><div>{totalPresencas}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Última presença</small><div>{formatarDataBrasil(presencas[0]?.data)}</div></div>
    </div>
    </> : aba === 'sobre' ? <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.8rem' }}>
      <h3 style={{ margin: 0 }}>Sobre {aluno.nome}</h3>
      <p style={{ margin: 0, color: '#aeb5c6' }}>Registre informações úteis para a equipe, como mudanças de faixa, limitações de mobilidade ou observações de acompanhamento.</p>
      <textarea value={observacoes} maxLength={5000} onChange={(e) => setObservacoes(e.target.value)} rows={7} placeholder="Escreva uma observação sobre o aluno..." style={{ ...item, width: '100%', color: '#fff', border: '1px solid #3a3f55', resize: 'vertical', font: 'inherit' }} />
      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}><button type="button" disabled={salvando} onClick={() => void salvarObservacoes()} style={{ padding: '0.65rem 1rem', background: '#635bfc', border: 0, borderRadius: 6, color: '#fff', cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar anotações'}</button><small style={{ color: '#aeb5c6' }}>{observacoes.length}/5000 caracteres</small>{mensagem && <span role="status" style={{ color: mensagem.includes('Não foi') || mensagem.includes('não vinculada') ? '#fecaca' : '#86efac' }}>{mensagem}</span>}</div>
    </div> : aba === 'foto' ? <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.8rem' }}>
      <h3 style={{ margin: 0 }}>Foto de {aluno.nome}</h3>
      <p style={{ margin: 0, color: '#aeb5c6' }}>Envie uma foto JPG, PNG ou WebP de até 5 MB. A imagem é armazenada de forma privada.</p>
      {fotoUrl && <Image src={fotoUrl} alt={`Foto de ${aluno.nome}`} width={180} height={180} unoptimized style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid #3a3f55' }} />}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', padding: '0.7rem 1rem', background: '#635bfc', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
        {salvando ? 'Enviando…' : fotoUrl ? 'Trocar foto' : 'Selecionar foto'}
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={salvando} onChange={(e) => void enviarFoto(e.target.files?.[0])} style={{ display: 'none' }} />
      </label>
      {mensagem && <span role="status" style={{ color: mensagem.includes('Não foi') || mensagem.includes('não vinculada') ? '#fecaca' : '#86efac' }}>{mensagem}</span>}
    </div> : <div style={{ marginTop: '1.2rem', display: 'grid', gap: '1rem' }}>
      <div className="contrato-controles" style={{ display: 'grid', gap: '0.8rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.35rem' }}>Contrato de prestação de serviços esportivos</h3>
          <p style={{ margin: 0, color: '#aeb5c6' }}>Os dados cadastrados do aluno e o plano são preenchidos no documento. Complete os campos faltantes antes de imprimir.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>CPF do aluno<input style={campoContrato} value={cpfAluno} onChange={(e) => setCpfAluno(e.target.value)} placeholder="CPF do aluno" /></label>
          <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>Endereço do aluno<input style={campoContrato} value={enderecoAluno} onChange={(e) => setEnderecoAluno(e.target.value)} placeholder="Rua, número, bairro, cidade/UF" /></label>
          <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>CNPJ/CPF da academia<input style={campoContrato} value={cnpjAcademia} onChange={(e) => setCnpjAcademia(e.target.value)} placeholder="Documento da academia" /></label>
          <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>Endereço da academia<input style={campoContrato} value={enderecoAcademia} onChange={(e) => setEnderecoAcademia(e.target.value)} placeholder="Rua, número, bairro, cidade/UF" /></label>
        </div>
        {menorDeIdade && <section style={{ display: 'grid', gap: '0.8rem', padding: '1rem', border: '1px solid #635bfc', borderRadius: 8, background: '#191b2b' }}>
          <div><strong>Responsável legal — obrigatório para menores de 18 anos</strong><p style={{ margin: '0.3rem 0 0', color: '#aeb5c6', fontSize: '0.9rem' }}>O documento identifica o responsável como representante para menores de 16 anos e como responsável/assistente para alunos de 16 e 17 anos. O aluno de 16 ou 17 anos também terá campo para assinar.</p></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
            <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>Nome do responsável *<input style={campoContrato} value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} required /></label>
            <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>CPF do responsável *<input style={campoContrato} value={responsavelCpf} onChange={(e) => setResponsavelCpf(e.target.value)} required /></label>
            <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>Parentesco / vínculo *<input style={campoContrato} value={responsavelParentesco} onChange={(e) => setResponsavelParentesco(e.target.value)} placeholder="Mãe, pai, tutor legal…" required /></label>
            <label style={{ display: 'grid', gap: 5, color: '#aeb5c6' }}>Telefone do responsável<input style={campoContrato} type="tel" value={responsavelTelefone} onChange={(e) => setResponsavelTelefone(e.target.value)} /></label>
          </div>
        </section>}
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={salvando} onClick={() => void salvarContrato(false)} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar dados do contrato'}</button>
          <button type="button" disabled={salvando} onClick={() => void salvarContrato(true)} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: 6, background: '#635bfc', color: '#fff', cursor: 'pointer' }}>Imprimir / salvar como PDF</button>
        </div>
        <div className="contrato-controles" style={{ display: 'grid', gap: '0.5rem', color: '#aeb5c6' }}>
          <label htmlFor="editar-texto-contrato">Editar o texto deste contrato</label>
          <small>Modelo vinculado automaticamente: <strong>{menorDeIdade ? 'Menor de idade' : 'Adulto (18 anos ou mais)'}</strong>. {contratoPersonalizado ? `Este contrato tem texto personalizado para ${aluno.nome}.` : 'Ele acompanha o modelo padrão e será atualizado quando você alterar as Configurações.'} Use campos como {'{{ALUNO}}'}, {'{{PLANO}}'} e {'{{RESPONSAVEL}}'} para preencher os dados automaticamente.</small>
          <button type="button" onClick={() => { setTextoContrato(modeloContratoSelecionado); setContratoPersonalizado(false); }} style={{ justifySelf: 'start', padding: '0.55rem 0.8rem', background: '#353a4c', border: 0, borderRadius: 6, color: '#fff', cursor: 'pointer' }}>Vincular ao modelo de {menorDeIdade ? 'menor' : 'adulto'}</button>
          <textarea id="editar-texto-contrato" value={textoContrato} onChange={(e) => { setTextoContrato(e.target.value); setContratoPersonalizado(true); }} rows={18} maxLength={20000} style={{ ...campoContrato, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }} />
        </div>
        {mensagemContrato && <p role="status" style={{ margin: 0, color: mensagemContrato.startsWith('Não') || mensagemContrato.startsWith('Preencha') || mensagemContrato.startsWith('Para contrato') ? '#fecaca' : '#86efac' }}>{mensagemContrato}</p>}
        <small style={{ color: '#fbbf24' }}>Modelo para conferência: não é assinatura eletrônica nem substitui revisão jurídica. As partes devem conferir e assinar o documento impresso.</small>
      </div>

      <article id="contrato-impressao" style={{ padding: '1.5rem', background: '#fff', color: '#172033', borderRadius: 8, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
        {contratoPreenchido}
      </article>
    </div>}

    {aba === 'resumo' && <div style={{ marginTop: '1.2rem' }}>
      <h3 style={{ margin: '0 0 0.5rem' }}>Pagamentos registrados</h3>
      {historico.length === 0 ? <p style={{ color: '#aeb5c6' }}>Nenhum pagamento registrado no histórico.</p> :
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {historico.slice(0, 6).map((pagamento, indice) => <span key={`${pagamento.competencia}-${indice}`} style={{ ...item, fontSize: '0.85rem' }}>
            {pagamento.competencia.slice(0, 7).split('-').reverse().join('/')} · R$ {Number(pagamento.valor).toFixed(2)}
          </span>)}
        </div>}
    </div>}
  </section>;
}
