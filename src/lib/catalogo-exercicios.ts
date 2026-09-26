// Exercícios iniciais. Cada conta escolhe quando importar estes registros para sua biblioteca.
const grupos: Record<string, string[]> = {
  Peitoral: ['Supino reto com barra', 'Supino reto com halteres', 'Supino inclinado com barra', 'Supino inclinado com halteres', 'Supino declinado', 'Crucifixo com halteres', 'Crucifixo na máquina', 'Crossover no cabo', 'Flexão de braços', 'Paralelas para peitoral'],
  Costas: ['Puxada alta pela frente', 'Puxada neutra', 'Barra fixa', 'Remada curvada com barra', 'Remada unilateral com halter', 'Remada baixa no cabo', 'Remada cavalinho', 'Pulldown com braços estendidos', 'Remada na máquina', 'Pullover com halter'],
  Ombros: ['Desenvolvimento com halteres', 'Desenvolvimento com barra', 'Elevação lateral com halteres', 'Elevação frontal com halteres', 'Elevação lateral no cabo', 'Crucifixo inverso', 'Face pull', 'Encolhimento com halteres'],
  Bíceps: ['Rosca direta com barra', 'Rosca alternada com halteres', 'Rosca martelo', 'Rosca concentrada', 'Rosca Scott', 'Rosca no cabo', 'Rosca inversa'],
  Tríceps: ['Tríceps na polia com corda', 'Tríceps na polia com barra', 'Tríceps francês', 'Tríceps testa', 'Tríceps coice', 'Mergulho no banco', 'Supino fechado'],
  Quadríceps: ['Agachamento livre', 'Agachamento frontal', 'Agachamento no smith', 'Leg press 45°', 'Cadeira extensora', 'Afundo com halteres', 'Passada com halteres', 'Agachamento búlgaro', 'Hack squat'],
  'Posteriores de coxa': ['Mesa flexora', 'Cadeira flexora', 'Flexora em pé', 'Stiff com barra', 'Stiff com halteres', 'Levantamento terra romeno', 'Bom dia com barra'],
  Glúteos: ['Elevação pélvica', 'Ponte de glúteos', 'Coice no cabo', 'Abdução de quadril na máquina', 'Abdução de quadril com elástico', 'Extensão de quadril no banco', 'Step-up no banco'],
  Panturrilhas: ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press', 'Panturrilha unilateral em pé'],
  'Abdômen e core': ['Prancha frontal', 'Prancha lateral', 'Abdominal reto', 'Abdominal infra', 'Abdominal na polia', 'Elevação de pernas', 'Abdominal bicicleta', 'Dead bug', 'Bird dog', 'Pallof press'],
  Cardio: ['Caminhada na esteira', 'Corrida na esteira', 'Bicicleta ergométrica', 'Elíptico', 'Remo ergométrico', 'Pular corda', 'Subida de escadas'],
  Mobilidade: ['Mobilidade de quadril', 'Mobilidade torácica', 'Mobilidade de ombros', 'Alongamento de posterior de coxa', 'Alongamento de peitoral']
};

export const catalogoExercicios = Object.entries(grupos).flatMap(([categoria, nomes]) =>
  nomes.map((titulo) => ({ titulo, categoria, detalhes: '' }))
);

export const gruposMusculares = Object.keys(grupos);
