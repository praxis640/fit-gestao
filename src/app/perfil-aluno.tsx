'use client';

import { calcularIdade, digitosTelefone, formatarDataBrasil, formatarTelefone, telefoneValido } from '@/lib/alunos';
import { adicionarDias, dataEmSaoPaulo } from '@/lib/faturamento';

type Aluno = {
  id?: string | number;
  nome: string;
  telefone?: string;
  data_nascimento?: string | null;
  status: 'Ativo' | 'Inativo';
  graduacao?: string;
  plano_nome?: string;
  valor_mensalidade?: number;
  dia_vencimento?: number;
  criado_em?: string;
  fim_plano?: string | null;
};

type Pagamento = { aluno_id: string; valor: number; competencia: string };
type Frequencia = { aluno_id: string | number; data: string };

const item: React.CSSProperties = { padding: '0.85rem', background: '#171a25', borderRadius: '8px', minWidth: 0 };

export function PerfilAluno({ aluno, hoje, pagamentos, frequencias, situacao, diasRestantes, onEditar, onFechar }: {
  aluno: Aluno;
  hoje: string;
  pagamentos: Pagamento[];
  frequencias: Frequencia[];
  situacao: 'Em Dia' | 'Pendente' | 'Atrasado';
  diasRestantes: string;
  onEditar: () => void;
  onFechar: () => void;
}) {
  const idade = calcularIdade(aluno.data_nascimento, hoje);
  const id = String(aluno.id);
  const historico = pagamentos.filter((pagamento) => String(pagamento.aluno_id) === id)
    .sort((a, b) => b.competencia.localeCompare(a.competencia));
  const presencas = frequencias.filter((frequencia) => String(frequencia.aluno_id) === id)
    .sort((a, b) => b.data.localeCompare(a.data));
  const inicio30Dias = adicionarDias(hoje, -29);
  const recentes = presencas.filter((frequencia) => frequencia.data >= inicio30Dias && frequencia.data <= hoje);

  return <section aria-label={`Perfil de ${aluno.nome}`} style={{ background: '#1e2230', padding: '1.5rem', borderRadius: '12px', border: '1px solid #635bfc' }}>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <span style={{ color: '#aaa7ff', fontSize: '0.8rem' }}>PERFIL DO ALUNO</span>
        <h2 style={{ margin: '0.2rem 0' }}>{aluno.nome}</h2>
        <p style={{ margin: 0, color: '#aeb5c6' }}>
          {aluno.status} · {idade === null ? 'Idade não informada' : `${idade} anos`} · {aluno.plano_nome || 'Sem plano definido'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {aluno.telefone && telefoneValido(aluno.telefone) && <a href={`https://wa.me/55${digitosTelefone(aluno.telefone)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '0.6rem 0.8rem', background: '#166534', borderRadius: '6px', color: '#fff', textDecoration: 'none' }}>WhatsApp</a>}
        <button type="button" onClick={onEditar} style={{ padding: '0.6rem 0.8rem', background: '#3b82f6', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Editar cadastro</button>
        <button type="button" onClick={onFechar} aria-label="Fechar perfil" style={{ padding: '0.6rem 0.8rem', background: '#353a4c', border: 0, borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Fechar</button>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem', marginTop: '1.3rem' }}>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Nascimento</small><div>{formatarDataBrasil(aluno.data_nascimento)}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Telefone</small><div>{aluno.telefone ? formatarTelefone(aluno.telefone) : 'Não informado'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Cadastro</small><div>{aluno.criado_em ? formatarDataBrasil(dataEmSaoPaulo(new Date(aluno.criado_em))) : 'Não informado'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Graduação / faixa</small><div>{aluno.graduacao || 'Não informada'}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Plano válido até</small><div>{formatarDataBrasil(aluno.fim_plano)} · {diasRestantes}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Matrícula</small><div>{aluno.status}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Mensalidade</small><div>R$ {Number(aluno.valor_mensalidade || 0).toFixed(2)} · dia {aluno.dia_vencimento || 10}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Pagamento do mês</small><div>{situacao}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Presenças nos últimos 30 dias</small><div>{recentes.length}</div></div>
      <div style={item}><small style={{ color: '#aeb5c6' }}>Última presença</small><div>{formatarDataBrasil(presencas[0]?.data)}</div></div>
    </div>

    <div style={{ marginTop: '1.2rem' }}>
      <h3 style={{ margin: '0 0 0.5rem' }}>Pagamentos registrados</h3>
      {historico.length === 0 ? <p style={{ color: '#aeb5c6' }}>Nenhum pagamento registrado no histórico.</p> :
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {historico.slice(0, 6).map((pagamento, indice) => <span key={`${pagamento.competencia}-${indice}`} style={{ ...item, fontSize: '0.85rem' }}>
            {pagamento.competencia.slice(0, 7).split('-').reverse().join('/')} · R$ {Number(pagamento.valor).toFixed(2)}
          </span>)}
        </div>}
    </div>
  </section>;
}
