export interface Tenant {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  slug: string;
  owner_user_id: string;
  status: 'active' | 'suspended' | 'cancelled' | string;
  settings?: Record<string, unknown>;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | string;
  status: 'active' | 'invited' | 'suspended' | string;
  created_at: string;
}

export interface Client {
  id: string;
  created_at: string;
  tenant_id?: string;
  user_id?: string;
  name: string;
  document: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CollectionPolicy {
  id: string;
  created_at: string;
  tenant_id?: string;
  user_id?: string;
  name: string;
  interest_rate?: number;
  penalty_rate?: number;
  monetary_correction_index?: string;
  negative_allowed?: boolean;
  days_to_negative?: number;
  protest_allowed?: boolean;
  days_to_protest?: number;
  active?: boolean;
}

export interface Contract {
  id: string;
  created_at: string;
  tenant_id?: string;
  user_id?: string;
  client_id: string;
  contract_number?: string;
  type?: string;
  start_date?: string;
  due_date?: string;
  clauses?: string;
  interest_rate?: number;
  penalty_rate?: number;
  monetary_correction_index?: string;
  guarantees?: string;
  guarantors?: string;
  negative_allowed?: boolean;
  protest_allowed?: boolean;
  forum?: string;
  document_url?: string;
  collection_policy_id?: string;
  override_days_to_negative?: number;
  override_days_to_protest?: number;
  collection_policies?: CollectionPolicy;
}

export type FinancialTitleEligibilityReason = 'future' | 'today' | 'overdue' | 'paid' | 'cancelled';

export interface ContractWithClient extends Contract {
  clients?: Client | null;
}

export interface Installment {
  id: string;
  created_at: string;
  tenant_id?: string;
  contract_id: string;
  installment_number: number;
  original_value: number;
  due_date: string;
  status: 'pending' | 'paid' | 'late' | 'in_negotiation';
}

export interface Case {
  id: string;
  created_at: string;
  tenant_id?: string;
  user_id?: string;
  name: string;
  phone: string;
  original_value: number;
  updated_value: number;
  due_date: string;
  max_discount_margin: number;
  status: 'not_started' | 'in_negotiation' | 'needs_attention' | 'closed';
  financial_title_id?: string | null;
  financial_title?: FinancialTitle | null;
  contract?: Contract | null;
  client?: Client | null;
  assigned_user_id?: string | null;
  legacy_context?: boolean;
  debtor_id?: string;
  debtor_email?: string;
  debtor_document?: string;
  debtor_address?: string;
  telegram_chat_id?: string;
  propensity_score?: number | null;
  propensity_updated_at?: string | null;
}

export interface Message {
  id: string;
  created_at: string;
  tenant_id?: string;
  case_id: string;
  role: 'user' | 'ai' | 'human' | 'system';
  content: string;
}

export interface AuditLog {
  id: string;
  case_id?: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  actor_user_id?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
}

export interface ContractClause {
  id: string;
  tenant_id: string;
  contract_id: string;
  clause_number?: number;
  title?: string;
  content: string;
  active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContractDocument {
  id: string;
  tenant_id: string;
  contract_id: string;
  document_type: string;
  file_name?: string;
  storage_path?: string;
  mime_type?: string;
  file_size?: number;
  extracted_text?: string;
  metadata?: Record<string, unknown>;
  uploaded_by?: string;
  created_at: string;
}

export interface FinancialTitle {
  id: string;
  tenant_id: string;
  contract_id: string;
  client_id?: string;
  installment_number: number;
  external_reference?: string;
  description?: string;
  original_value: number;
  current_value: number | null;
  due_date: string;
  status: string;
  paid_at?: string;
  paid_amount?: number;
  legacy_installment_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type FinancialTitleStatus = 'open' | 'partial' | 'paid' | 'cancelled';

export interface FinancialTitlePatch {
  status?: FinancialTitleStatus;
  paid_at?: string;
  paid_amount?: number;
  metadata?: Record<string, unknown>;
}

export interface FinancialTitleWithEligibility extends FinancialTitle {
  eligible: boolean;
  eligibility_reason: FinancialTitleEligibilityReason;
  days_overdue: number;
}

export interface FinancialTitleWithRelations extends FinancialTitle {
  contracts?: ContractWithClient | null;
}

export interface FinancialTitlesResponse {
  financial_titles: FinancialTitleWithEligibility[];
}

export interface MessageTemplate {
  id: string;
  tenant_id?: string;
  name: string;
  channel: string;
  stage: string;
  language: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MessageTemplateStage = import('@/lib/message-templates').MessageTemplate['stage'];

export interface MessageTemplatesResponse {
  templates: MessageTemplate[];
  totalPages: number;
  total: number;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  body?: string | null;
  related_case_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread: number;
  totalPages: number;
  total: number;
}

export interface CaseWithRelations extends Case {
  financial_titles?: FinancialTitleWithRelations | FinancialTitleWithRelations[] | null;
}

// ---------------------------------------------------------------------------
// Dashboard metrics (Roadmap Fase 2 — Techspec "Interfaces Principais", Grupo A)
// ---------------------------------------------------------------------------

/** Estágio do funil de cobrança (espelha CollectionStageInfo['id'] de lib/finance). */
export type CollectionStage = import('@/lib/finance').CollectionStageInfo['id'];

export interface DashboardMetrics {
  total_cases: number;
  /** Casos não encerrados: not_started | in_negotiation | needs_attention. */
  active_cases: number;
  /** Soma de financial_titles.current_value onde status='paid' E paid_at IS NOT NULL. */
  recovered_amount: number;
  /** Soma do valor atualizado dos casos ativos (não closed). */
  pending_amount: number;
  /** Placeholder: closed / total * 100 — será enriquecido por negotiations (task 2). */
  success_rate: number;
  aging_buckets: { bucket: string; count: number; amount: number }[];
  stage_distribution: { stage: CollectionStage; count: number; amount: number }[];
  channel_distribution: { channel: string; count: number }[];
  avg_resolution_days: number;
  payment_status_pie: { name: string; value: number }[];
  contracts_by_month_bar: { month: string; count: number }[];
  /** @deprecated Compatibilidade com components/dashboard-charts.tsx — usar payment_status_pie. */
  paymentStatus: { name: string; value: number }[];
  /** @deprecated Compatibilidade com components/dashboard-charts.tsx — usar contracts_by_month_bar. */
  contractsByMonth: { name: string; Novas: number }[];
}

export interface CasesListResponse {
  cases: Case[];
  totalPages: number;
  total: number;
  page: number;
}

export interface CaseDetailsResponse {
  case: Case;
  client: Client | null;
  contract: ContractWithClient | null;
  financial_title: FinancialTitle | null;
  messages: Message[];
  audit_logs: AuditLog[];
  legacy_context: boolean;
  stage: import('@/lib/finance').CollectionStageInfo;
}

export type CaseCreationErrorCode =
  | 'AUTH_REQUIRED'
  | 'TENANT_REQUIRED'
  | 'TITLE_NOT_FOUND'
  | 'TITLE_NOT_OVERDUE'
  | 'TITLE_NOT_COLLECTIBLE'
  | 'ACTIVE_CASE_EXISTS';

export interface CreateCaseInput {
  financial_title_id: string;
  tenant_id?: string;
}

export interface CreateCaseResult {
  case: Case | null;
  error_code: CaseCreationErrorCode | null;
}

export interface CollectionCaseContext {
  case: Case;
  client: Client | null;
  contract: Contract | null;
  financial_title: FinancialTitle | null;
  legacy_context: boolean;
  messages: Message[];
  audit_logs: AuditLog[];
}

export interface Workflow {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  active: boolean;
  version: number;
  definition: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  workflow_id?: string;
  name: string;
  channel: string;
  status: string;
  starts_at?: string;
  ends_at?: string;
  audience_filter: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type NegotiationStatus = 'open' | 'accepted' | 'expired' | 'fulfilled' | 'defaulted';

export interface Negotiation {
  id: string;
  tenant_id: string;
  client_id: string | null;
  contract_id: string | null;
  financial_title_id: string | null;
  case_id: string | null;
  status: NegotiationStatus;
  original_value: number | null;
  proposed_value: number | null;
  agreed_value: number | null;
  discount_percent: number | null;
  installment_count: number | null;
  expires_at: string | null;
  accepted_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NegotiationWithRelations extends Negotiation {
  clients?: Pick<Client, 'id' | 'name' | 'document'> | null;
  cases?: Pick<Case, 'id' | 'name' | 'status'> | null;
}

export interface NegotiationsListResponse {
  negotiations: NegotiationWithRelations[];
  total: number;
  totalPages: number;
  page: number;
}

export interface LegalProcess {
  id: string;
  tenant_id: string;
  client_id?: string;
  contract_id?: string;
  financial_title_id?: string;
  case_id?: string;
  process_number?: string;
  process_type: string;
  court?: string;
  status: string;
  filing_date?: string;
  lawyer_name?: string;
  lawyer_contact?: string;
  metadata: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Result expected from AI Extraction
export interface ContractExtractionResult {
  client_name: string;
  client_document: string;
  client_address: string;
  client_phone: string;
  client_email: string;
  contract_number: string;
  type: string;
  start_date: string;
  due_date: string;
  total_value: number;
  installments_count: number;
  interest_rate: number;
  penalty_rate: number;
  monetary_correction_index: string;
  guarantees: string;
  guarantors: string;
  negative_allowed: boolean;
  protest_allowed: boolean;
  forum: string;
}

export interface CaseInsights {
  sentiment_trend: { date: string; score: number }[];
  main_objections: string[];
  theme_summary: string;
  agreement_probability: number;
  recommended_tone: string;
}
