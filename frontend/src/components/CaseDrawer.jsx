import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

/* =========================================================
   HELPERS
========================================================= */

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const pct = (value) =>
  `${Math.round(Number(value || 0) * 100)}%`;

const pretty = (value) =>
  String(value || "UNKNOWN")
    .replaceAll("_", " ");

/* =========================================================
   PARSE BACKEND DETAILS
========================================================= */

function parseDetails(details) {
  if (!details) return null;

  if (typeof details === "object") {
    return details;
  }

  try {
    return JSON.parse(details);
  } catch {
    return {
      message: details,
    };
  }
}

/* =========================================================
   CUSTOMER
========================================================= */

function getCustomer(caseData) {
  return (
    caseData?.customerName ||
    caseData?.customer ||
    `Customer #${caseData?.id || "—"}`
  );
}

/* =========================================================
   GUARDRAIL DETECTION
========================================================= */

/*
 * Guardrail information can come from different places
 * depending on the backend response.
 */

function getGuardrailState(data) {
  const caseData = data?.case || {};
  const auditTrail = data?.auditTrail || [];
  const actions = data?.actions || [];

  /* -------------------------------------------------------
     1. Explicit case-level guardrail fields
  ------------------------------------------------------- */

  if (
    caseData.guardrailApproved === false ||
    caseData.guardrailStatus === "BLOCKED" ||
    caseData.guardrailDecision === "BLOCKED"
  ) {
    return {
      approved: false,
      reason:
        caseData.guardrailReason ||
        "Action blocked by guardrails.",
    };
  }

  if (caseData.guardrailApproved === true) {
    return {
      approved: true,
      reason:
        caseData.guardrailReason ||
        "Action passed all guardrail checks.",
    };
  }

  /* -------------------------------------------------------
     2. Look at audit trail
  ------------------------------------------------------- */

  const blockedEvent = auditTrail.find((event) => {
    const type = String(
      event?.eventType ||
        event?.event ||
        ""
    ).toUpperCase();

    return (
      type.includes("GUARDRAIL_BLOCKED") ||
      type.includes("GUARDRAIL_FAILED") ||
      type.includes("BLOCKED")
    );
  });

  if (blockedEvent) {
    const detail = parseDetails(
      blockedEvent.details
    );

    return {
      approved: false,
      reason:
        detail?.reason ||
        detail?.message ||
        blockedEvent.reason ||
        "Action blocked by guardrails.",
    };
  }

  /* -------------------------------------------------------
     3. Look at action approval
  ------------------------------------------------------- */

  const rejectedAction = actions.find(
    (action) =>
      action?.approved === false
  );

  if (rejectedAction) {
    return {
      approved: false,
      reason:
        rejectedAction.reason ||
        "Action was not approved by guardrails.",
    };
  }

  const approvedAction = actions.find(
    (action) =>
      action?.approved === true
  );

  if (approvedAction) {
    return {
      approved: true,
      reason:
        caseData.guardrailReason ||
        "Action passed all guardrail checks.",
    };
  }

  /* -------------------------------------------------------
     4. Check generic guardrail fields
  ------------------------------------------------------- */

  if (
    caseData.guardrailResult &&
    typeof caseData.guardrailResult === "object"
  ) {
    const result =
      caseData.guardrailResult;

    return {
      approved: result.approved !== false,
      reason:
        result.reason ||
        (result.approved === false
          ? "Action blocked by guardrails."
          : "Action passed all guardrail checks."),
    };
  }

  /* -------------------------------------------------------
     5. Default
  ------------------------------------------------------- */

  return {
    approved: true,
    reason:
      "Action passed all guardrail checks.",
  };
}

/* =========================================================
   AI DECISION
========================================================= */

function getAIDecision(caseData) {
  return (
    caseData?.agentDecision ||
    caseData?.recommendedAction ||
    caseData?.aiRecommendation?.recommendedAction ||
    "PENDING_AI_REVIEW"
  );
}

function getAIConfidence(caseData) {
  return Number(
    caseData?.agentConfidence ??
      caseData?.confidence ??
      caseData?.aiRecommendation?.confidence ??
      0
  );
}

function getAIReason(caseData) {
  return (
    caseData?.riskReason ||
    caseData?.agentReason ||
    caseData?.reason ||
    caseData?.aiRecommendation?.reason ||
    "No AI reasoning recorded."
  );
}

/* =========================================================
   STATUS BADGES
========================================================= */

function RiskBadge({ value }) {
  return (
    <span
      className={`badge risk-${String(
        value || "unknown"
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
        value || "unknown"
      )
        .toLowerCase()
        .replaceAll("_", "-")}`}
    >
      {pretty(value)}
    </span>
  );
}

/* =========================================================
   ACTION RESULT
========================================================= */

function ActionResult({ action }) {
  const result = String(
    action?.result || ""
  ).toUpperCase();

  if (
    result.includes("SUCCESS")
  ) {
    return (
      <span className="action-result success">
        <CheckCircle2 size={13} />
        SUCCESS
      </span>
    );
  }

  if (
    result.includes("FAILED") ||
    result.includes("RETRY_LIMIT")
  ) {
    return (
      <span className="action-result failed">
        <XCircle size={13} />
        FAILED
      </span>
    );
  }

  if (
    result === "WAIT_REQUIRED"
  ) {
    return (
      <span className="action-result pending">
        <Clock3 size={13} />
        WAIT REQUIRED
      </span>
    );
  }

  if (action?.approved === false) {
    return (
      <span className="action-result failed">
        <XCircle size={13} />
        BLOCKED
      </span>
    );
  }

  return (
    <span className="action-result pending">
      <Clock3 size={13} />
      {pretty(action?.result || "PENDING")}
    </span>
  );
}

/* =========================================================
   AUDIT TIMELINE
========================================================= */

function Timeline({ events }) {
  if (!events?.length) {
    return (
      <div className="empty-inline">
        <Clock3 size={16} />
        No audit events recorded yet.
      </div>
    );
  }

  return (
    <div className="timeline">
      {events.map((event, index) => {
        const type =
          event?.eventType ||
          event?.event ||
          "EVENT";

        const upperType =
          String(type).toUpperCase();

        let color = "blue";

        if (
          upperType.includes("BLOCKED") ||
          upperType.includes("FAILED")
        ) {
          color = "red";
        } else if (
          upperType.includes("SUCCESS") ||
          upperType.includes("APPROVED") ||
          upperType.includes("EXECUTED")
        ) {
          color = "green";
        } else if (
          upperType.includes("AI")
        ) {
          color = "purple";
        } else if (
          upperType.includes("RISK")
        ) {
          color = "amber";
        }

        return (
          <div
            className="timeline-row"
            key={`${event?.id || type}-${index}`}
          >
            <div
              className={`timeline-dot ${color}`}
            />

            {index <
              events.length - 1 && (
              <div className="timeline-line" />
            )}

            <div className="timeline-content">
              <strong>
                {pretty(type)}
              </strong>

              {event?.actor && (
                <span>
                  Actor: {event.actor}
                </span>
              )}

              <small>
                {formatDate(
                  event?.timestamp ||
                    event?.ts
                )}
              </small>

              {event?.details && (
                <div className="timeline-detail">
                  {renderDetail(
                    event.details
                  )}
                </div>
              )}

              {event?.detail && (
                <div className="timeline-detail">
                  {event.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   AUDIT DETAIL
========================================================= */

function renderDetail(details) {
  const d = parseDetails(details);

  if (!d) return null;

  if (
    typeof d !== "object"
  ) {
    return String(d);
  }

  const parts = [];

  if (d.paymentId != null) {
    parts.push(
      `Payment: ${d.paymentId}`
    );
  }

  if (d.amount != null) {
    parts.push(
      `Amount: ${money(d.amount)}`
    );
  }

  if (d.riskLevel) {
    parts.push(
      `Risk: ${d.riskLevel}`
    );
  }

  if (d.riskScore != null) {
    parts.push(
      `Risk score: ${pct(d.riskScore)}`
    );
  }

  if (d.recommendedAction) {
    parts.push(
      `AI action: ${d.recommendedAction}`
    );
  }

  if (d.confidence != null) {
    parts.push(
      `Confidence: ${pct(d.confidence)}`
    );
  }

  if (d.orderId) {
    parts.push(
      `Recovery order: ${d.orderId}`
    );
  }

  if (d.attempt != null) {
    parts.push(
      `Attempt: ${d.attempt}`
    );
  }

  if (d.attemptsRemaining != null) {
    parts.push(
      `Attempts remaining: ${d.attemptsRemaining}`
    );
  }

  if (d.currency) {
    parts.push(
      `Currency: ${d.currency}`
    );
  }

  if (d.status) {
    parts.push(
      `Status: ${d.status}`
    );
  }

  if (d.reason) {
    parts.push(d.reason);
  }

  if (d.message) {
    parts.push(d.message);
  }

  if (parts.length) {
    return parts.join(" • ");
  }

  return Object.entries(d)
    .map(([key, value]) => {
      const displayValue =
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

      return `${key}: ${displayValue}`;
    })
    .join(" • ");
}

/* =========================================================
   DATE
========================================================= */

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "medium",
    }
  );
}

/* =========================================================
   MAIN DRAWER
========================================================= */

export default function CaseDrawer({
  data,
  loading,
  onClose,
}) {
  const [auditOpen, setAuditOpen] =
    useState(true);

  useEffect(() => {
    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        "";
    };
  }, []);

  const caseData =
    data?.case || null;

  const guardrail =
    useMemo(
      () => getGuardrailState(data),
      [data]
    );

  const aiDecision =
    getAIDecision(caseData);

  const aiConfidence =
    getAIConfidence(caseData);

  const aiReason =
    getAIReason(caseData);

  const actions =
    data?.actions || [];

  const auditTrail =
    data?.auditTrail || [];

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
    >
      <aside
        className="case-drawer"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="drawer-header">
          <div>
            <div className="micro-label">
              Recovery case
            </div>

            <div className="drawer-title-row">
              <h2>
                #{caseData?.id || "—"}
              </h2>

              {caseData && (
                <StatusBadge
                  value={caseData.status}
                />
              )}
            </div>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* =================================================
            LOADING / ERROR
        ================================================= */}

        {loading ? (
          <div className="drawer-state">
            <div className="spinner" />
            Loading case intelligence…
          </div>
        ) : !caseData ? (
          <div className="drawer-state">
            <XCircle size={22} />
            {data?.message ||
              "Could not load recovery case."}
          </div>
        ) : (
          <div className="drawer-scroll">

            {/* =================================================
                CASE SUMMARY
            ================================================= */}

            <section className="case-summary-grid">

              <Info label="Amount">
                <strong className="hero-amount">
                  {money(
                    caseData.amount
                  )}
                </strong>
              </Info>

              <Info label="Risk">
                <RiskBadge
                  value={
                    caseData.riskLevel
                  }
                />
              </Info>

              <Info label="Payment ID">
                <span className="mono accent-text">
                  {caseData.paymentId ||
                    "—"}
                </span>
              </Info>

              <Info label="Customer">
                <span>
                  {getCustomer(
                    caseData
                  )}
                </span>
              </Info>

              <Info label="Channel">
                <span>
                  {caseData.channel ||
                    "—"}
                </span>
              </Info>

              <Info label="Opened">
                <span className="mono">
                  {formatDate(
                    caseData.createdAt ||
                      caseData.created_at
                  )}
                </span>
              </Info>

            </section>

            <div className="drawer-body">

              {/* =================================================
                  RISK ASSESSMENT
              ================================================= */}

              <DrawerSection
                icon={
                  <AlertTriangle
                    size={15}
                  />
                }
                title="Risk assessment"
              >
                <div className="risk-callout">

                  <div className="callout-title">
                    <i />
                    Why this case is at risk
                  </div>

                  <p>
                    {caseData.riskReason ||
                      "No risk reason recorded."}
                  </p>

                </div>
              </DrawerSection>

              {/* =================================================
                  AI DECISION
              ================================================= */}

              <DrawerSection
  icon={<Bot size={15} />}
  title="AI decision"
>
  <div className="ai-decision-card">

    <div className="ai-decision-main">

      <div>
        <div className="micro-label">
          Recommended action
        </div>

        <strong className="ai-action-value">
          {pretty(aiDecision)}
        </strong>
      </div>

      <div className="ai-confidence-ring">
        <div className="ai-confidence-value">
          {Math.round(aiConfidence * 100)}%
        </div>
      </div>

    </div>

    <div className="ai-decision-divider" />

    <div className="ai-reasoning">

      <div className="micro-label">
        AI reasoning
      </div>

      <p>
        {aiReason}
      </p>

    </div>

  </div>
</DrawerSection>

              {/* =================================================
                  GUARDRAIL
              ================================================= */}

              <DrawerSection
                icon={
                  guardrail.approved ? (
                    <ShieldCheck
                      size={15}
                    />
                  ) : (
                    <ShieldAlert
                      size={15}
                    />
                  )
                }
                title="Guardrail evaluation"
              >
                <div
                  className={`guardrail-result ${
                    guardrail.approved
                      ? "approved"
                      : "blocked"
                  }`}
                >

                  <div className="guardrail-result-head">

                    <span className="round-icon">
                      {guardrail.approved ? (
                        <CheckCircle2
                          size={16}
                        />
                      ) : (
                        <XCircle
                          size={16}
                        />
                      )}
                    </span>

                    <div>
                      <strong>
                        {guardrail.approved
                          ? "APPROVED"
                          : "BLOCKED"}
                      </strong>

                      <span>
                        {guardrail.reason}
                      </span>
                    </div>

                  </div>

                  {caseData.guardrailChecks
                    ?.length > 0 && (
                    <div className="check-list">

                      {caseData.guardrailChecks.map(
                        (check, index) => (
                          <div
                            key={index}
                          >
                            {check.passed === false ? (
                              <XCircle
                                size={14}
                              />
                            ) : (
                              <Check
                                size={14}
                              />
                            )}

                            {check.label ||
                              check.rule ||
                              check.name}

                            <span>
                              {check.detail ||
                                (check.passed === false
                                  ? "Blocked"
                                  : "Passed")}
                            </span>
                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>
              </DrawerSection>

              {/* =================================================
                  RECOVERY ACTION
              ================================================= */}

              <DrawerSection
                icon={
                  <CreditCard
                    size={15}
                  />
                }
                title="Recovery action"
              >
                {actions.length ? (
                  <div className="action-stack">

                    {actions.map(
                      (action) => (
                        <div
                          className="action-card"
                          key={action.id}
                        >

                          <div>
                            <div className="micro-label">
                              Action
                            </div>

                            <strong>
                              {pretty(
                                action.actionType
                              )}
                            </strong>

                            <span>
                              {action.approved
                                ? "Guardrail approved"
                                : "Not approved"}
                            </span>
                          </div>

                          <div>
                            <div className="micro-label">
                              Result
                            </div>

                            <ActionResult
                              action={action}
                            />
                          </div>

                          <div>
                            <div className="micro-label">
                              Attempt
                            </div>

                            <strong>
                              {action.attempt ??
                                caseData.recoveryAttempts ??
                                "—"}
                            </strong>
                          </div>

                        </div>
                      )
                    )}

                  </div>
                ) : (
                  <div className="empty-inline">
                    <Clock3 size={16} />

                    {guardrail.approved
                      ? "No recovery action recorded yet."
                      : "Recovery action was blocked by guardrails."}
                  </div>
                )}
              </DrawerSection>

              {/* =================================================
                  AUDIT TIMELINE
              ================================================= */}

              <section className="drawer-section">

                <button
                  className="section-toggle"
                  onClick={() =>
                    setAuditOpen(
                      (value) =>
                        !value
                    )
                  }
                >
                  <span>
                    <Clock3 size={15} />
                    Audit timeline

                    <em>
                      ({auditTrail.length})
                    </em>
                  </span>

                  <ChevronDown
                    size={15}
                    className={
                      auditOpen
                        ? "rotated"
                        : ""
                    }
                  />
                </button>

                {auditOpen && (
                  <Timeline
                    events={auditTrail}
                  />
                )}

              </section>

              {/* =================================================
                  SAFETY
              ================================================= */}

              <div className="safety-strip">

                <ShieldCheck
                  size={19}
                />

                <div>
                  <strong>
                    Guardrails active
                  </strong>

                  <span>
                    Recovery actions are
                    bounded, gated and
                    audited.
                  </span>
                </div>

                <ExternalLink
                  size={14}
                />

              </div>

            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  label,
  children,
}) {
  return (
    <div className="info-cell">
      <div className="micro-label">
        {label}
      </div>

      {children}
    </div>
  );
}

/* =========================================================
   DRAWER SECTION
========================================================= */

function DrawerSection({
  icon,
  title,
  children,
}) {
  return (
    <section className="drawer-section">

      <div className="drawer-section-title">
        {icon}
        <h3>{title}</h3>
      </div>

      {children}

    </section>
  );
}