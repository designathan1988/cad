// The approval journey (docs/plano-de-escopo.md, phase 12, "Processo de aprovação e documentos"): from
// the land to the registry, a list of steps set per city; each with its documents, who issues each,
// its time and cost as the office estimates them, its state, and what cad2 itself makes for it. The
// steps a new project gets are the plan's eight; times and costs are left for the office to fill in
// (they change by city and by year), not guessed. Pure.

/** What cad2 makes for a document (app/documents.ts, app/project-folder.ts). */
export type Generated = 'compliance' | 'areas' | 'cub' | 'sheets' | 'memorial' | 'budget' | 'schedule' | 'model';
export const GENERATED: readonly Generated[] = ['compliance', 'areas', 'cub', 'sheets', 'memorial', 'budget', 'schedule', 'model'];

export type DocState = 'todo' | 'doing' | 'done' | 'na';
export const DOC_STATES: readonly DocState[] = ['todo', 'doing', 'done', 'na'];

export interface ApprovalDoc {
  readonly id: string;
  readonly name: string;
  /** Who issues it: the city, a council, a registry, the office. */
  readonly issuer: string;
  readonly state: DocState;
  readonly generated?: Generated;
  /** Its number, date or a note once there is one (the RRT's number, the permit's date). */
  readonly note?: string;
}

export interface ApprovalStep {
  readonly id: string;
  readonly name: string;
  readonly docs: readonly ApprovalDoc[];
  /** The office's estimate of its time (days) and cost (R$), when it has one. */
  readonly days?: number;
  readonly cost?: number;
}

export interface Approval {
  /** Where the journey is set for ("São Paulo/SP"). */
  readonly city: string;
  readonly steps: readonly ApprovalStep[];
}

const d = (id: string, name: string, issuer: string, generated?: Generated): ApprovalDoc => ({ id, name, issuer, state: 'todo', ...(generated ? { generated } : {}) });

/** São Paulo's journey, as the plan lays it out: the steps and their documents, nothing estimated yet. */
export const SAO_PAULO: Approval = {
  city: 'São Paulo/SP',
  steps: [
    {
      id: 'step_survey',
      name: 'Levantamento',
      docs: [
        d('doc_topo', 'Levantamento topográfico', 'Topógrafo'),
        d('doc_matricula', 'Matrícula atualizada do imóvel', 'Cartório de Registro de Imóveis'),
        d('doc_params', 'Parâmetros urbanísticos do lote (zona, quadro da LPUOS)', 'Prefeitura'),
      ],
    },
    {
      id: 'step_feasibility',
      name: 'Viabilidade',
      docs: [d('doc_check', 'Verificação urbanística e de normas', 'cad2', 'compliance'), d('doc_cub', 'Estimativa de custo pelo CUB', 'cad2', 'cub')],
    },
    {
      id: 'step_legal',
      name: 'Projeto legal',
      docs: [
        d('doc_sheets', 'Pranchas do projeto legal', 'cad2', 'sheets'),
        d('doc_areas', 'Quadro de áreas', 'cad2', 'areas'),
        d('doc_memorial', 'Memorial descritivo', 'cad2', 'memorial'),
        d('doc_rrt', 'RRT do arquiteto (Lei 12.378/2010)', 'CAU'),
        d('doc_art', 'ART dos engenheiros (Lei 6.496/1977), uma por profissional', 'CREA'),
      ],
    },
    {
      id: 'step_permit',
      name: 'Aprovação',
      docs: [
        d('doc_alvara', 'Alvará de aprovação e execução', 'Prefeitura'),
        d('doc_bombeiros', 'Corpo de Bombeiros, quando exigido (em SP o regulamento exclui residências unifamiliares)', 'Corpo de Bombeiros'),
        d('doc_others', 'Meio ambiente, patrimônio histórico e concessionárias, quando aplicável', 'Órgãos competentes'),
      ],
    },
    {
      id: 'step_before',
      name: 'Antes da obra',
      docs: [d('doc_cno', 'Inscrição da obra no CNO (IN RFB 2.061/2021)', 'Receita Federal'), d('doc_exec', 'ART ou RRT de execução', 'CREA ou CAU')],
    },
    {
      id: 'step_works',
      name: 'Obra',
      docs: [d('doc_budget', 'Orçamento', 'cad2', 'budget'), d('doc_schedule', 'Cronograma físico-financeiro', 'cad2', 'schedule'), d('doc_measures', 'Medições', 'Escritório'), d('doc_diary', 'Diário de obra', 'Escritório')],
    },
    {
      id: 'step_end',
      name: 'Conclusão',
      docs: [
        d('doc_avcb', 'AVCB ou CLCB, quando exigido', 'Corpo de Bombeiros'),
        d('doc_habitese', 'Habite-se', 'Prefeitura'),
        d('doc_inss', 'Aferição da contribuição previdenciária da obra e certidão', 'Receita Federal'),
        d('doc_averbacao', 'Averbação da construção na matrícula', 'Cartório de Registro de Imóveis'),
      ],
    },
    {
      id: 'step_delivery',
      name: 'Entrega',
      docs: [d('doc_asbuilt', 'As built: o modelo e as pranchas como construído', 'cad2', 'model'), d('doc_manual', 'Manual de uso, operação e manutenção (NBR 14037)', 'Escritório')],
    },
  ],
};

const text = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const optNum = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

const isDoc = (x: unknown): x is ApprovalDoc =>
  isObj(x) && text(x.id) && text(x.name) && text(x.issuer) && DOC_STATES.includes(x.state as DocState) && (x.generated === undefined || GENERATED.includes(x.generated as Generated)) && (x.note === undefined || text(x.note));

const isStep = (x: unknown): x is ApprovalStep => isObj(x) && text(x.id) && text(x.name) && Array.isArray(x.docs) && x.docs.every(isDoc) && optNum(x.days) && optNum(x.cost);

export const isApproval = (x: unknown): x is Approval => isObj(x) && text(x.city) && Array.isArray(x.steps) && x.steps.every(isStep);

export const approvalOf = (doc: { readonly approval?: Approval }): Approval => doc.approval ?? SAO_PAULO;

/** How far the journey is: documents done (or not applicable) of all, and the steps' estimates summed. */
export function progressOf(a: Approval): { done: number; all: number; days: number; cost: number } {
  const docs = a.steps.flatMap((s) => s.docs);
  return {
    done: docs.filter((x) => x.state === 'done' || x.state === 'na').length,
    all: docs.length,
    days: a.steps.reduce((s, x) => s + (x.days ?? 0), 0),
    cost: a.steps.reduce((s, x) => s + (x.cost ?? 0), 0),
  };
}
