export type InvoiceStatus = 'brouillon' | 'envoyée' | 'payée' | 'en_retard';
export type QuoteStatus = 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré';

export interface LineItem {
  label: string;
  qty: number;
  unit_price: number;
  vat_rate: number;
}

export type LegalForm =
  | 'auto-entrepreneur'
  | 'EI'
  | 'EURL'
  | 'SARL'
  | 'SAS'
  | 'SASU'
  | 'autre';

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  siret: string | null;
  activity_sector: string | null;
  vat_default: number;
  is_drom: boolean;
  tutoiement: boolean;
  created_at: string;

  // Legal fields (migration 0003) — all optional for V0
  address: string | null;
  postal_code: string | null;
  city: string | null;
  naf_code: string | null;
  naf_label: string | null;
  legal_form: LegalForm | null;
  capital_social: number | null;
  rcs: string | null;
  vat_intra: string | null;
  tva_franchise: boolean;
  late_penalty_rate: number;
  late_penalty_indemnity: number;
  payment_terms_days: number;
  b2c_mediator: string | null;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;

  // Pro fields (migration 0003)
  company_name: string | null;
  siret: string | null;
  vat_intra: string | null;
  postal_code: string | null;
  city: string | null;
  is_business: boolean;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string | null;
  number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  vat_rate: number;
  amount_ht: number;
  amount_vat: number;
  amount_ttc: number;
  line_items: LineItem[];
  notes: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  user_id: string;
  client_id: string | null;
  number: string | null;
  status: QuoteStatus;
  issue_date: string;
  expiry_date: string | null;
  vat_rate: number;
  amount_ht: number;
  amount_vat: number;
  amount_ttc: number;
  line_items: LineItem[];
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus = 'planifié' | 'effectué' | 'annulé' | 'reporté';

export interface Appointment {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  status: AppointmentStatus;
  created_at: string;
}

export type AvaIntent =
  | 'create_invoice'
  | 'create_quote'
  | 'send_reminder'
  | 'get_financial_status'
  | 'get_invoice_list'
  | 'mark_paid'
  | 'schedule_appointment'
  | 'send_document'
  | 'find_document'
  | 'sign_document'
  | 'unknown';

export interface IntentEntities {
  client_name: string | null;
  client_email: string | null;
  amount_total: number | null;
  line_items: LineItem[];
  date: string | null;
  due_date: string | null;
  notes: string | null;
  document_ref: string | null;
}

export interface IntentResult {
  intent: AvaIntent;
  entities: IntentEntities;
  confidence: number;
  ava_response: string;
}

export interface AvaAction {
  id: string;
  user_id: string;
  input_raw: string | null;
  intent: AvaIntent;
  entities: IntentEntities;
  confidence: number;
  status: 'pending' | 'confirmed' | 'executing' | 'executed' | 'cancelled';
  ava_response: string | null;
  target_table: 'invoices' | 'quotes' | 'clients' | null;
  target_id: string | null;
  processing_ms: number | null;
  created_at: string;
}
