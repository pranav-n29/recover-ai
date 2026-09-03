import { Activity, BrainCircuit, Database, FileClock, Grid2X2, ShieldCheck, Sparkles, X, Zap } from "lucide-react";

const items = [
  ["overview", "Overview", Grid2X2],
  ["cases", "Recovery Cases", FileClock],
  ["guardrails", "Guardrails", ShieldCheck],
  ["audit", "Audit Trail", Activity],
];

export default function Sidebar({ page, setPage, mobile = false, onClose }) {
  return (
    <aside className={`sidebar ${mobile ? "sidebar-mobile" : ""}`}>
      <div className="brand-block">
        <div className="brand-mark"><Zap size={18} fill="currentColor" /></div>
        <div>
          <div className="brand-name">RecoverAI</div>
          <div className="brand-sub">REVENUE RECOVERY OS</div>
        </div>
        {mobile && <button className="icon-button mobile-close" onClick={() => onClose?.()}><X size={18} /></button>}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Navigation</div>
        {items.map(([id, label, Icon]) => (
          <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
            {id === "decisions" && <span className="nav-live"><Sparkles size={10} /> AI</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-status">
        <div className="nav-label">System Status</div>
        <StatusRow icon={<BrainCircuit size={15} />} label="AI Engine" value="Online" />
        <StatusRow icon={<Database size={15} />} label="Database" value="Healthy" />
        <div className="version-row"><span>v2.4.1</span><span>Live sync</span></div>
      </div>
    </aside>
  );
}

function StatusRow({ icon, label, value }) {
  return <div className="status-row"><span className="status-icon">{icon}</span><span>{label}</span><strong><i />{value}</strong></div>;
}
