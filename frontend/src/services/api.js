const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

export const getDashboardSummary = () => request("/api/dashboard/summary");
export const getDashboardCases = () => request("/api/dashboard/cases");
export const getRecoveryCase = (caseId) => request(`/api/recovery/cases/${caseId}`);
export const getGuardrails = () => request("/api/guardrails");
export const getAuditLogs = (limit = 100) => request(`/api/audit?limit=${limit}`);
export const runRecoveryAgent = (limit = 5) => request("/api/recovery/run-agent", {
  method: "POST",
  body: JSON.stringify({ limit }),
});
