import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { PredictionInput, PredictionResult, TransactionType } from "../types";
import { Badge, Button, Card, Field } from "../components/ui";

type FormValues = {
  type: TransactionType;
  amount: string;
  oldbalanceOrg: string;
  oldbalanceDest: string;
  step: string;
  nameOrig: string;
  nameDest: string;
};

const initial: FormValues = {
  type: "TRANSFER",
  amount: "",
  oldbalanceOrg: "",
  oldbalanceDest: "",
  step: "",
  nameOrig: "",
  nameDest: "",
};

const formatAmount = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

export function Analysis() {
  const [form, setForm] = useState<FormValues>(initial);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [analyzedInput, setAnalyzedInput] = useState<PredictionInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof FormValues, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    const input: PredictionInput = {
      type: form.type,
      amount: Number(form.amount),
      oldbalanceOrg: Number(form.oldbalanceOrg),
      oldbalanceDest: Number(form.oldbalanceDest),
      ...(form.step ? { step: Number(form.step) } : {}),
      ...(form.nameOrig ? { nameOrig: form.nameOrig.trim() } : {}),
      ...(form.nameDest ? { nameDest: form.nameDest.trim() } : {}),
    };
    setLoading(true);
    try {
      const prediction = await api.predict(input);
      setResult(prediction);
      setAnalyzedInput(input);
      toast.success(`Transaction classified as ${prediction.prediction.toLowerCase()}.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Prediction request failed.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(initial);
    setResult(null);
    setAnalyzedInput(null);
    setError("");
  }

  const percent = result ? result.fraud_probability * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  return (
    <div className="analysis-layout">
      <Card className="analysis-form-card">
        <div className="form-card-heading"><span className="form-icon"><Sparkles size={18} /></span><div><h2>Transaction details</h2><p>Enter the pre-transaction values used by the trained model.</p></div></div>
        <form className="transaction-form" onSubmit={submit}>
          <div className="form-section-label"><span>01</span> TRANSACTION</div>
          <div className="form-grid">
            <Field label="Transaction type" hint="The trained model is scoped to these two PaySim types.">
              <select value={form.type} onChange={(event) => update("type", event.target.value)}>
                <option value="TRANSFER">Transfer</option><option value="CASH_OUT">Cash out</option>
              </select>
            </Field>
            <Field label="Amount" hint="PaySim amount units; the source dataset does not specify a currency.">
              <input required type="number" min="0" step="any" value={form.amount} onChange={(event) => update("amount", event.target.value)} placeholder="e.g. 25,000.00" />
            </Field>
          </div>
          <div className="form-section-label"><span>02</span> BALANCES BEFORE TRANSACTION</div>
          <div className="form-grid">
            <Field label="Sender balance" hint="oldbalanceOrg from the PaySim record.">
              <input required type="number" min="0" step="any" value={form.oldbalanceOrg} onChange={(event) => update("oldbalanceOrg", event.target.value)} placeholder="e.g. 30,000.00" />
            </Field>
            <Field label="Recipient balance" hint="oldbalanceDest from the PaySim record.">
              <input required type="number" min="0" step="any" value={form.oldbalanceDest} onChange={(event) => update("oldbalanceDest", event.target.value)} placeholder="e.g. 8,500.00" />
            </Field>
          </div>
          <div className="form-section-label optional-label"><span>03</span> REFERENCE DETAILS <small>OPTIONAL · STORED WITH HISTORY ONLY</small></div>
          <div className="form-grid metadata-grid">
            <Field label="Simulation step" hint="PaySim hour index. Not used by this model.">
              <input type="number" min="1" step="1" value={form.step} onChange={(event) => update("step", event.target.value)} placeholder="e.g. 245" />
            </Field>
            <Field label="Sender account" hint="Optional transaction reference.">
              <input value={form.nameOrig} onChange={(event) => update("nameOrig", event.target.value)} placeholder="e.g. C123456789" maxLength={128} />
            </Field>
            <Field label="Recipient account" hint="Optional transaction reference.">
              <input value={form.nameDest} onChange={(event) => update("nameDest", event.target.value)} placeholder="e.g. C987654321" maxLength={128} />
            </Field>
          </div>
          {error && <div className="form-error" role="alert"><ShieldAlert size={15} />{error}</div>}
          <div className="form-actions"><Button type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Scoring transaction…</> : <>Analyze transaction <ArrowRight size={16} /></>}</Button><span><CircleHelp size={14} /> Predictions are saved to local history.</span></div>
        </form>
      </Card>

      <div className="analysis-aside">
        {result && analyzedInput ? (
          <Card className={`result-card ${result.is_fraud ? "result-fraud" : "result-clear"}`}>
            <div className="result-topline"><span className="eyebrow">MODEL ASSESSMENT</span><button className="icon-quiet" onClick={reset} title="Start a new analysis"><RotateCcw size={15} /></button></div>
            <div className={`result-status-icon ${result.is_fraud ? "fraud" : "clear"}`}>{result.is_fraud ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}</div>
            <h2>{result.is_fraud ? "Fraud signal detected" : "Transaction appears legitimate"}</h2>
            <p className="result-subtitle">{result.is_fraud ? "This transaction meets the model's saved fraud classification threshold." : "This transaction falls below the model's saved fraud classification threshold."}</p>
            <div className="gauge-wrap">
              <svg className="probability-gauge" viewBox="0 0 112 112" role="img" aria-label={`Fraud probability ${percent.toFixed(1)} percent`}>
                <circle cx="56" cy="56" r="45" className="gauge-track" />
                <circle cx="56" cy="56" r="45" className={`gauge-value ${result.is_fraud ? "fraud" : "clear"}`} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - result.fraud_probability)} />
              </svg>
              <div className="gauge-label"><strong>{percent.toFixed(1)}<small>%</small></strong><span>fraud probability</span></div>
            </div>
            <div className="result-metrics"><div><span>Risk level</span><Badge tone={result.is_fraud ? "danger" : "success"}>{result.risk_level}</Badge></div><div><span>Decision threshold</span><strong>{(result.threshold * 100).toFixed(0)}%</strong></div><div><span>Model version</span><strong>{result.model_version}</strong></div></div>
            <div className="result-divider" />
            <div className="summary-title"><CheckCircle2 size={15} /> Transaction summary</div>
            <div className="result-summary"><div><span>Type</span><b>{analyzedInput.type.replace("_", " ")}</b></div><div><span>Amount · PaySim units</span><b>{formatAmount(analyzedInput.amount)}</b></div><div><span>Sender balance · PaySim units</span><b>{formatAmount(analyzedInput.oldbalanceOrg)}</b></div><div><span>Recipient balance · PaySim units</span><b>{formatAmount(analyzedInput.oldbalanceDest)}</b></div></div>
            <p className="no-explainability">Probability is a model score, not an explanation. This artifact does not return per-transaction reasons.</p>
            <Button variant="secondary" className="full-button" onClick={reset}><RotateCcw size={15} /> Analyze another transaction</Button>
          </Card>
        ) : (
          <Card className="analysis-placeholder">
            <div className="placeholder-art"><span className="placeholder-ring ring-a" /><span className="placeholder-ring ring-b" /><span className="placeholder-shield"><ShieldCheck size={31} /></span><i className="placeholder-spark spark-a" /><i className="placeholder-spark spark-b" /></div>
            <div className="eyebrow">READY FOR ANALYSIS</div>
            <h3>Your next decision,<br />with a clearer signal.</h3>
            <p>Submit a transaction to see the model's fraud probability, saved threshold, and classification.</p>
            <div className="placeholder-points"><span><CheckCircle2 size={14} /> Saved model features</span><span><CheckCircle2 size={14} /> Local prediction history</span></div>
            <span className="placeholder-version">LIGHTGBM · MODEL 1.0</span>
          </Card>
        )}
        <div className="scope-note"><CircleHelp size={15} /><span><b>Model scope</b> Only CASH_OUT and TRANSFER are supported. Sender/recipient IDs and step are stored for reference and do not influence this model's score.</span></div>
      </div>
    </div>
  );
}
