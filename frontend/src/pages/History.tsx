import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  ArrowUpWideNarrow,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, type HistoryFilters } from "../api";
import type { TransactionPage, TransactionRecord } from "../types";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../components/ui";

const formatAmount = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export function History() {
  const [filters, setFilters] = useState<HistoryFilters>({ page: 1, page_size: 10, sort_by: "created_at", sort_order: "desc" });
  const [data, setData] = useState<TransactionPage | null>(null);
  const [selected, setSelected] = useState<TransactionRecord | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api.transactions({ ...filters, q: search.trim() || undefined }).then((response) => {
      if (alive) setData(response);
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : "Could not load transactions.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filters, search]);

  const setFilter = (key: keyof HistoryFilters, value: string | number | undefined) =>
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "page" ? {} : { page: 1 }),
    }));

  return (
    <div className="history-stack">
      <Card className="history-toolbar">
        <div className="history-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setFilters((current) => ({ ...current, page: 1 })); }} placeholder="Search ID, sender, recipient or type…" /><kbd>/</kbd></div>
        <div className="history-filters">
          <label><span>Classification</span><select value={filters.status ?? ""} onChange={(event) => setFilter("status", event.target.value || undefined)}><option value="">All predictions</option><option value="Fraud">Fraud</option><option value="Legitimate">Legitimate</option></select><ChevronDown size={13} /></label>
          <label><span>Transaction</span><select value={filters.transaction_type ?? ""} onChange={(event) => setFilter("transaction_type", event.target.value || undefined)}><option value="">All types</option><option value="TRANSFER">Transfer</option><option value="CASH_OUT">Cash out</option></select><ChevronDown size={13} /></label>
          <label className="date-filter"><span>From</span><input aria-label="Filter from date" type="date" value={filters.date_from ?? ""} onChange={(event) => setFilter("date_from", event.target.value || undefined)} /></label>
          <label className="date-filter"><span>To</span><input aria-label="Filter to date" type="date" value={filters.date_to ?? ""} onChange={(event) => setFilter("date_to", event.target.value || undefined)} /></label>
          <label><span>Sort by</span><select value={filters.sort_by ?? "created_at"} onChange={(event) => setFilter("sort_by", event.target.value)}><option value="created_at">Date</option><option value="amount">Amount</option><option value="fraud_probability">Probability</option><option value="type">Type</option></select><ChevronDown size={13} /></label>
          <button className="sort-direction" onClick={() => setFilter("sort_order", filters.sort_order === "asc" ? "desc" : "asc")} title="Toggle sort order">{filters.sort_order === "asc" ? <ArrowUpWideNarrow size={16} /> : <ArrowDownWideNarrow size={16} />}</button>
        </div>
      </Card>

      <Card className="history-table-card">
        <div className="table-card-heading"><div><div className="eyebrow">PREDICTION LOG</div><h2>Analyzed transactions</h2><p>{loading ? "Loading saved predictions…" : `${(data?.total ?? 0).toLocaleString()} records in local history`}</p></div><span className="history-count">{data?.total ?? 0} TOTAL</span></div>
        {error ? <ErrorState message={error} /> : loading ? <div className="table-loading">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div> : data?.items.length ? (
          <>
            <div className="table-scroll"><table className="data-table history-table"><thead><tr><th>Transaction ID</th><th>Type</th><th>Amount</th><th>Sender</th><th>Recipient</th><th>Prediction</th><th>Probability</th><th>Date</th></tr></thead><tbody>
              {data.items.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="clickable-row"><td className="id-cell">FG-{String(row.id).padStart(6, "0")}</td><td><span className={`type-dot ${row.type === "TRANSFER" ? "transfer" : "cashout"}`} />{row.type.replace("_", " ")}</td><td className="amount-cell">{formatAmount(row.amount)}</td><td className="mono-cell">{row.nameOrig || "—"}</td><td className="mono-cell">{row.nameDest || "—"}</td><td><Badge tone={row.is_fraud ? "danger" : "success"}>{row.prediction}</Badge></td><td><div className="probability-cell"><span className={row.is_fraud ? "probability-high" : ""}>{(row.fraud_probability * 100).toFixed(1)}%</span><i><span style={{ width: `${row.fraud_probability * 100}%` }} /></i></div></td><td className="date-cell">{new Date(row.created_at).toLocaleString()}</td></tr>)}
            </tbody></table></div>
            <div className="pagination"><span>Showing <b>{(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)}</b> of <b>{data.total}</b></span><div><Button variant="secondary" disabled={data.page <= 1} onClick={() => setFilter("page", data.page - 1)}><ArrowLeft size={14} /> Previous</Button><span className="page-number">{data.page} / {Math.max(data.total_pages, 1)}</span><Button variant="secondary" disabled={data.page >= data.total_pages} onClick={() => setFilter("page", data.page + 1)}>Next <ArrowRight size={14} /></Button></div></div>
          </>
        ) : <EmptyState title="No transactions found" description={search || filters.status || filters.transaction_type ? "Try changing the search or filters." : "Run a prediction or batch analysis to build your local history."} action={search || filters.status || filters.transaction_type ? <Button variant="secondary" onClick={() => { setSearch(""); setFilters({ page: 1, page_size: 10, sort_by: "created_at", sort_order: "desc" }); }}>Clear filters</Button> : undefined} />}
      </Card>

      {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><div className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><div className="eyebrow">TRANSACTION DETAIL</div><h2 id="modal-title">FG-{String(selected.id).padStart(6, "0")}</h2></div><button className="icon-quiet" onClick={() => setSelected(null)} aria-label="Close detail"><X size={18} /></button></div>
        <div className="modal-status"><Badge tone={selected.is_fraud ? "danger" : "success"}>{selected.prediction}</Badge><span>Probability {(selected.fraud_probability * 100).toFixed(2)}%</span><span>Risk {selected.risk_level}</span></div>
        <div className="modal-fields">{[["Transaction type", selected.type], ["Amount · PaySim units", formatAmount(selected.amount)], ["Sender", selected.nameOrig || "Not provided"], ["Recipient", selected.nameDest || "Not provided"], ["Sender balance · PaySim units", formatAmount(selected.oldbalanceOrg)], ["Recipient balance · PaySim units", formatAmount(selected.oldbalanceDest)], ["PaySim step", selected.step?.toString() ?? "Not provided"], ["Analyzed at", new Date(selected.created_at).toLocaleString()]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <p className="modal-note">This detail shows the saved model score and submitted transaction values. No per-transaction explanation is generated.</p>
      </div></div>}
    </div>
  );
}
