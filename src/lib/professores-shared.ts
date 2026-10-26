export type TipoRegistroProfessor = 'exercicio' | 'treino' | 'nutricao';

export interface AlunoProfessor {
  id: string;
  nome: string;
  status: string;
  plano_nome: string | null;
  graduacao: string | null;
  total_presencas: number;
  presencas_mes: number;
  ultima_presenca: string | null;
}

export interface DadosPortalProfessor {
  academia: { owner_id: string; nome: string };
  professor: { id: string; nome: string };
  alunos: AlunoProfessor[];
}

export interface RegistroProfessor {
  id: string;
  titulo: string;
  categoria: string;
  detalhes: string;
  aluno_id: string | null;
  valor: null;
  quantidade: number;
  data_registro: string;
  criado_em: string;
  ficha?: unknown;
}
