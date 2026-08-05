export interface Client {
  id: string;
  created_at: string;
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

export interface Installment {
  id: string;
  created_at: string;
  contract_id: string;
  installment_number: number;
  original_value: number;
  due_date: string;
  status: 'pending' | 'paid' | 'late' | 'in_negotiation';
}

export interface Case {
  id: string;
  created_at: string;
  user_id?: string;
  name: string;
  phone: string;
  original_value: number;
  updated_value: number;
  due_date: string;
  max_discount_margin: number;
  status: 'not_started' | 'in_negotiation' | 'needs_attention' | 'closed';
  debtor_id?: string;
  debtor_email?: string;
  debtor_document?: string;
  debtor_address?: string;
  telegram_chat_id?: string;
}

export interface Message {
  id: string;
  created_at: string;
  case_id: string;
  role: 'user' | 'ai' | 'human' | 'system';
  content: string;
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
