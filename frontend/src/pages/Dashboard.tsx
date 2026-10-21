import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CircleHelp,
  Coins,
  Pause,
  Radar,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { DashboardStats, TransactionRecord } from "../types";
import { ActivityChart, ClassificationChart, FraudAmountCard, TypeChart } from "../components/Charts";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../components/ui";

const formatAmount = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  empty,
  trend,
  trendUnit = "%",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: string;
  empty?: boolean;
  trend?: number | null;
  trendUnit?: "%" | "pp";
}) {
  return (
    <Card className="kpi-card">
      <div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div>
      <strong className={empty ? "kpi-zero" : ""}>{value}</strong>
      <div className="kpi-foot"><span className={`trend-dot ${tone}`} /><span>{detail}</span>{trend !== undefined && trend !== null && <span className={`kpi-trend ${tone}`} title="Compared with the preceding 7-day period">{trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{Math.abs(trend).toFixed(1)}{trendUnit}<i>vs prior 7d</i></span>}</div>
    </Card>
  );
}

function SuspiciousRow({ item }: { item: TransactionRecord }) {
  return (
    <div className="suspicious-row">
      <span className="suspicious-icon"><ShieldAlert size={16} /></span>
      <div className="suspicious-main">
        <strong>{item.nameOrig || `Transaction #${item.id}`}</strong>
        <span>{item.type} <i>·</i> {new Date(item.created_at).toLocaleString()}</span>
      </div>
      <div className="suspicious-amount"><strong>{formatAmount(item.amount)}</strong><Badge tone="danger">{(item.fraud_probability * 100).toFixed(1)}% risk</Badge></div>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (page: "analysis" | "history") => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [feed, setFeed] = useState<TransactionRecord[]>([]);
  const [feedCounts, setFeedCounts] = useState({ fraud: 0, legitimate: 0 });
  const monitoringRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const processedRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await api.dashboard());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load dashboard analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("fraudguard:refresh", refresh);
    return () => window.removeEventListener("fraudguard:refresh", refresh);
  }, [load]);

  useEffect(() => () => {
    monitoringRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const fetchNextTransaction = useCallback(async () => {
    if (!monitoringRef.current) return;
    try {
      const transaction = await api.liveNext();
      setFeed((current) => [transaction, ...current].slice(0, 8));
      setFeedCounts((current) => ({
        fraud: current.fraud + Number(transaction.is_fraud),
        legitimate: current.legitimate + Number(!transaction.is_fraud),
      }));
      processedRef.current += 1;
      if (processedRef.current % 5 === 0) {
        try {
          setStats(await api.dashboard());
        } catch {
          setFeedError("Transactions are still being monitored, but dashboard totals could not be refreshed.");
        }
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not retrieve the next transaction.";
      setFeedError(message);
      monitoringRef.current = false;
      setMonitoring(false);
      return;
    }
    if (monitoringRef.current) {
      timerRef.current = window.setTimeout(() => void fetchNextTransaction(), 1200);
    }
  }, []);

  function toggleMonitoring() {
    if (monitoringRef.current) {
      monitoringRef.current = false;
      setMonitoring(false);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      return;
    }
    setFeedError("");
    monitoringRef.current = true;
    setMonitoring(true);
    void fetchNextTransaction();
  }

  if (error) return <ErrorState message={error} />;
  const live = stats?.live;
  const dataset = stats?.dataset;
  const amount = live ? formatAmount(live.total_fraud_amount) : "0";
  return (
    <div className="dashboard-stack">
      <div className="dashboard-banner">
        <div className="banner-glow" />
        <div className="banner-copy">
          <div className="banner-tag"><Radar size={13} /> LIVE RISK MONITORING</div>
          <h2>Every transaction.<br /><span>One clearer signal.</span></h2>
          <p>Score a transaction with the trained PaySim model or review your latest decisions.</p>
          <Button onClick={() => onNavigate("analysis")}><ShieldCheck size={16} /> Analyze a transaction <ArrowUpRight size={15} /></Button>
        </div>
        <div className="banner-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-ring ring-three" /><div className="orbit-core"><Shield size={37} /></div><span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" /></div>
        <div className="banner-model"><span className="online-dot" /> MODEL ONLINE <i>v{stats?.model.version ?? "—"}</i></div>
      </div>

      <div className="section-caption"><span>LIVE WORKSPACE</span><span className="caption-line" /><small>Rolling totals from saved predictions</small><span className="tooltip-mark" title="These figures include API predictions only, not the PaySim dataset labels."><CircleHelp size={13} /></span></div>
      <div className="kpi-grid">
        {loading ? Array.from({ length: 5 }, (_, i) => <Skeleton className="kpi-skeleton" key={i} />) : (
          <>
            <Kpi label="Total transactions" value={(live?.total_transactions ?? 0).toLocaleString()} detail="Predictions saved" icon={Activity} tone="blue" empty={!live?.total_transactions} trend={live?.weekly_trends.transactions_change_pct} />
            <Kpi label="Fraud detected" value={(live?.fraud_transactions ?? 0).toLocaleString()} detail="Classified as fraud" icon={ShieldAlert} tone="red" empty={!live?.fraud_transactions} trend={live?.weekly_trends.fraud_change_pct} />
            <Kpi label="Legitimate" value={(live?.legitimate_transactions ?? 0).toLocaleString()} detail="Classified as legitimate" icon={BadgeCheck} tone="green" empty={!live?.legitimate_transactions} trend={live?.weekly_trends.legitimate_change_pct} />
            <Kpi label="Fraud detection rate" value={`${((live?.fraud_rate ?? 0) * 100).toFixed(1)}%`} detail="Share flagged in live analyses" icon={ArrowUpRight} tone="purple" empty={!live?.total_transactions} trend={live?.weekly_trends.fraud_rate_change_pp} trendUnit="pp" />
            <Kpi label="Total fraud amount" value={amount} detail="PaySim amount units · flagged records" icon={Coins} tone="red" empty={!live?.fraud_transactions} trend={live?.weekly_trends.fraud_amount_change_pct} />
          </>
        )}
      </div>

      <Card className="live-monitor-card">
        <div className="card-heading">
          <div>
            <div className="eyebrow"><Radio size={12} /> LIVE TRANSACTION FEED</div>
            <h3>Transaction monitoring</h3>
            <p>Incoming transactions are scored and added to your history.</p>
          </div>
          <div className="live-monitor-actions">
            {monitoring && <Badge tone="success"><span className="live-pulse" /> Monitoring active</Badge>}
            <Button variant={monitoring ? "secondary" : "primary"} onClick={toggleMonitoring}>
              {monitoring ? <><Pause size={15} /> Pause monitoring</> : <><Radio size={15} /> Start monitoring</>}
            </Button>
          </div>
        </div>
        <div className="live-feed-summary">
          <span><b>{(feedCounts.fraud + feedCounts.legitimate).toLocaleString()}</b> processed</span>
          <span className="feed-fraud"><ShieldAlert size={13} /> <b>{feedCounts.fraud.toLocaleString()}</b> fraud</span>
          <span className="feed-legitimate"><BadgeCheck size={13} /> <b>{feedCounts.legitimate.toLocaleString()}</b> legitimate</span>
        </div>
        {feedError && <div className="form-error" role="alert">{feedError}</div>}
        {feed.length ? (
          <div className="table-scroll live-feed-table">
            <table className="data-table">
              <thead><tr><th>Transaction</th><th>Type</th><th>Amount</th><th>Origin</th><th>Destination</th><th>Risk score</th><th>Decision</th><th>Received</th></tr></thead>
              <tbody>{feed.map((item) => (
                <tr key={item.id}>
                  <td>#{item.id}</td>
                  <td><Badge tone="neutral">{item.type}</Badge></td>
                  <td>{formatAmount(item.amount)}</td>
                  <td>{item.nameOrig ?? "—"}</td>
                  <td>{item.nameDest ?? "—"}</td>
                  <td>{(item.fraud_probability * 100).toFixed(1)}%</td>
                  <td><Badge tone={item.is_fraud ? "danger" : "success"}>{item.prediction}</Badge></td>
                  <td>{new Date(item.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Monitoring is ready" description="Start monitoring to review transaction decisions as they arrive." />
        )}
      </Card>

      <div className="section-caption source-caption"><span>PAYSIM DATASET CONTEXT</span><span className="caption-line" /><small>Historical ground truth · separate from live predictions</small></div>
      {loading ? <div className="charts-grid"><Skeleton className="chart-skeleton" /><Skeleton className="chart-skeleton wide" /><Skeleton className="chart-skeleton" /><Skeleton className="chart-skeleton" /></div> : (
        <div className="charts-grid">
          {dataset && <ClassificationChart dataset={dataset} />}
          {dataset && <ActivityChart dataset={dataset} />}
          {dataset && <TypeChart dataset={dataset} />}
          {dataset && <FraudAmountCard dataset={dataset} />}
        </div>
      )}
      {dataset?.available && <div className="dataset-footnote"><Wallet size={14} /> Source file <b>{dataset.source}</b> · {dataset.total_transactions?.toLocaleString()} labeled rows · average amount {formatAmount(dataset.average_amount ?? 0)} units · ground-truth fraud rate {((dataset.fraud_rate ?? 0) * 100).toFixed(2)}% · fraud amount {formatAmount(dataset.total_fraud_amount ?? 0)} units. Dataset facts, not model detections.</div>}

      <div className="bottom-grid">
        <Card className="activity-feed">
          <div className="card-heading"><div><div className="eyebrow">LIVE QUEUE</div><h3>Recent suspicious transactions</h3></div><button className="text-button" onClick={() => onNavigate("history")}>View history <ArrowUpRight size={14} /></button></div>
          {loading ? <div className="feed-skeletons"><Skeleton /><Skeleton /><Skeleton /></div> : live?.recent_suspicious.length ? <div className="suspicious-list">{live.recent_suspicious.map((item) => <SuspiciousRow key={item.id} item={item} />)}</div> : <EmptyState title="No suspicious activity yet" description="Fraud-classified live predictions will appear here." action={<Button variant="secondary" onClick={() => onNavigate("analysis")}>Analyze transaction</Button>} />}
        </Card>
        <Card className="signal-card">
          <div className="chart-title"><span className="chart-icon blue"><ShieldCheck size={16} /></span><div><h3>Model signal</h3><p>Production artifact · version {stats?.model.version ?? "—"}</p></div></div>
          <div className="signal-metric"><span>Decision threshold</span><strong>{stats ? `${(stats.model.threshold * 100).toFixed(0)}%` : "—"}</strong></div>
          <div className="signal-meter"><span style={{ width: stats ? `${stats.model.threshold * 100}%` : "0%" }} /></div>
          <p className="signal-note">A score at or above the saved training threshold is classified as fraud. The score does not provide an explanation for an individual decision.</p>
          <div className="signal-divider" />
          <div className="signal-meta"><span>Classification</span><Badge tone="info">Binary · Fraud / Legitimate</Badge></div>
        </Card>
      </div>
      {dataset && !dataset.available && <div className="dataset-unavailable">{dataset.message}</div>}
    </div>
  );
}
