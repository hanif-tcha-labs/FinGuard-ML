import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleHelp,
  FileUp,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { api } from "../api";

export type PageId = "dashboard" | "analysis" | "batch" | "history" | "settings";

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analysis", label: "Transaction analysis", icon: ShieldAlert },
  { id: "batch", label: "Batch detection", icon: FileUp },
  { id: "history", label: "Transaction history", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

const titles: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: "Command center", subtitle: "A clear view of your fraud operations." },
  analysis: { title: "Transaction analysis", subtitle: "Score a transaction with the trained PaySim model." },
  batch: { title: "Batch detection", subtitle: "Review a CSV of transactions in one secure pass." },
  history: { title: "Transaction history", subtitle: "Search and review every live prediction." },
  settings: { title: "Workspace settings", subtitle: "Model and API connection details." },
};

export function Layout({
  active,
  onNavigate,
  children,
}: {
  active: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = titles[active];
  const navigate = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };
  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Shield size={20} strokeWidth={2.2} /></span>
          <span className="brand-copy"><b>HTVEX AI</b><small>INTELLIGENCE PLATFORM</small></span>
          <button className="mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">H</span>
          <div><strong>HTVEX AI workspace</strong><small>Risk operations</small></div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(id)} className={`nav-item ${active === id ? "active" : ""}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {active === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-card">
            <span className="secure-icon"><Shield size={15} /></span>
            <strong>Protected workspace</strong>
            <p>Predictions are stored locally in your SQLite history.</p>
            <button onClick={() => navigate("settings")}>System status <ArrowUpRight size={13} /></button>
          </div>
          <button className="help-link" onClick={() => window.open(`${api.baseUrl}/docs`, "_blank", "noopener,noreferrer")}>
            <CircleHelp size={16} /><span>API documentation</span><ArrowUpRight size={13} />
          </button>
          <div className="profile-row">
            <span className="profile-avatar">HT</span>
            <div><strong>Fraud analyst</strong><small>Workspace operator</small></div>
            <span className="online-dot" title="Local workspace" />
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><b>{title.title}</b></div>
          <div className="topbar-actions">
            <span className="date-label">{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date())}</span>
            <span className="top-divider" />
            <button className="top-search" onClick={() => navigate("history")} aria-label="Search transaction history"><Search size={16} /><span>Search history</span><kbd>↵</kbd></button>
            <span className="profile-avatar top-avatar">HT</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="live-pulse" /> FRAUD INTELLIGENCE</div><h1>{title.title}</h1><p>{title.subtitle}</p></div>
            {active === "dashboard" && <button className="button button-secondary refresh-button" onClick={() => window.dispatchEvent(new Event("fraudguard:refresh"))}><BarChart3 size={15} /> Refresh analytics</button>}
          </div>
          {children}
        </div>
        <footer className="footer"><span><span className="footer-dot" /> HTVEX AI</span><span>PaySim LightGBM · Model 1.0</span><span>Model scores are risk signals, not financial advice.</span></footer>
      </main>
    </div>
  );
}
