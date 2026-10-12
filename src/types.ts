export type ReadStatus =
  | 'read'
  | 'partial'
  | 'unreadable'
  | 'excluded'
  | 'duplicate'
  | 'superseded'
  | 'removed';
export interface DataTable {
  columns: string[];
  rows: Record<string, string | number>[];
  sheet?: string;
  formulaCells?: string[];
  preamble?: unknown[];
}
export interface CaseDocument {
  id: string;
  name: string;
  kind?: string;
  status: ReadStatus;
  text?: string;
  tables?: DataTable[];
  json?: unknown;
  hash: string;
  bytes: number;
  error?: string | null;
  originalStored?: boolean;
  seedDocument?: boolean;
  unreadPages?: number[];
  totalPages?: number;
  pages?: number;
  removalReason?: string;
  formulaCells?: string[];
}
export interface Finding {
  severity: 'block' | 'warn';
  code: string;
  message: string;
  source: string;
  request: string;
}
export interface Calculation {
  assay: string;
  version: string;
  operation: string;
  declared: number | null;
  calculated: number | null;
  scope: string;
  passed: boolean;
  source: string;
}
export interface Check {
  blocked: boolean;
  coverage: number;
  logical: number;
  fullyRead: number;
  received: number;
  findings: Finding[];
  calculations: Calculation[];
  notice: string;
  ruleVersion: string;
}
export type Classification =
  | 'Elegível'
  | 'Com ressalvas'
  | 'Não elegível'
  | 'Evidência insuficiente';
export type CriterionState = 'Sustentado' | 'Não sustentado' | 'Insuficiente' | 'Contraditório';
export interface CriterionReview {
  state: CriterionState;
  comment: string;
  documentId: string;
  locator: string;
}
export interface Review {
  actor: string;
  analystName?: string;
  at: string;
  classification: Classification;
  conclusion: string;
  criteria: CriterionReview[];
  documentVersion: number;
  documentRevision?: number;
  invalidationReason?: string;
  invalidatedAt?: string;
}
export interface AuditEvent {
  action: string;
  at: string;
  actor: string;
  document?: string;
  reason?: string;
  status?: string;
  analystName?: string;
  before?: { code: string; title: string };
  after?: { code: string; title: string };
}
export interface Analyst {
  id: string;
  name: string;
}
export interface Project {
  id: string;
  code: string;
  title: string;
  revision: number;
  documentVersion: number;
  documents: CaseDocument[];
  check: Check | null;
  reviews: Review[];
  review: Review | null;
  reviewHistory: Review[];
  events: AuditEvent[];
  currentUser: Analyst;
  shared?: boolean;
  catalogCase?: boolean;
  divergent?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface CatalogRow {
  id: string;
  code: string;
  title: string;
  files: number;
  catalogCase?: boolean;
  shared?: boolean;
  documentVersion: number;
  reviewCount: number;
  divergent?: boolean;
  reviews: Review[];
  previousReviews?: number;
  check: null | { blocked: boolean; coverage: number; findings: number; results: number };
}
export interface Extraction extends Omit<CaseDocument, 'id' | 'hash' | 'bytes'> {
  extraction?: string;
}
