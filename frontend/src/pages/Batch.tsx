import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { api, type BatchResult } from "../api";
import { Badge, Button, Card, EmptyState } from "../components/ui";

const requiredColumns = ["type", "amount", "oldbalanceOrg", "oldbalanceDest"];
const formatAmount = (value: string) => {
  if (!value?.trim()) return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number)
    : "—";
};

export function Batch() {
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BatchResult | null>(null);

  async function selectFile(selected: File | undefined) {
    if (!selected) return;
    setError("");
    setResult(null);
    setPreview([]);
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file. Other formats are not supported.");
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setError("This file is larger than the 25 MB upload limit.");
      return;
    }
    const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
      Papa.parse<Record<string, string>>(selected, {
        header: true,
        preview: 6,
        skipEmptyLines: "greedy",
        complete: resolve,
        error: reject,
      });
    }).catch(() => null);
    if (!parsed) {
      setError("Could not read the CSV. Check that it uses UTF-8 encoding.");
      return;
    }
    if (parsed.errors.length) {
      setError(`CSV preview failed: ${parsed.errors[0].message}`);
      return;
    }
    const columns = parsed.meta.fields ?? [];
    const missing = requiredColumns.filter((column) => !columns.includes(column));
    if (missing.length) {
      setError(`Required column${missing.length > 1 ? "s" : ""} missing: ${missing.join(", ")}.`);
      return;
    }
    setFile(selected);
    setHeaders(columns);
    setPreview(parsed.data.slice(0, 5));
  }

  async function processFile() {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setError("");
    try {
      const response = await api.batch(file, setProgress);
      setResult(response);
      toast.success(`${response.summary.valid.toLocaleString()} transaction rows processed.`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Batch analysis failed.";
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "htvex-ai-results.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function removeFile() {
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setResult(null);
    setProgress(0);
    setError("");
    if (picker.current) picker.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="batch-layout">
      <Card className="batch-upload-card">
        <div className="form-card-heading"><span className="form-icon"><FileSpreadsheet size={18} /></span><div><h2>Upload transactions</h2><p>Submit a PaySim-compatible CSV for model scoring.</p></div></div>
        {!file ? (
          <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <input ref={picker} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(event) => void selectFile(event.target.files?.[0])} />
            <span className="upload-illustration"><Upload size={23} /></span>
            <strong>Drop your CSV file here</strong>
            <p>or <button className="text-button inline" onClick={() => picker.current?.click()}>browse files</button> from your device</p>
            <span className="file-spec">CSV only <i>·</i> Max 25 MB <i>·</i> UTF-8</span>
          </div>
        ) : (
          <div className="selected-file">
            <span className="file-icon"><FileSpreadsheet size={20} /></span>
            <div className="file-details"><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(1)} KB <i>·</i> {headers.length} columns <i>·</i> {preview.length ? `${preview.length}+ preview rows` : "ready"}</span></div>
            {!processing && <button className="icon-quiet" onClick={removeFile} aria-label="Remove file"><Trash2 size={16} /></button>}
          </div>
        )}
        {file && !result && <div className="required-chips"><span>Required fields</span>{requiredColumns.map((column) => <Badge key={column} tone="success"><Check size={11} /> {column}</Badge>)}</div>}
        {processing && <div className="upload-progress"><div><span>{progress < 100 ? "Uploading file…" : "Scoring transactions…"}</span><b>{progress < 100 ? `${progress}%` : "In progress"}</b></div><div className={`progress-track ${progress >= 100 ? "indeterminate" : ""}`}><span style={{ width: progress >= 100 ? "38%" : `${Math.max(progress, 4)}%` }} /></div><small>{progress < 100 ? "Upload progress. The server scores valid rows after the file arrives." : "The model scores all valid rows; invalid rows are retained in the downloadable results."}</small></div>}
        {error && <div className="form-error" role="alert"><AlertTriangle size={15} />{error}</div>}
        <div className="batch-action-row">
          <Button disabled={!file || processing} onClick={() => void processFile()}>{processing ? <><LoaderCircle className="spin" size={16} /> Processing…</> : <><ShieldAlert size={16} /> Run batch detection</>}</Button>
          {result && <Button variant="secondary" onClick={download}><ArrowDownToLine size={15} /> Download results</Button>}
        </div>
        <div className="batch-note"><ShieldAlert size={14} /><span>Only <b>CASH_OUT</b> and <b>TRANSFER</b> rows are in the trained model's scope. Unsupported types are marked invalid, not scored.</span></div>
      </Card>

      {result ? (
        <Card className="batch-results">
          <div className="section-heading result-heading"><div><div className="eyebrow">BATCH COMPLETE</div><h2>Analysis results</h2><p>Predictions are stored in history. Invalid records remain in the CSV with an error message.</p></div><Button variant="secondary" onClick={removeFile}><FileUp size={15} /> New upload</Button></div>
          <div className="batch-summary-grid">
            <div><span>Total rows</span><strong>{result.summary.total.toLocaleString()}</strong></div>
            <div className="success"><span>Valid & scored</span><strong>{result.summary.valid.toLocaleString()}</strong></div>
            <div className="danger"><span>Fraud detected</span><strong>{result.summary.fraud.toLocaleString()}</strong></div>
            <div className="neutral"><span>Legitimate</span><strong>{result.summary.legitimate.toLocaleString()}</strong></div>
            <div className="warning"><span>Invalid rows</span><strong>{result.summary.invalid.toLocaleString()}</strong></div>
          </div>
          <div className="table-scroll"><table className="data-table batch-table"><thead><tr><th>Row</th><th>Transaction type</th><th>Amount</th><th>Sender</th><th>Prediction</th><th>Probability</th><th>Validation</th></tr></thead><tbody>
            {result.rows.slice(0, 100).map((row, index) => {
              const invalid = Boolean(row.error);
              return <tr key={index}><td className="muted-cell">{index + 2}</td><td>{row.type || "—"}</td><td>{formatAmount(row.amount)}</td><td className="mono-cell">{row.nameOrig || "—"}</td><td>{invalid ? <span className="muted-cell">Not scored</span> : <Badge tone={row.is_fraud === "True" || row.is_fraud === "true" ? "danger" : "success"}>{row.prediction}</Badge>}</td><td>{row.fraud_probability ? `${(Number(row.fraud_probability) * 100).toFixed(1)}%` : "—"}</td><td>{invalid ? <span className="row-error">{row.error}</span> : <span className="row-valid"><CheckCircle2 size={13} /> Valid</span>}</td></tr>;
            })}
          </tbody></table></div>
          {result.rows.length > 100 && <div className="table-footnote">Showing first 100 rows. Download the results file to review all {result.rows.length.toLocaleString()} records.</div>}
        </Card>
      ) : (
        <div className="batch-preview-column">
          <Card className="preview-card">
            <div className="card-heading"><div><div className="eyebrow">FILE PREVIEW</div><h3>Check your data</h3></div>{file && <Badge tone="info">{preview.length}+ rows</Badge>}</div>
            {preview.length ? <div className="table-scroll preview-scroll"><table className="data-table"><thead><tr>{headers.slice(0, 5).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index}>{headers.slice(0, 5).map((header) => <td key={header} className={header === "amount" ? "amount-cell" : ""}>{row[header] || "—"}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="Your preview will appear here" description="Choose a CSV to inspect its columns and sample transactions before submitting." />}
          </Card>
          <Card className="requirements-card">
            <div className="chart-title"><span className="chart-icon blue"><CheckCircle2 size={16} /></span><div><h3>Required CSV columns</h3><p>Field names are case-sensitive.</p></div></div>
            <div className="column-list">{requiredColumns.map((column) => <div key={column}><span><Check size={13} /></span><code>{column}</code></div>)}</div>
            <div className="template-note">Amounts keep their PaySim source units; no currency is inferred. Optional <code>step</code>, <code>nameOrig</code>, and <code>nameDest</code> fields are saved as metadata. Post-transaction balances and fraud labels are never model inputs.</div>
          </Card>
        </div>
      )}
    </div>
  );
}
