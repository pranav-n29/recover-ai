import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { getDashboardCases } from "../services/api";

/* =========================================================
   HELPERS
========================================================= */

const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const pretty = (v) =>
  String(v || "—").replaceAll("_", " ");

/*
 * Backend may provide either:
 *
 * confidence
 * agentConfidence
 *
 * Example:
 * 0.8 -> 80%
 */
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

/*
 * Detect a guardrail-blocked case safely.
 *
 * Different backend responses may expose the
 * information under different fields.
 */
function isGuardrailBlocked(c) {
  return (
    c?.guardrailApproved === false ||
    String(c?.guardrailStatus || "").toUpperCase() ===
      "BLOCKED" ||
    String(c?.guardrailDecision || "").toUpperCase() ===
      "BLOCKED" ||
    String(c?.status || "")
      .toUpperCase()
      .includes("BLOCKED")
  );
}

/* =========================================================
   BADGES
========================================================= */

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

/* =========================================================
   CONFIDENCE
========================================================= */

function ConfidenceBar({ value }) {
  const v = Math.max(
    0,
    Math.min(
      100,
      getConfidence(value) * 100
    )
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

/* =========================================================
   MAIN PAGE
========================================================= */

export default function RecoveryCases({
  onSelectCase,
}) {
  const [cases, setCases] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [risk, setRisk] =
    useState("ALL");

  const [status, setStatus] =
    useState("ALL");

  /* =======================================================
     LOAD CASES
  ======================================================= */

  async function load() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getDashboardCases();

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load recovery cases."
        );
      }

      setCases(
        Array.isArray(data.cases)
          ? data.cases
          : []
      );
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "Could not load recovery cases."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* =======================================================
     COUNTS
  ======================================================= */

  const counts = useMemo(() => {
    const recovered =
      cases.filter(
        (c) =>
          String(c?.status || "").toUpperCase() ===
          "RECOVERED"
      ).length;

    const progress =
      cases.filter((c) =>
        [
          "RECOVERY_INITIATED",
          "RECOVERY_FAILED",
        ].includes(
          String(c?.status || "").toUpperCase()
        )
      ).length;

    const pending =
      cases.filter((c) =>
        [
          "PENDING",
          "PENDING_AI_REVIEW",
        ].includes(
          String(c?.status || "").toUpperCase()
        )
      ).length;

    /*
     * Important:
     * A case can have status PENDING while
     * the guardrail itself has blocked the action.
     */
    const blocked =
      cases.filter(isGuardrailBlocked).length;

    return {
      total: cases.length,
      recovered,
      progress,
      pending,
      blocked,
    };
  }, [cases]);

  /* =======================================================
     FILTERING
  ======================================================= */

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    return cases.filter((c) => {
      const customer =
        getCustomer(c).toLowerCase();

      const decision =
        String(
          c?.agentDecision || ""
        ).toLowerCase();

      const caseId =
        String(c?.id || "").toLowerCase();

      /* Search */
      const matchesSearch =
        !q ||
        caseId.includes(q) ||
        customer.includes(q) ||
        decision.includes(q);

      /* Risk */
      const matchesRisk =
        risk === "ALL" ||
        String(
          c?.riskLevel || ""
        ).toUpperCase() ===
          risk;

      /* Status */
      let matchesStatus = true;

      if (status !== "ALL") {
        if (status === "BLOCKED") {
          matchesStatus =
            isGuardrailBlocked(c);
        } else {
          matchesStatus =
            String(
              c?.status || ""
            ).toUpperCase() ===
            status;
        }
      }

      return (
        matchesSearch &&
        matchesRisk &&
        matchesStatus
      );
    });
  }, [
    cases,
    search,
    risk,
    status,
  ]);

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="page">

      {/* =================================================
          HEADER
      ================================================= */}

      <PageHeader
        title="Recovery Cases"
        subtitle="All AI-identified revenue recovery opportunities — click any row to inspect."
        action={
          <button
            className="button secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "spin"
                  : ""
              }
            />

            {loading
              ? "Refreshing…"
              : "Refresh"}
          </button>
        }
      />

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="metric-grid five">

      <MetricCard
  label="SHOWING"
  value={counts.total}
/>

        <MetricCard
          label="RECOVERED"
          value={counts.recovered}
        />

        <MetricCard
          label="IN PROGRESS"
          value={counts.progress}
        />

        <MetricCard
          label="PENDING"
          value={counts.pending}
        />

        <MetricCard
          label="BLOCKED"
          value={counts.blocked}
          tone="red"
        />

      </div>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="toolbar">

        {/* SEARCH */}

        <div className="search">

          <Search size={16} />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search by ID, customer or action…"
          />

        </div>

        {/* FILTER ICON */}

        <div className="filter-icon">
          <SlidersHorizontal
            size={15}
          />
        </div>

        {/* RISK FILTER */}

        <FilterGroup
          values={[
            "ALL",
            "HIGH",
            "MEDIUM",
            "LOW",
          ]}
          active={risk}
          setActive={setRisk}
        />

        <div className="filter-separator" />

        {/* STATUS FILTER */}

        <FilterGroup
          values={[
            "ALL",
            "RECOVERED",
            "RECOVERY_INITIATED",
            "PENDING",
            "BLOCKED",
          ]}
          active={status}
          setActive={setStatus}
        />

      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (

        <div className="page-state">
          <div className="spinner" />
          Loading cases…
        </div>

      ) : (

        /* =================================================
           TABLE
        ================================================= */

        <section className="card cases-table-card">

          <div className="table-meta">

            <span>
              {filtered.length}{" "}
              {filtered.length === 1
                ? "case"
                : "cases"}
            </span>

            <span>
              Click a row to view AI
              decision and audit trail
            </span>

          </div>

          <div className="table-scroll">

            <table className="data-table">

              <thead>

                <tr>
                  <th>Case</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>AI action</th>
                  <th>Confidence</th>
                  <th>Attempts</th>
                  <th>Status</th>
                </tr>

              </thead>

              <tbody>

                {filtered.map((c) => {

                  const blocked =
                    isGuardrailBlocked(c);

                  const confidence =
                    getConfidence(c);

                  return (
                    <tr
                      key={c.id}
                      onClick={() =>
                        onSelectCase(
                          c.id
                        )
                      }
                    >

                      {/* CASE */}

                      <td>
                        <b className="linkish">
                          #{c.id}
                        </b>
                      </td>

                      {/* CUSTOMER */}

                      <td>
                        {getCustomer(c)}
                      </td>

                      {/* AMOUNT */}

                      <td>
                        <strong>
                          {money(
                            c.amount
                          )}
                        </strong>
                      </td>

                      {/* RISK */}

                      <td>
                        <RiskBadge
                          value={
                            c.riskLevel
                          }
                        />
                      </td>

                      {/* AI ACTION */}

                      <td className="mono action-purple">
                        {pretty(
                          c.agentDecision ||
                            "PENDING_AI_REVIEW"
                        )}
                      </td>

                      {/* CONFIDENCE */}

                      <td>
                        <ConfidenceBar
                          value={c}
                        />
                      </td>

                      {/* ATTEMPTS */}

                      <td className="mono">
                        {c.recoveryAttempts ??
                          0}{" "}
                        / 2
                      </td>

                      {/* STATUS */}

                      <td>
                       <StatusBadge
  value={
    blocked
      ? "BLOCKED"
      : c.status
  }
/>
                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

            {!filtered.length && (
              <div className="empty-state">
                <Filter
                  size={18}
                />

                <span>
                  No cases match the
                  current filters.
                </span>
              </div>
            )}

          </div>

        </section>
      )}

    </div>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  label,
  value,
  tone,
}) {
  return (
    <div
      className={`metric-card compact ${
        tone
          ? `tone-${tone}`
          : ""
      }`}
    >
      <div className="micro-label">
        {label}
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

/* =========================================================
   FILTER GROUP
========================================================= */

function FilterGroup({
  values,
  active,
  setActive,
}) {
  return (
    <div className="filter-group">

      {values.map((value) => (
        <button
          key={value}
          className={
            active === value
              ? "active"
              : ""
          }
          onClick={() =>
            setActive(value)
          }
        >
          {pretty(value)}
        </button>
      ))}

    </div>
  );
}

/* =========================================================
   PAGE HEADER
========================================================= */

function PageHeader({
  title,
  subtitle,
  action,
}) {
  return (
    <header className="page-header">

      <div>

        <h1>{title}</h1>

        <p>
          {subtitle}
        </p>

      </div>

      {action}

    </header>
  );
}