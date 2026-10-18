import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Copy,
  ExternalLink,
  Fingerprint,
  Gauge,
  RefreshCw,
  Server,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { HealthStatus } from "../types";
import { Badge, Button, Card, ErrorState, Skeleton } from "../components/ui";

export function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const check = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHealth(await api.health());
    } catch (reason) {
      setHealth(null);
      setError(reason instanceof Error ? reason.message : "Backend health check failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void check(); }, [check]);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <div className="settings-layout">
      <Card className="connection-card">
        <div className="connection-intro"><span className="connection-icon"><Server size={20} /></span><div><div className="eyebrow">BACKEND CONNECTION</div><h2>API status</h2><p>Connection and model availability are checked against the live API.</p></div><Button variant="secondary" onClick={() => void check()} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh</Button></div>
        {loading ? <div className="settings-skeleton"><Skeleton /><Skeleton /></div> : error ? <ErrorState message={error} /> : health && (
          <div className="connection-status-grid"><div><span className="setting-icon success"><CheckCircle2 size={16} /></span><div><strong>Backend health</strong><small>{api.baseUrl}/api/health</small></div><Badge tone="success">{health.status}</Badge></div><div><span className="setting-icon success"><Shield size={16} /></span><div><strong>Model availability</strong><small>Trained artifact loaded and ready</small></div><Badge tone="success">Online</Badge></div><div><span className="setting-icon blue"><Fingerprint size={16} /></span><div><strong>Prediction history</strong><small>SQLite · local application storage</small></div><Badge tone="info">{health.database}</Badge></div></div>
        )}
        {error && <div className="connection-warning"><CircleAlert size={15} />The dashboard cannot query live API data until the backend is reachable.</div>}
      </Card>

      <Card className="model-card">
        <div className="card-heading"><div><div className="eyebrow">MODEL REGISTRY</div><h2>Trained model</h2><p>Metadata read from the saved model bundle.</p></div>{health && <Badge tone="info">VERSION {health.model.version}</Badge>}</div>
        {loading ? <div className="settings-skeleton"><Skeleton /><Skeleton /><Skeleton /></div> : health && <div className="model-details">
          <div className="model-overview"><div className="model-emblem"><Shield size={22} /></div><div><strong>PaySim LightGBM classifier</strong><span>{health.model.description}</span></div><span className="model-runtime"><i /> Ready</span></div>
          <div className="model-stat-grid"><div><span>Classification cutoff</span><b>{(health.model.threshold * 100).toFixed(0)}%</b></div><div><span>Input features</span><b>{health.model.features.length}</b></div><div><span>Model version</span><b>{health.model.version}</b></div></div>
          <div className="feature-list-heading"><span>Saved feature order</span><span>TRAINING ARTIFACT</span></div>
          <div className="feature-list">{health.model.features.map((feature, index) => <div key={feature}><span>{String(index + 1).padStart(2, "0")}</span><code>{feature}</code><CheckCircle2 size={13} /></div>)}</div>
          <div className="model-note"><Gauge size={15} /><span>Only transaction type, amount and pre-transaction balances are required for scoring. PaySim step and account IDs are metadata only. Post-transaction balances and labels are excluded.</span></div>
        </div>}
      </Card>

      <Card className="preferences-card">
        <div className="card-heading"><div><div className="eyebrow">APPLICATION</div><h2>Workspace preferences</h2><p>Runtime configuration and helpful links.</p></div><SlidersHorizontal size={17} className="muted-icon" /></div>
        <div className="preference-row"><div><strong>API base URL</strong><span>Set with VITE_API_BASE_URL in frontend/.env.</span></div><code className="api-url">{api.baseUrl}</code><button className="icon-quiet" onClick={() => void copy(api.baseUrl)} title="Copy API URL"><Copy size={15} /></button></div>
        <div className="preference-row"><div><strong>API reference</strong><span>Interactive OpenAPI documentation.</span></div><a className="settings-link" href={`${api.baseUrl}/docs`} target="_blank" rel="noreferrer">Open Swagger <ExternalLink size={14} /></a></div>
        <div className="preference-row"><div><strong>Decision handling</strong><span>Use the score as a signal for analyst review.</span></div><Badge tone="warning">Human review</Badge></div>
        {health && <div className="model-note preference-note"><ArrowUpRight size={15} /><span>The saved cutoff yields a binary classification. Risk badges mirror that cutoff; no custom explanation or model tuning is performed by this interface.</span></div>}
      </Card>
    </div>
  );
}
