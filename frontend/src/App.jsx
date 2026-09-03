import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import CaseDrawer from "./components/CaseDrawer";
import Overview from "./pages/Overview";
import RecoveryCases from "./pages/RecoveryCases";
import Guardrails from "./pages/Guardrails";
import AuditTrail from "./pages/AuditTrail";
import { getRecoveryCase } from "./services/api";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handler = (event) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  async function openCase(caseId) {
    setSelectedCaseId(caseId);
    setCaseLoading(true);
    setCaseData(null);
    try {
      setCaseData(await getRecoveryCase(caseId));
    } catch (error) {
      setCaseData({ success: false, message: error.message });
    } finally {
      setCaseLoading(false);
    }
  }

  function closeCase() {
    setSelectedCaseId(null);
    setCaseData(null);
  }

  const navigate = (next) => {
    setPage(next);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <div className="desktop-sidebar"><Sidebar page={page} setPage={navigate} /></div>
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-sidebar-wrap" onClick={(e) => e.stopPropagation()}>
            <Sidebar page={page} setPage={navigate} mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <main className="main-shell">
        {page === "overview" && <Overview onSelectCase={openCase} onNavigate={navigate} />}
        {page === "cases" && <RecoveryCases onSelectCase={openCase} />}
        {page === "guardrails" && <Guardrails />}
        {page === "audit" && <AuditTrail />}
      </main>

      {selectedCaseId && (
        <CaseDrawer data={caseData} loading={caseLoading} onClose={closeCase} />
      )}
    </div>
  );
}
