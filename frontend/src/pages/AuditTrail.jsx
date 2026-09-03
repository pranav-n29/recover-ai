import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import { getAuditLogs } from "../services/api";

/* =========================================================
   HELPERS
========================================================= */

const pretty = (value) =>
  String(value || "—").replaceAll("_", " ");

const statusOf = (type) => {
  const event = String(type || "").toUpperCase();

  if (event.includes("BLOCKED")) {
    return "BLOCKED";
  }

  if (event.includes("FAILED")) {
    return "FAILED";
  }

  if (
    event.includes("SUCCESS") ||
    event.includes("APPROVED") ||
    event.includes("EXECUTED")
  ) {
    return "SUCCESS";
  }

  return "INFO";
};

const iconFor = (type) => {
  const event = String(type || "").toUpperCase();

  if (event.includes("SUCCESS")) {
    return <Star size={14} />;
  }

  if (event.includes("BLOCKED")) {
    return <ShieldAlert size={14} />;
  }

  if (event.includes("AI")) {
    return <Sparkles size={14} />;
  }

  if (event.includes("EXECUTED")) {
    return <Zap size={14} />;
  }

  return <Info size={14} />;
};

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/* =========================================================
   HUMAN READABLE AUDIT DETAILS
========================================================= */

function formatAuditDetail(log) {
  const details =
    typeof log?.details === "object"
      ? log.details
      : (() => {
          try {
            return JSON.parse(log?.details || "{}");
          } catch {
            return {
              message: log?.details || "",
            };
          }
        })();

  switch (log?.eventType) {
    /* =====================================================
       RECOVERY ACTION EXECUTED
    ===================================================== */

    case "RECOVERY_ACTION_EXECUTED": {
      const result = details?.result || {};

      return (
        <div className="human-detail">
          <p>
            Recovery action was executed successfully.
          </p>

          <div className="detail-items">
            <div>
              <span>Action</span>
              <strong>
                {pretty(details?.action)}
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>
                ₹
                {Number(
                  result?.amount || 0
                ).toLocaleString("en-IN")}
              </strong>
            </div>

            <div>
              <span>Recovery Order</span>
              <strong>
                {result?.orderId || "—"}
              </strong>
            </div>

            <div>
              <span>Attempt</span>
              <strong>
                {result?.attempt ?? "—"}
              </strong>
            </div>

            <div>
              <span>Status</span>
              <strong>
                {pretty(result?.status)}
              </strong>
            </div>

            <div>
              <span>Attempts Remaining</span>
              <strong>
                {result?.attemptsRemaining ?? "—"}
              </strong>
            </div>
          </div>
        </div>
      );
    }

    /* =====================================================
       RECOVERY ORDER CREATED
    ===================================================== */

    case "RECOVERY_ORDER_CREATED":
      return (
        <div className="human-detail">
          <p>
            A recovery order was created for this case.
          </p>

          <div className="detail-items">
            <div>
              <span>Recovery Order</span>
              <strong>
                {details?.orderId || "—"}
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>
                ₹
                {Number(
                  details?.amount || 0
                ).toLocaleString("en-IN")}
              </strong>
            </div>

            <div>
              <span>Currency</span>
              <strong>
                {details?.currency || "INR"}
              </strong>
            </div>

            <div>
              <span>Attempt</span>
              <strong>
                {details?.attempt ?? "—"}
              </strong>
            </div>
          </div>
        </div>
      );

    /* =====================================================
       GUARDRAIL APPROVED
    ===================================================== */

    case "GUARDRAIL_APPROVED":
      return (
        <div className="human-detail">
          <p>
            This recovery action passed all configured
            guardrail checks and was approved for execution.
          </p>
        </div>
      );

    /* =====================================================
       GUARDRAIL BLOCKED
    ===================================================== */

    case "GUARDRAIL_BLOCKED":
      return (
        <div className="human-detail">
          <p>
            This recovery action was blocked because it
            did not satisfy the configured guardrail policies.
          </p>

          {details?.reason && (
            <div className="detail-items">
              <div>
                <span>Reason</span>
                <strong>
                  {details.reason}
                </strong>
              </div>
            </div>
          )}
        </div>
      );

    /* =====================================================
       RECOVERY FAILED
    ===================================================== */

    case "RECOVERY_FAILED":
      return (
        <div className="human-detail">
          <p>
            The recovery attempt was unsuccessful.
          </p>

          <div className="detail-items">
            <div>
              <span>Attempt</span>
              <strong>
                {details?.attempt ?? "—"}
              </strong>
            </div>

            <div>
              <span>Result</span>
              <strong>Failed</strong>
            </div>
          </div>
        </div>
      );

    /* =====================================================
       RECOVERY SUCCESS
    ===================================================== */

    case "RECOVERY_SUCCESS":
      return (
        <div className="human-detail">
          <p>
            Recovery was completed successfully.
          </p>

          {details?.amountRecovered !== undefined && (
            <div className="detail-items">
              <div>
                <span>Amount Recovered</span>
                <strong>
                  ₹
                  {Number(
                    details.amountRecovered
                  ).toLocaleString("en-IN")}
                </strong>
              </div>
            </div>
          )}
        </div>
      );

    /* =====================================================
       RECOVERY ACTION DEFERRED
    ===================================================== */

    case "RECOVERY_ACTION_DEFERRED":
      return (
        <div className="human-detail">
          <p>
            The recovery action was deferred because the
            AI recommended waiting before taking further action.
          </p>
        </div>
      );

    /* =====================================================
       RECOVERY STOPPED
    ===================================================== */

    case "RECOVERY_STOPPED":
      return (
        <div className="human-detail">
          <p>
            Further recovery attempts were stopped because
            the maximum allowed attempts were reached.
          </p>
        </div>
      );

    /* =====================================================
       AI DECISION
    ===================================================== */

    case "AI_DECISION":
      return (
        <div className="human-detail">
          <p>
            {details?.reason ||
              details?.message ||
              details?.recommendedAction ||
              "The AI evaluated this recovery case."}
          </p>

          {(details?.action ||
            details?.confidence !== undefined) && (
            <div className="detail-items">
              {details?.action && (
                <div>
                  <span>Recommended Action</span>
                  <strong>
                    {pretty(details.action)}
                  </strong>
                </div>
              )}

              {details?.confidence !== undefined && (
                <div>
                  <span>Confidence</span>
                  <strong>
                    {Math.round(
                      Number(details.confidence) * 100
                    )}
                    %
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      );

    /* =====================================================
       RISK DETECTED
    ===================================================== */

    case "RISK_DETECTED":
      return (
        <div className="human-detail">
          <p>
            A recovery opportunity was identified by the
            risk engine.
          </p>

          <div className="detail-items">
            <div>
              <span>Payment</span>
              <strong>
                {details?.paymentId || "—"}
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>
                ₹
                {Number(
                  details?.amount || 0
                ).toLocaleString("en-IN")}
              </strong>
            </div>

            <div>
              <span>Risk Level</span>
              <strong>
                {details?.riskLevel || "—"}
              </strong>
            </div>

            <div>
              <span>Risk Score</span>
              <strong>
                {details?.riskScore !== undefined
                  ? `${Math.round(
                      Number(details.riskScore) * 100
                    )}%`
                  : "—"}
              </strong>
            </div>
          </div>
        </div>
      );

    /* =====================================================
       DEFAULT
    ===================================================== */

    default:
      return (
        <div className="human-detail">
          <p>
            {details?.reason ||
              details?.message ||
              details?.result ||
              "Event recorded by RecoverAI."}
          </p>
        </div>
      );
  }
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [filter, setFilter] =
    useState("ALL");
  const [open, setOpen] =
    useState(null);

  /* =======================================================
     LOAD AUDIT LOGS
  ======================================================= */

  async function load() {
    try {
      setLoading(true);
      setError("");

      const data =
        await getAuditLogs(100);

      setLogs(
        Array.isArray(data?.logs)
          ? data.logs
          : []
      );
    } catch (e) {
      console.error(e);

      setError(
        e?.message ||
          "Could not load audit trail."
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

  const counts = {
    TOTAL: logs.length,

    SUCCESS: logs.filter(
      (log) =>
        statusOf(log.eventType) ===
        "SUCCESS"
    ).length,

    BLOCKED: logs.filter(
      (log) =>
        statusOf(log.eventType) ===
        "BLOCKED"
    ).length,

    FAILED: logs.filter(
      (log) =>
        statusOf(log.eventType) ===
        "FAILED"
    ).length,

    INFO: logs.filter(
      (log) =>
        statusOf(log.eventType) ===
        "INFO"
    ).length,
  };

  /* =======================================================
     EVENT FILTERS
  ======================================================= */

  const types = [
    "ALL",
    ...new Set(
      logs.map(
        (log) => log.eventType
      )
    ),
  ];

  /* =======================================================
     SEARCH + FILTER
  ======================================================= */

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    return logs.filter((log) => {
      const eventType =
        String(
          log.eventType || ""
        ).toLowerCase();

      const actor =
        String(
          log.actor || ""
        ).toLowerCase();

      const caseId =
        String(
          log.recoveryCaseId || ""
        ).toLowerCase();

      const matchesSearch =
        !q ||
        eventType.includes(q) ||
        actor.includes(q) ||
        caseId.includes(q);

      const matchesFilter =
        filter === "ALL" ||
        log.eventType === filter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [
    logs,
    search,
    filter,
  ]);

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="page-header">

        <div>
          <h1>Audit Trail</h1>

          <p>
            Every AI decision and recovery action is
            immutably recorded and auditable.
          </p>
        </div>

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

      </div>

      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="metric-grid five">

        {Object.entries(
          counts
        ).map(([key, value]) => (
          <div
            className={`metric-card compact ${
              key === "BLOCKED" ||
              key === "FAILED"
                ? "tone-red"
                : key === "SUCCESS"
                ? "tone-green"
                : ""
            }`}
            key={key}
          >
            <div className="micro-label">
              {key}
            </div>

            <strong>
              {value}
            </strong>
          </div>
        ))}

      </div>

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="toolbar">

        <div className="search">

          <Search size={16} />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search events, cases, actors…"
          />

        </div>

        <div className="filter-group">

          {types
            .slice(0, 8)
            .map((type) => (
              <button
                key={type}
                className={
                  filter === type
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(type)
                }
              >
                {pretty(type)}
              </button>
            ))}

        </div>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      {/* =================================================
          LOADING
      ================================================= */}

      {loading ? (

        <div className="page-state">

          <div className="spinner" />

          Loading audit events…

        </div>

      ) : (

        /* =================================================
           AUDIT LIST
        ================================================= */

        <section className="card audit-card">

          <div className="table-meta">

            <span>
              {filtered.length} events · newest first
            </span>

            <span>
              Expand for details
            </span>

          </div>

          <div className="audit-list">

            {filtered.map((log) => {

              const status =
                statusOf(
                  log.eventType
                );

              const expanded =
                open === log.id;

              return (
                <div
                  className={`audit-event-row ${
                    expanded
                      ? "expanded"
                      : ""
                  }`}
                  key={log.id}
                >

                  {/* =====================================
                      EVENT HEADER
                  ===================================== */}

                  <button
                    onClick={() =>
                      setOpen(
                        expanded
                          ? null
                          : log.id
                      )
                    }
                  >

                    <span
                      className={`audit-icon ${status.toLowerCase()}`}
                    >
                      {iconFor(
                        log.eventType
                      )}
                    </span>

                    <span className="audit-event-main">

                      <strong>
                        {log.eventType}
                      </strong>

                      <small>
                        Case #{log.recoveryCaseId}
                        {" · "}
                        {log.actor}
                      </small>

                      <span>
                        {summarize(
                          log.details
                        )}
                      </span>

                    </span>

                    <span
                      className={`audit-status ${status.toLowerCase()}`}
                    >
                      {status}
                    </span>

                    <span className="audit-time">
                      {formatDate(
                        log.timestamp
                      )}
                    </span>

                    <ChevronDown
                      size={15}
                      className={
                        expanded
                          ? "rotated"
                          : ""
                      }
                    />

                  </button>

                  {/* =====================================
                      EXPANDED DETAILS
                  ===================================== */}

                  {expanded && (

                    <div className="audit-detail-grid">

                      <div>
                        <small>
                          Event ID
                        </small>

                        <strong>
                          EVT-{log.id}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Timestamp
                        </small>

                        <strong>
                          {formatDate(
                            log.timestamp
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Case
                        </small>

                        <strong>
                          #{log.recoveryCaseId}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Actor
                        </small>

                        <strong>
                          {log.actor}
                        </strong>
                      </div>

                      <div className="full">

                        <small>
                          Event detail
                        </small>

                        <div className="audit-human-detail">
                          {formatAuditDetail(
                            log
                          )}
                        </div>

                      </div>

                    </div>

                  )}

                </div>
              );
            })}

            {/* ===========================================
                EMPTY STATE
            =========================================== */}

            {!filtered.length && (
              <div className="empty-state">

                <Search size={18} />

                <span>
                  No audit events match
                  the current filters.
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
   SUMMARY TEXT
========================================================= */

function summarize(details) {
  if (!details) {
    return "No detail recorded.";
  }

  const x =
    typeof details === "object"
      ? details
      : (() => {
          try {
            return JSON.parse(details);
          } catch {
            return {
              message: details,
            };
          }
        })();

  const value =
    x.reason ??
    x.message ??
    x.result ??
    x.action ??
    x.recommendedAction ??
    "Event recorded by RecoverAI.";

  if (
    typeof value === "object"
  ) {
    if (value.status) {
      return `${pretty(
        value.status
      )}${
        value.amount
          ? ` · ₹${Number(
              value.amount
            ).toLocaleString("en-IN")}`
          : ""
      }${
        value.attempt
          ? ` · Attempt ${value.attempt}`
          : ""
      }`;
    }

    return JSON.stringify(
      value
    );
  }

  return String(value);
}