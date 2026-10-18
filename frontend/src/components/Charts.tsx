import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Coins, Donut, Layers3 } from "lucide-react";
import type { DatasetStats } from "../types";
import { Card, EmptyState } from "./ui";

const colors = {
  cyan: "#52d8f4",
  blue: "#647dff",
  green: "#4ed8a0",
  red: "#ff6981",
  grid: "rgba(151, 174, 207, .1)",
};

const tooltipStyle = {
  background: "#111a28",
  border: "1px solid rgba(151, 174, 207, .18)",
  borderRadius: 12,
  color: "#eaf0fa",
  fontSize: 12,
};

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="chart-empty">
      <EmptyState title="No source data" description={message} />
    </div>
  );
}

export function ClassificationChart({ dataset }: { dataset: DatasetStats }) {
  const rows = dataset.available
    ? [
        { name: "Legitimate", value: dataset.legitimate_transactions ?? 0 },
        { name: "Fraud", value: dataset.fraud_transactions ?? 0 },
      ]
    : [];
  return (
    <Card className="chart-card">
      <div className="chart-title">
        <span className="chart-icon"><Donut size={16} /></span>
        <div><h3>Dataset classification</h3><p>PaySim ground truth · source data</p></div>
      </div>
      {rows.length ? (
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height={228}>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={66} outerRadius={88} paddingAngle={4} stroke="none" animationDuration={700}>
                <Cell fill={colors.green} />
                <Cell fill={colors.red} />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => Number(value).toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong>{(dataset.total_transactions ?? 0).toLocaleString()}</strong>
            <span>source rows</span>
          </div>
          <div className="chart-legend">
            {rows.map((row, index) => (
              <div key={row.name}><i style={{ background: index ? colors.red : colors.green }} /><span>{row.name}</span><b>{row.value.toLocaleString()}</b></div>
            ))}
          </div>
        </div>
      ) : <ChartEmpty message={dataset.message ?? "Dataset metrics are unavailable."} />}
    </Card>
  );
}

export function ActivityChart({ dataset }: { dataset: DatasetStats }) {
  const data = dataset.activity_by_day?.map((row) => ({
    day: `Day ${row.day}`,
    transactions: row.total_transactions,
    fraud_rate: row.total_transactions
      ? (row.fraud_transactions / row.total_transactions) * 100
      : 0,
  })) ?? [];
  return (
    <Card className="chart-card activity-card">
      <div className="chart-title">
        <span className="chart-icon blue"><Activity size={16} /></span>
        <div><h3>Transaction activity</h3><p>Daily volume and fraud rate · PaySim source</p></div>
      </div>
      {data.length ? (
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colors.cyan} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.cyan} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#8290a4", fontSize: 10 }} minTickGap={28} />
          <YAxis yAxisId="volume" tickLine={false} axisLine={false} tick={{ fill: "#8290a4", fontSize: 10 }} tickFormatter={(value) => Number(value).toLocaleString()} />
          <YAxis yAxisId="rate" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#8290a4", fontSize: 10 }} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === "Fraud rate" ? `${Number(value).toFixed(2)}%` : Number(value).toLocaleString()} />
          <Legend verticalAlign="bottom" height={22} wrapperStyle={{ color: "#90a0b6", fontSize: 9 }} />
          <Area yAxisId="volume" type="monotone" dataKey="transactions" name="Transactions" stroke={colors.cyan} strokeWidth={2} fill="url(#activityFill)" animationDuration={800} />
          <Line yAxisId="rate" type="monotone" dataKey="fraud_rate" name="Fraud rate" stroke={colors.red} strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} animationDuration={800} />
        </ComposedChart>
        </ResponsiveContainer>
      ) : <ChartEmpty message={dataset.message ?? "No PaySim activity is available."} />}
    </Card>
  );
}

export function TypeChart({ dataset }: { dataset: DatasetStats }) {
  const data = dataset.fraud_by_type?.filter((item) => item.total_transactions > 0) ?? [];
  return (
    <Card className="chart-card">
      <div className="chart-title">
        <span className="chart-icon purple"><Layers3 size={16} /></span>
        <div><h3>Fraud by transaction type</h3><p>Observed labels by PaySim type</p></div>
      </div>
      {data.length ? (
        <ResponsiveContainer width="100%" height={238}>
          <BarChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 2 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fill: "#8290a4", fontSize: 10 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8290a4", fontSize: 10 }} tickFormatter={(value) => Number(value).toLocaleString()} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => Number(value).toLocaleString()} />
            <Bar dataKey="fraud_transactions" name="Fraud labels" fill={colors.red} radius={[5, 5, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      ) : <ChartEmpty message={dataset.message ?? "No PaySim type breakdown is available."} />}
    </Card>
  );
}

export function FraudAmountCard({ dataset }: { dataset: DatasetStats }) {
  const data = dataset.fraud_by_type?.filter((item) => item.fraud_amount > 0) ?? [];
  return (
    <Card className="chart-card amount-card">
      <div className="chart-title">
        <span className="chart-icon"><Coins size={16} /></span>
        <div><h3>Fraud amount analysis</h3><p>Known fraud amount · PaySim units</p></div>
      </div>
      {data.length ? (
        <>
          <div className="amount-total">{(dataset.total_fraud_amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="type" tickLine={false} axisLine={false} tick={{ fill: "#a7b3c6", fontSize: 11 }} width={75} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
              <Bar dataKey="fraud_amount" name="Labeled fraud amount" fill={colors.red} radius={[0, 5, 5, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </>
      ) : <ChartEmpty message={dataset.message ?? "No labeled fraud amounts are available."} />}
    </Card>
  );
}
