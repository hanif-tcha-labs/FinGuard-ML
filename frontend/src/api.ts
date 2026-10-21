import Papa from "papaparse";
import type {
  DashboardStats,
  HealthStatus,
  PredictionInput,
  PredictionResult,
  TransactionPage,
  TransactionRecord,
} from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(
      "Could not reach HTVEX AI API. Check that the backend is running and the API URL is correct.",
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail ?? body);
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export interface HistoryFilters {
  page?: number;
  page_size?: number;
  status?: string;
  transaction_type?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface BatchResult {
  blob: Blob;
  rows: Record<string, string>[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    fraud: number;
    legitimate: number;
  };
}

export const api = {
  baseUrl: API_BASE,
  health: () => request<HealthStatus>("/api/health"),
  dashboard: () => request<DashboardStats>("/api/dashboard/stats"),
  liveNext: () =>
    request<TransactionRecord>("/api/live/next", { method: "POST" }),
  predict: (input: PredictionInput) =>
    request<PredictionResult>("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  transactions: (filters: HistoryFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return request<TransactionPage>(
      `/api/transactions${params.size ? `?${params.toString()}` : ""}`,
    );
  },
  transaction: (id: number) =>
    request<TransactionRecord>(`/api/transactions/${id}`),
  batch: (file: File, onProgress?: (progress: number) => void) =>
    new Promise<BatchResult>((resolve, reject) => {
      const body = new FormData();
      body.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/predict/batch`);
      xhr.responseType = "blob";
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onerror = () =>
        reject(
          new Error(
            "Could not reach HTVEX AI API. Check that the backend is running and the API URL is correct.",
          ),
        );
      xhr.onload = async () => {
        const blob = xhr.response as Blob;
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const body = JSON.parse(await blob.text());
            reject(
              new Error(
                typeof body.detail === "string"
                  ? body.detail
                  : JSON.stringify(body.detail ?? body),
              ),
            );
          } catch {
            reject(new Error(xhr.statusText || `Request failed (${xhr.status})`));
          }
          return;
        }
        try {
          const parsed = Papa.parse<Record<string, string>>(
            await blob.text(),
            { header: true, skipEmptyLines: "greedy" },
          );
          if (parsed.errors.length) {
            reject(new Error("The API returned a results file that could not be read."));
            return;
          }
          const header = (name: string) =>
            Number(xhr.getResponseHeader(`X-${name}`) ?? 0);
          resolve({
            blob,
            rows: parsed.data,
            summary: {
              total: header("Total-Rows"),
              valid: header("Valid-Rows"),
              invalid: header("Invalid-Rows"),
              fraud: header("Fraud-Count"),
              legitimate: header("Legitimate-Count"),
            },
          });
        } catch {
          reject(new Error("The API returned an unreadable CSV results file."));
        }
      };
      xhr.send(body);
    }),
};
