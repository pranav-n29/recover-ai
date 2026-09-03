import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  getDashboardCases,
  getDashboardSummary,
  runRecoveryAgent,
} from "../services/api";

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
 * Backend may provide:
 *
 * agentConfidence
 * confidence
 *
 * Example:
 * 0.95 -> 95%
 */
function getConfidence(caseItem) {
  return Number(
    caseItem?.agentConfidence ??
      caseItem?.confidence ??
      0
  );
}

/*
 * Detect guardrail blocked cases safely.
 */
function isGuardrailBlocked(caseItem) {
  return (
    caseItem?.guardrailApproved === false ||
    String(
      caseItem?.guardrailStatus || ""
    ).toUpperCase() === "BLOCKED" ||
    String(
      caseItem?.guardrailDecision || ""
    ).toUpperCase() === "BLOCKED" ||
    String(caseItem?.status || "")
      .toUpperCase()
      .includes("BLOCKED")
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Overview({
  onSelectCase,
  onNavigate,
}) {
  const [summary, setSummary] =
    useState(null);

  const [cases, setCases] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [running, setRunning] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function load() {
    try {
      setLoading(true);

      const [summaryResponse, casesResponse] =
        await Promise.all([
          getDashboardSummary(),
          getDashboardCases(),
        ]);

      setSummary(
        summaryResponse?.summary || {}
      );

      setCases(
        Array.isArray(casesResponse?.cases)
          ? casesResponse.cases
          : []
      );

      setNotice("");
    } catch (e) {
      console.error(e);

      setNotice(
        e?.message ||
          "Could not connect to RecoverAI backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* =======================================================
     RUN AI AGENT
  ======================================================= */

  async function runAgent() {
    try {
      setRunning(true);

      setNotice(
        "AI agent is evaluating eligible recovery cases…"
      );

      const result =
        await runRecoveryAgent(5);

      setNotice(
        `Agent completed ${
          result?.processed || 0
        } case${
          result?.processed === 1
            ? ""
            : "s"
        }.`
      );

      await load();
    } catch (e) {
      console.error(e);

      setNotice(
        e?.message ||
          "AI agent execution failed."
      );
    } finally {
      setRunning(false);
    }
  }

  /* =======================================================
     RISK DATA
  ======================================================= */

  const riskData = useMemo(
    () => [
      {
        name: "High",
        value: Number(
          summary?.highRisk || 0
        ),
        color: "#ef4444",
      },
      {
        name: "Medium",
        value: Number(
          summary?.mediumRisk || 0
        ),
        color: "#f59e0b",
      },
      {
        name: "Low",
        value: Number(
          summary?.lowRisk || 0
        ),
        color: "#10b981",
      },
    ],
    [summary]
  );

  /* =======================================================
     AI DECISIONS
  ======================================================= */

  const decisions =
    Array.isArray(summary?.aiDecisions)
      ? summary.aiDecisions
      : [];
const decided = cases.filter(
  (caseItem) =>
    caseItem?.agentDecision &&
    caseItem.agentDecision !== "PENDING_AI_REVIEW"
);

const finalDecisions = Number(
  summary?.finalDecisions || decided.length
);

const avgConfidence = Number(
  summary?.avgConfidence || 0
);

const blocked = Number(
  summary?.blockedActions || 0
);
  /* =======================================================
     LATEST AI DECISION
  ======================================================= */

  const latest =
    [...cases]
      .sort(
        (a, b) =>
          Number(b?.id || 0) -
          Number(a?.id || 0)
      )
      .find(
        (caseItem) =>
          caseItem?.agentDecision &&
          caseItem.agentDecision !==
            "PENDING_AI_REVIEW"
      ) || cases[0];

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <PageState
        label="Loading recovery intelligence…"
      />
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="page">

      {/* =================================================
          HEADER
      ================================================= */}

      <PageHeader
        title="Revenue Recovery"
        subtitle="Recover more revenue. Automatically. Safely. Measurably."
        action={
          <div className="header-actions">

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

              Refresh
            </button>

            <button
              className="button primary"
              onClick={runAgent}
              disabled={running}
            >
              <Zap size={16} />

              {running
                ? "Running AI…"
                : "Run AI Agent"}
            </button>

          </div>
        }
      />

      {/* =================================================
          NOTICE
      ================================================= */}

      {notice && (
        <div className="notice">
          <Activity size={15} />
          {notice}
        </div>
      )}

      {/* =================================================
          PRIMARY BUSINESS METRIC
      ================================================= */}

      <SectionLabel>
        Primary business metric
      </SectionLabel>

      <div className="hero-kpi">

        <div>

          <div className="micro-label">
            Total revenue recovered
          </div>

          <div className="hero-kpi-value">
            {money(
              summary?.revenueRecovered
            )}
          </div>

          <p>
            Successfully recovered across
            all cases this cycle
          </p>

          <div className="trend positive">
            <ArrowUpRight size={14} />
            Live backend metric
          </div>

        </div>

        <div className="hero-side">

          <span>
            Recovered today
          </span>

          <strong>
            {money(
              summary?.revenueRecoveredToday ??
                0
            )}
          </strong>

          <MiniSpark />

        </div>

      </div>

      {/* =================================================
          OPERATIONAL METRICS
      ================================================= */}

      <SectionLabel>
        Operational metrics
      </SectionLabel>

      <div className="metric-grid three">

        <Metric
          label="Revenue at risk"
          value={money(
            summary?.revenueAtRisk
          )}
          sub="Across identified cases"
          tone="red"
        />

        <Metric
          label="Recovery cases"
          value={
            summary?.totalCases ||
            cases.length ||
            0
          }
          sub="AI-identified opportunities"
          tone="amber"
        />

        <Metric
          label="Recovery rate"
          value={`${
            summary?.recoveryRate || 0
          }%`}
          sub="Recovered / revenue at risk"
          tone="blue"
        />

      </div>

      {/* =================================================
          AI INTELLIGENCE
      ================================================= */}

      <SectionLabel>
        AI intelligence
      </SectionLabel>

      <div className="metric-grid four">

        <Metric
          label="Cases analyzed"
          value={
            summary?.totalCases ||
            cases.length
          }
          sub="backend cases"
          tone="purple"
          icon={<Bot size={15} />}
        />

        <Metric
  label="Policy compliance"
  value={`${Math.round(summary?.policyCompliance ?? 100)}%`}
  sub={`${blocked} blocked cases`}
  tone="green"
  icon={<CheckCircle2 size={15} />}
/>

       <Metric
  label="Avg. confidence"
  value={`${Math.round(avgConfidence)}%`}
  sub={`${finalDecisions} final decisions`}
  tone="blue"
  icon={<Sparkles size={15} />}
/>

        <Metric
          label="Actions blocked"
          value={blocked}
          sub="guardrail enforced"
          tone="red"
          icon={
            <ShieldCheck size={15} />
          }
        />

      </div>

      {/* =================================================
          CHARTS
      ================================================= */}

      <div className="grid-three">

        {/* RISK DISTRIBUTION */}

        <Card
          title="Risk distribution"
          subtitle="Cases by risk level"
          accent="amber"
        >

          <div className="chart-wrap">

            <ResponsiveContainer
              width="100%"
              height={190}
            >

              <PieChart>

                <Pie
                  data={riskData}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="none"
                >

                  {riskData.map(
                    (riskItem) => (
                      <Cell
                        key={
                          riskItem.name
                        }
                        fill={
                          riskItem.color
                        }
                      />
                    )
                  )}

                </Pie>

                <Tooltip
                  contentStyle={{
                    background:
                      "#0d1117",
                    border:
                      "1px solid #1c2538",
                    borderRadius: 8,
                    color:
                      "#eef2ff",
                  }}
                />

              </PieChart>

            </ResponsiveContainer>

            <div className="chart-center">

              <strong>
                {summary?.totalCases ||
                  cases.length ||
                  0}
              </strong>

              <span>
                cases
              </span>

            </div>

            <div className="chart-legend">

              {riskData.map(
                (riskItem) => (
                  <div
                    key={
                      riskItem.name
                    }
                  >

                    <i
                      style={{
                        background:
                          riskItem.color,
                      }}
                    />

                    <span>
                      {riskItem.name}
                    </span>

                    <strong>
                      {riskItem.value}
                    </strong>

                  </div>
                )
              )}

            </div>

          </div>

        </Card>

        {/* DECISIONS */}

        <Card
          title="Decisions by action"
          subtitle="RecoverAI recommendations"
          accent="purple"
        >

          <div className="bar-list">

            {decisions.length ? (
              decisions.map(
                (decision) => (
                  <BarRow
                    key={
                      decision.action
                    }
                    label={
                      decision.action
                    }
                    value={
                      decision.count
                    }
                    total={
                      summary?.totalCases ||
                      1
                    }
                  />
                )
              )
            ) : (
              <Empty
                text="No AI decisions recorded yet."
              />
            )}

          </div>

        </Card>

        {/* CONFIDENCE DISTRIBUTION */}

        <Card
          title="Confidence distribution"
          subtitle="Final AI decision confidence"
        >

          <ConfidenceDistribution
            cases={decided}
          />

        </Card>

      </div>

      {/* =================================================
          RECOVERY PIPELINE
      ================================================= */}

      <Card
        title="Recovery pipeline"
        subtitle="Payment failure → risk detection → AI decision → guardrail evaluation → recovery action → outcome → audit trail"
        accent="blue"
      >

        <Pipeline />

      </Card>

      {/* =================================================
          LATEST AI DECISION
      ================================================= */}

      {latest && (
        <>
          <SectionLabel>
            Latest AI decision
          </SectionLabel>

          <LatestDecision
            item={latest}
            onOpen={() =>
              onSelectCase(
                latest.id
              )
            }
          />
        </>
      )}

      {/* =================================================
          RECENT CASES
      ================================================= */}

      <SectionLabel>
        Recent recovery cases
      </SectionLabel>

      <Card
        title="Recent Recovery Cases"
        subtitle="Click any row to inspect the full AI decision and audit trail"
        action={
          <button
            className="text-button"
            onClick={() =>
              onNavigate("cases")
            }
          >
            View all
            <ChevronRight
              size={13}
            />
          </button>
        }
      >

        <CaseTable
          cases={cases.slice(0, 7)}
          onSelectCase={
            onSelectCase
          }
        />

      </Card>

    </div>
  );
}

/* =========================================================
   LATEST DECISION
========================================================= */

function LatestDecision({
  item,
  onOpen,
}) {
  const confidence =
    getConfidence(item);

  return (
    <div className="latest-card">

      <div className="latest-top">

        <div>

          <div className="micro-label">
            Case #{item.id} · Latest
            evaluated opportunity
          </div>

          <div className="latest-title">

            <strong>
              {money(item.amount)}
            </strong>

            <RiskBadge
              value={
                item.riskLevel
              }
            />

            <StatusBadge
              value={
                item.status
              }
            />

          </div>

        </div>

        <button
          className="text-button"
          onClick={onOpen}
        >
          Open case
          <ChevronRight
            size={13}
          />
        </button>

      </div>

      <div className="latest-grid">

        <div>

          <div className="micro-label">
            AI reasoning
          </div>

          <p>
            {item.agentReason ||
              item.riskReason ||
              "AI reasoning will appear after evaluation."}
          </p>

          <div className="confidence-inline">

            <strong>
              {pretty(
                item.agentDecision
              )}
            </strong>

            <span className="confidence-track">

              <i
                style={{
                  width: `${
                    confidence * 100
                  }%`,
                }}
              />

            </span>

            <b>
              {Math.round(
                confidence * 100
              )}
              %
            </b>

          </div>

        </div>

        <div className="confidence-big">

          <div
            className="confidence-ring"
            style={{
              "--value": `${
                confidence * 360
              }deg`,
            }}
          >

            <span>
              {Math.round(
                confidence * 100
              )}
              %
            </span>

          </div>

          <small>
            AI confidence
          </small>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   CONFIDENCE DISTRIBUTION
========================================================= */

function ConfidenceDistribution({
  cases,
}) {
  const bands = [
    [0.9, 1, "90–100%"],
    [0.75, 0.89, "75–89%"],
    [0.6, 0.74, "60–74%"],
    [0, 0.599, "<60%"],
  ];

  return (
    <div className="confidence-list">

      {bands.map(
        ([min, max, label]) => {

          const count =
            cases.filter(
              (caseItem) => {
                const value =
                  getConfidence(
                    caseItem
                  );

                return (
                  value >= min &&
                  value <= max
                );
              }
            ).length;

          return (
            <div
              className="confidence-row"
              key={label}
            >

              <div className="confidence-mini">

                <span>
                  {Math.round(
                    ((min +
                      Math.min(
                        max,
                        1
                      )) /
                      2) *
                      100
                  )}
                  %
                </span>

              </div>

              <span>
                {label}
              </span>

              <div className="confidence-track">

                <i
                  style={{
                    width: `${
                      cases.length
                        ? (count /
                            cases.length) *
                          100
                        : 0
                    }%`,
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

      <small>
        {cases.length} cases with final
        AI decisions
      </small>

    </div>
  );
}

/* =========================================================
   PIPELINE
========================================================= */

function Pipeline() {
  const steps = [
    [
      "Payment Failure",
      "Detected",
      "red",
    ],
    [
      "Risk Detection",
      "Scored",
      "amber",
    ],
    [
      "AI Decision",
      "RecoverAI",
      "purple",
    ],
    [
      "Guardrail Evaluation",
      "Validated",
      "blue",
    ],
    [
      "Recovery Action",
      "Executed",
      "blue",
    ],
    [
      "Recovery Outcome",
      "Measured",
      "green",
    ],
    [
      "Audit Trail",
      "Logged",
      "slate",
    ],
  ];

  return (
    <div className="pipeline">

      {steps.map(
        ([title, subtitle, color], index) => (
          <div
            className="pipeline-step"
            key={title}
          >

            <div
              className={`pipeline-icon ${color}`}
            >
              <Zap size={15} />
            </div>

            <strong>
              {title}
            </strong>

            <span>
              {subtitle}
            </span>

            {index < steps.length - 1 && (
              <div className="pipeline-arrow">
                →
              </div>
            )}

          </div>
        )
      )}

    </div>
  );
}

/* =========================================================
   CASE TABLE
========================================================= */

function CaseTable({
  cases,
  onSelectCase,
}) {
  if (!cases.length) {
    return (
      <Empty
        text="No recovery cases returned by the backend."
      />
    );
  }

  return (
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

          {cases.map(
            (caseItem) => {

              const confidence =
                getConfidence(
                  caseItem
                );

              return (
                <tr
                  key={
                    caseItem.id
                  }
                  onClick={() =>
                    onSelectCase(
                      caseItem.id
                    )
                  }
                >

                  <td>
                    <b className="linkish">
                      #{caseItem.id}
                    </b>
                  </td>

                  <td>
                    {caseItem.customerName ||
                      caseItem.customer ||
                      `Customer #${caseItem.id}`}
                  </td>

                  <td>
                    <strong>
                      {money(
                        caseItem.amount
                      )}
                    </strong>
                  </td>

                  <td>
                    <RiskBadge
                      value={
                        caseItem.riskLevel
                      }
                    />
                  </td>

                  <td className="mono action-purple">
                    {pretty(
                      caseItem.agentDecision ||
                        "PENDING_AI_REVIEW"
                    )}
                  </td>

                  <td>
                    <ConfidenceBar
                      value={
                        confidence
                      }
                    />
                  </td>

                  <td className="mono">
                    {caseItem.recoveryAttempts ??
                      0}{" "}
                    / 2
                  </td>

                  <td>
                    <StatusBadge
                      value={
                        caseItem.status
                      }
                    />
                  </td>

                </tr>
              );
            }
          )}

        </tbody>

      </table>

    </div>
  );
}

/* =========================================================
   CONFIDENCE BAR
========================================================= */

function ConfidenceBar({
  value,
}) {
  const v = Math.max(
    0,
    Math.min(
      100,
      Number(value || 0) * 100
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

      <b>
        {Math.round(v)}%
      </b>

    </div>
  );
}

/* =========================================================
   BAR ROW
========================================================= */

function BarRow({
  label,
  value,
  total,
}) {
  const percentage = Math.min(
    (Number(value || 0) /
      Number(total || 1)) *
      100,
    100
  );

  return (
    <div className="bar-row">

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
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
}

/* =========================================================
   METRIC
========================================================= */

function Metric({
  label,
  value,
  sub,
  tone,
  icon,
}) {
  return (
    <div
      className={`metric-card tone-${tone}`}
    >

      <div className="metric-icon">
        {icon || (
          <IndianRupee size={15} />
        )}
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

/* =========================================================
   CARD
========================================================= */

function Card({
  title,
  subtitle,
  children,
  accent = "blue",
  action,
}) {
  return (
    <section className="card">

      <div className="card-head">

        <div className="card-title-wrap">

          <i
            className={`accent accent-${accent}`}
          />

          <div>

            <h3>
              {title}
            </h3>

            <p>
              {subtitle}
            </p>

          </div>

        </div>

        {action}

      </div>

      {children}

    </section>
  );
}

/* =========================================================
   SECTION LABEL
========================================================= */

function SectionLabel({
  children,
}) {
  return (
    <div className="section-label">
      {children}
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

        <h1>
          {title}
        </h1>

        <p>
          {subtitle}
        </p>

      </div>

      {action}

    </header>
  );
}

/* =========================================================
   RISK BADGE
========================================================= */

function RiskBadge({
  value,
}) {
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

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  value,
}) {
  return (
    <span
      className={`badge status-${String(
        value || ""
      )
        .toLowerCase()
        .replaceAll(
          "_",
          "-"
        )}`}
    >
      {pretty(value)}
    </span>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function Empty({
  text,
}) {
  return (
    <div className="empty-state">

      <Clock3 size={16} />

      {text}

    </div>
  );
}

/* =========================================================
   PAGE STATE
========================================================= */

function PageState({
  label,
}) {
  return (
    <div className="page-state">

      <div className="spinner" />

      <span>
        {label}
      </span>

    </div>
  );
}

/* =========================================================
   MINI SPARK
========================================================= */

function MiniSpark() {
  return (
    <div className="spark">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}