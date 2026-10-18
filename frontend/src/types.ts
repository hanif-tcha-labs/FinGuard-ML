export type TransactionType = "CASH_OUT" | "TRANSFER";
export type PredictionStatus = "Fraud" | "Legitimate";

export interface PredictionInput {
  type: TransactionType;
  amount: number;
  oldbalanceOrg: number;
  oldbalanceDest: number;
  step?: number;
  nameOrig?: string;
  nameDest?: string;
}

export interface PredictionResult {
  prediction: PredictionStatus;
  fraud_probability: number;
  is_fraud: boolean;
  risk_level: "High" | "Low";
  threshold: number;
  model_version: string;
}

export interface TransactionRecord extends PredictionResult, PredictionInput {
  id: number;
  created_at: string;
}

export interface TransactionPage {
  items: TransactionRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface DatasetTypeStats {
  type: string;
  total_transactions: number;
  fraud_transactions: number;
  fraud_amount: number;
}

export interface DatasetStats {
  available: boolean;
  message?: string;
  source?: string;
  total_transactions?: number;
  fraud_transactions?: number;
  legitimate_transactions?: number;
  fraud_rate?: number;
  average_amount?: number;
  total_fraud_amount?: number;
  fraud_by_type?: DatasetTypeStats[];
  activity_by_day?: {
    day: number;
    total_transactions: number;
    fraud_transactions: number;
  }[];
}

export interface DashboardStats {
  live: {
    total_transactions: number;
    fraud_transactions: number;
    legitimate_transactions: number;
    fraud_rate: number;
    average_amount: number;
    total_fraud_amount: number;
    recent_activity: {
      date: string;
      total_transactions: number;
      fraud_transactions: number;
    }[];
    weekly_trends: {
      transactions_change_pct: number | null;
      fraud_change_pct: number | null;
      legitimate_change_pct: number | null;
      fraud_rate_change_pp: number | null;
      fraud_amount_change_pct: number | null;
    };
    fraud_by_type: {
      type: string;
      total_transactions: number;
      fraud_transactions: number;
      legitimate_transactions: number;
      fraud_amount: number;
    }[];
    recent_suspicious: TransactionRecord[];
  };
  dataset: DatasetStats;
  model: ModelStatus;
}

export interface ModelStatus {
  available: boolean;
  version: string;
  description: string;
  threshold: number;
  features: string[];
}

export interface HealthStatus {
  status: "healthy";
  model: ModelStatus;
  database: "connected";
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  fraud: number;
  legitimate: number;
}
