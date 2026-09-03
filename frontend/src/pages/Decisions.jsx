import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { getDashboardCases } from "../services/api";

const pretty = (v) =>
  String(v || "—").replaceAll("_", " ");

function getConfidence(c) {
  return Number(
    c?.confidence ??
    c?.agentConfidence ??
    0
  );
}

function getCustomer(c) {
  return (
    c?.customerName ||
    c?.customer ||
    `Customer #${c?.id}`
  );
}
function isGuardrailBlocked(c) {
  return (
    c?.guardrailApproved === false ||
    String(c?.guardrailStatus || "").toUpperCase() === "BLOCKED" ||
    String(c?.guardrailDecision || "").toUpperCase() === "BLOCKED" ||
    String(c?.status || "").toUpperCase().includes("BLOCKED")
  );
}

function RiskBadge({ value }) {
  return (
    <span
      className={`badge risk-${String(
        value || ""
      ).toLowerCase()}`}
    >
      <i />
      {value || "UNKNOWN"}
    </span>
  );
}

function StatusBadge({ value }) {
  return (
    <span
      className={`badge status-${String(
        value || ""
      )
        .toLowerCase()
        .replaceAll("_", "-")}`}
    >
      {pretty(value)}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const v = Math.max(
    0,
    Math.min(100, getConfidence(value) * 100)
  );

  return (
    <div className="confidence-cell">
      <span className="confidence-track">
        <i
          style={{
            width: `${v}%`,
          }}
        />
      </span>

      <b>{Math.round(v)}%</b>
    </div>
  );
}

export default function Decisions({ onSelectCase }) {
  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCases() {
    try {
      setLoading(true);
      setError("");

      const data = await getDashboardCases();

      if (!data.success) {
        throw new Error(
          data.message || "Failed to load AI decisions"
        );
      }

      setCases(data.cases || []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Could not load AI decisions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  /*
   * Only cases where AI has actually made
   * a decision are shown here.
   */
  const decided = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.agentDecision &&
          c.agentDecision !== "PENDING_AI_REVIEW"
      ),
    [cases]
  );

  /*
   * Get all actions dynamically from backend.
   */
  const actions = useMemo(
    () => [
      "ALL",
      ...new Set(
        decided
          .map((c) => c.agentDecision)
          .filter(Boolean)
      ),
    ],
    [decided]
  );

  /*
   * Search + action filter
   */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return decided.filter((c) => {
      const customer =
        getCustomer(c).toLowerCase();

      const matchesSearch =
        !q ||
        String(c.id)
          .toLowerCase()
          .includes(q) ||
        customer.includes(q) ||
        String(c.agentDecision || "")
          .toLowerCase()
          .includes(q);

      const matchesAction =
        action === "ALL" ||
        c.agentDecision === action;

      return (
        matchesSearch &&
        matchesAction
      );
    });
  }, [
    decided,
    search,
    action,
  ]);

  /*
   * REAL average confidence.
   *
   * Backend returns:
   * confidence: 0.9
   *
   * Therefore:
   * 0.9 -> 90%
   */
  const avg = useMemo(() => {
    if (!decided.length) return 0;

    const total = decided.reduce(
      (sum, c) =>
        sum + getConfidence(c),
      0
    );

    return Math.round(
      (total / decided.length) * 100
    );
  }, [decided]);

  /*
   * Cases blocked by guardrails.
   */
const blocked = useMemo(() => {
  return decided.filter(isGuardrailBlocked).length;
}, [decided]);

  /*
   * Policy compliance.
   */
  const compliance = decided.length
    ? Math.round(
        ((decided.length - blocked) /
          decided.length) *
          100
      )
    : 0;

  /*
   * Confidence distribution.
   */
  const band = (min, max) =>
    decided.filter((c) => {
      const v = getConfidence(c);

      return (
        v >= min &&
        v <= max
      );
    }).length;

  return (
    <div className="page">

      {/* ================= HEADER ================= */}

      <div className="page-header">
        <div>
          <div className="eyebrow-row">
            <h1>AI Decisions</h1>

            <span className="ai-pill">
              <Sparkles size={11} />
              RecoverAI
            </span>
          </div>

          <p>
            Every AI recommendation with reasoning,
            confidence and guardrail outcome.
          </p>
        </div>
      </div>

      {/* ================= ERROR ================= */}

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      {/* ================= SUMMARY ================= */}

      <div className="section-label">
        AI engine summary
      </div>

      <div className="metric-grid four">

        <Metric
          label="Cases analyzed"
          value={cases.length}
          sub="backend cases"
          icon={<BrainCircuit />}
          tone="purple"
        />

        <Metric
          label="Decisions made"
          value={decided.length}
          sub="with action"
          icon={<CheckCircle2 />}
          tone="blue"
        />

        <Metric
          label="Policy compliance"
          value={`${compliance}%`}
          sub={`${blocked} blocked`}
          icon={<ShieldAlert />}
          tone="green"
        />

        <Metric
          label="Avg. confidence"
          value={`${avg}%`}
          sub="across final decisions"
          icon={<Sparkles />}
          tone="blue"
        />

      </div>

      {/* ================= ANALYTICS ================= */}

      <div className="grid-two">

        {/* DECISIONS BY ACTION */}

        <section className="card">

          <CardHead
            title="Decisions by action"
            subtitle="Live breakdown from backend cases"
            accent="purple"
          />

          <div className="bar-list spacious">

            {actions
              .filter((a) => a !== "ALL")
              .map((a) => {

                const count =
                  decided.filter(
                    (c) =>
                      c.agentDecision === a
                  ).length;

                const percentage =
                  decided.length
                    ? (count /
                        decided.length) *
                      100
                    : 0;

                return (
                  <div
                    className="bar-row"
                    key={a}
                  >

                    <div>
                      <span>
                        {pretty(a)}
                      </span>

                      <strong>
                        {count}
                      </strong>
                    </div>

                    <span className="confidence-track">
                      <i
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </span>

                  </div>
                );
              })}

            {!decided.length && (
              <div className="empty-state">
                No AI decisions recorded yet.
              </div>
            )}

          </div>
        </section>

        {/* CONFIDENCE DISTRIBUTION */}

        <section className="card">

          <CardHead
            title="Confidence distribution"
            subtitle={`AI confidence across ${decided.length} final decisions`}
            accent="blue"
          />

          <div className="confidence-list spacious">

            {[
              [0.9, 1, "90–100%"],
              [0.75, 0.899, "75–89%"],
              [0.6, 0.749, "60–74%"],
              [0, 0.599, "<60%"],
            ].map(
              ([min, max, label]) => {

                const count =
                  band(min, max);

                const percentage =
                  decided.length
                    ? (count /
                        decided.length) *
                      100
                    : 0;

                return (
                  <div
                    className="confidence-row"
                    key={label}
                  >

                    <div className="confidence-mini">
                      <span>
                        {label}
                      </span>
                    </div>

                    <span>
                      {label}
                    </span>

                    <div className="confidence-track">
                      <i
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {count}
                    </strong>

                  </div>
                );
              }
            )}

          </div>
        </section>

      </div>

      {/* ================= SEARCH / FILTER ================= */}

      <div className="toolbar">

        <div className="search">

          <Search size={16} />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search by ID, customer or action…"
          />

        </div>

        <div className="filter-group">

          {actions.map((a) => (
            <button
              className={
                action === a
                  ? "active"
                  : ""
              }
              key={a}
              onClick={() =>
                setAction(a)
              }
            >
              {pretty(a)}
            </button>
          ))}

        </div>

      </div>

      {/* ================= DECISION LIST ================= */}

      {loading ? (

        <div className="page-state">
          <div className="spinner" />
          Loading AI decisions…
        </div>

      ) : (

        <div className="decision-list">

          {filtered.map((c) => {

            const confidence =
              getConfidence(c);

            const customer =
              getCustomer(c);

          const isBlocked = isGuardrailBlocked(c);

            return (
              <button
                className="decision-card"
                key={c.id}
                onClick={() =>
                  onSelectCase(c.id)
                }
              >

                {/* TOP */}

                <div className="decision-card-top">

                  <div>

                    <b className="linkish">
                      #{c.id}
                    </b>

                    <span>
                      {customer}
                    </span>

                    <RiskBadge
                      value={c.riskLevel}
                    />

                  </div>

                  <div>

                    <StatusBadge
                      value={c.status}
                    />

                    <strong>
                      ₹
                      {Number(
                        c.amount || 0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                  </div>

                </div>

                {/* DETAILS */}

                <div className="decision-card-grid">

                  <div>

                    <small>
                      AI action
                    </small>

                    <strong className="action-purple">
                      {pretty(
                        c.agentDecision
                      )}
                    </strong>

                  </div>

                  <div>

                    <small>
                      Confidence
                    </small>

                    <ConfidenceBar
                      value={c}
                    />

                  </div>

                  <div>

                    <small>
                      Guardrail
                    </small>

                  <strong
  className={
    isBlocked
      ? "danger-text"
      : "success-text"
  }
>
  {isBlocked ? "✕ BLOCKED" : "✓ APPROVED"}
</strong>

                  </div>

                </div>

                {/* REASONING */}

                {(c.agentReason ||
                  c.riskReason ||
                  c.reason ||
                  c.diagnosis) && (

                  <div className="decision-reason">

                    <small>
                      AI reasoning
                    </small>

                    <p>
                      {c.agentReason ||
                        c.riskReason ||
                        c.reason ||
                        c.diagnosis}
                    </p>

                  </div>

                )}

              </button>
            );
          })}

          {!filtered.length && (
            <div className="empty-state">
              No decisions match the current filters.
            </div>
          )}

        </div>
      )}

    </div>
  );
}

/* ================= METRIC ================= */

function Metric({
  label,
  value,
  sub,
  icon,
  tone,
}) {
  return (
    <div
      className={`metric-card tone-${tone}`}
    >
      <div className="metric-icon">
        {icon}
      </div>

      <div className="micro-label">
        {label}
      </div>

      <strong>
        {value}
      </strong>

      <span>
        {sub}
      </span>
    </div>
  );
}

/* ================= CARD HEADER ================= */

function CardHead({
  title,
  subtitle,
  accent,
}) {
  return (
    <div className="card-head">

      <div className="card-title-wrap">

        <i
          className={`accent accent-${accent}`}
        />

        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

      </div>

    </div>
  );
}