const db = require("../config/database");

async function getDashboardSummary() {
  // =========================================================
  // 1. RECOVERY CASE / RISK SUMMARY
  // =========================================================

  const [riskRows] = await db.query(`
    SELECT
      COUNT(*) AS totalCases,

      COALESCE(
        SUM(risk_amount),
        0
      ) AS revenueAtRisk,

      SUM(
        CASE
          WHEN risk_level = 'HIGH' THEN 1
          ELSE 0
        END
      ) AS highRisk,

      SUM(
        CASE
          WHEN risk_level = 'MEDIUM' THEN 1
          ELSE 0
        END
      ) AS mediumRisk,

      SUM(
        CASE
          WHEN risk_level = 'LOW' THEN 1
          ELSE 0
        END
      ) AS lowRisk

    FROM recovery_cases
  `);

  // =========================================================
  // 2. TOTAL RECOVERED REVENUE
  // =========================================================

  const [recoveredRows] = await db.query(`
    SELECT
      COALESCE(
        SUM(amount_recovered),
        0
      ) AS revenueRecovered
    FROM recovery_actions
    WHERE result = 'RECOVERY_SUCCESS'
  `);

  // =========================================================
  // 3. AI DECISION DISTRIBUTION
  // =========================================================

  const [decisionRows] = await db.query(`
    SELECT
      agent_decision,
      COUNT(*) AS count
    FROM recovery_cases
    WHERE agent_decision IS NOT NULL
    GROUP BY agent_decision
    ORDER BY count DESC
  `);

  // =========================================================
  // 4. FINAL AI DECISION / CONFIDENCE SUMMARY
  // =========================================================

  const [confidenceRows] = await db.query(`
    SELECT
      COUNT(*) AS finalDecisions,

      COALESCE(
        AVG(agent_confidence),
        0
      ) AS avgConfidence

    FROM recovery_cases

    WHERE agent_decision IS NOT NULL
      AND agent_decision <> 'PENDING_AI_REVIEW'
      AND agent_confidence IS NOT NULL
  `);

  // =========================================================
  // 5. UNIQUE GUARDRail-BLOCKED CASES
  //
  // Count each case only once even if the agent was executed
  // multiple times for the same recovery case.
  // =========================================================

  const [blockedRows] = await db.query(`
    SELECT
      COUNT(DISTINCT recovery_case_id) AS blockedActions

    FROM audit_logs

    WHERE event_type = 'GUARDRAIL_BLOCKED'
      AND recovery_case_id IS NOT NULL
  `);

  // =========================================================
  // 6. CONVERT DATABASE VALUES
  // =========================================================

  const totalCases = Number(
    riskRows[0]?.totalCases || 0
  );

  const revenueAtRisk = Number(
    riskRows[0]?.revenueAtRisk || 0
  );

  const revenueRecovered = Number(
    recoveredRows[0]?.revenueRecovered || 0
  );

  const highRisk = Number(
    riskRows[0]?.highRisk || 0
  );

  const mediumRisk = Number(
    riskRows[0]?.mediumRisk || 0
  );

  const lowRisk = Number(
    riskRows[0]?.lowRisk || 0
  );

  const blockedActions = Number(
    blockedRows[0]?.blockedActions || 0
  );

  const finalDecisions = Number(
    confidenceRows[0]?.finalDecisions || 0
  );

  const avgConfidence = Number(
    confidenceRows[0]?.avgConfidence || 0
  );

  // =========================================================
  // 7. RECOVERY RATE
  // =========================================================

  const recoveryRate =
    revenueAtRisk > 0
      ? Number(
          (
            (revenueRecovered / revenueAtRisk) *
            100
          ).toFixed(2)
        )
      : 0;

  // =========================================================
  // 8. POLICY COMPLIANCE
  //
  // Each blocked recovery case is counted only once.
  // =========================================================

  const policyCompliance =
    totalCases > 0
      ? Number(
          (
            ((totalCases - blockedActions) /
              totalCases) *
            100
          ).toFixed(2)
        )
      : 100;

  // =========================================================
  // 9. RETURN DASHBOARD DATA
  // =========================================================

  return {
    totalCases,

    revenueAtRisk,

    revenueRecovered,

    revenueRecoveredToday: 0,

    recoveryRate,

    highRisk,

    mediumRisk,

    lowRisk,

    blockedActions,

    policyCompliance,

    finalDecisions,

    avgConfidence: Number(
      (avgConfidence * 100).toFixed(2)
    ),

    aiDecisions: decisionRows.map((row) => ({
      action: row.agent_decision,
      count: Number(row.count),
    })),
  };
}


// =============================================================
// RECENT RECOVERY CASES
// =============================================================

async function getRecentCases(limit = 20) {
  const safeLimit = Math.min(
    Number(limit) || 20,
    50
  );

  const [rows] = await db.query(
    `
    SELECT
      rc.id,
      rc.payment_id,
      rc.risk_amount,
      rc.risk_reason,
      rc.risk_level,
      rc.status,
      rc.agent_decision,
      rc.agent_confidence,
      rc.recovery_attempts,
      rc.created_at,

      /* -------------------------------------------------------
         Get the LATEST guardrail evaluation for this case.
         
         This is important:
         A previous BLOCKED event should not permanently make
         the case appear BLOCKED.
      ------------------------------------------------------- */

      (
        SELECT al.event_type

        FROM audit_logs al

        WHERE al.recovery_case_id = rc.id

          AND al.event_type IN (
            'GUARDRAIL_APPROVED',
            'GUARDRAIL_BLOCKED'
          )

        ORDER BY al.id DESC

        LIMIT 1
      ) AS latest_guardrail_event,

      /* -------------------------------------------------------
         Get details from the latest guardrail evaluation.
      ------------------------------------------------------- */

      (
        SELECT al.details

        FROM audit_logs al

        WHERE al.recovery_case_id = rc.id

          AND al.event_type IN (
            'GUARDRAIL_APPROVED',
            'GUARDRAIL_BLOCKED'
          )

        ORDER BY al.id DESC

        LIMIT 1
      ) AS latest_guardrail_details

    FROM recovery_cases rc

    ORDER BY
      rc.id DESC

    LIMIT ?
    `,
    [safeLimit]
  );

  // ===========================================================
  // FORMAT RESULTS
  // ===========================================================

  return rows.map((row) => {
    let guardrailReason = null;

    // ---------------------------------------------------------
    // Parse latest guardrail details
    // ---------------------------------------------------------

    if (row.latest_guardrail_details) {
      try {
        const details =
          typeof row.latest_guardrail_details === "string"
            ? JSON.parse(row.latest_guardrail_details)
            : row.latest_guardrail_details;

        guardrailReason =
          details?.reasons?.[0] ||
          details?.reason ||
          details?.message ||
          null;
      } catch {
        guardrailReason = null;
      }
    }

    // ---------------------------------------------------------
    // Determine latest guardrail result
    // ---------------------------------------------------------

    const latestGuardrailEvent =
      String(
        row.latest_guardrail_event || ""
      ).toUpperCase();

    const isBlocked =
      latestGuardrailEvent ===
      "GUARDRAIL_BLOCKED";

    const isApproved =
      latestGuardrailEvent ===
      "GUARDRAIL_APPROVED";

    // ---------------------------------------------------------
    // Return frontend-ready case
    // ---------------------------------------------------------

    return {
      id: row.id,

      paymentId: row.payment_id,

      amount: Number(
        row.risk_amount
      ),

      riskReason:
        row.risk_reason || null,

      // Used by Overview / case details
      agentReason:
        row.risk_reason || null,

      riskLevel:
        row.risk_level,

      status:
        row.status,

      agentDecision:
        row.agent_decision,

      agentConfidence:
        row.agent_confidence !== null
          ? Number(row.agent_confidence)
          : null,

      recoveryAttempts:
        Number(
          row.recovery_attempts || 0
        ),

      createdAt:
        row.created_at,

      // =====================================================
      // LATEST GUARDRail RESULT
      // =====================================================

      guardrailApproved:
        isBlocked
          ? false
          : isApproved
          ? true
          : null,

      guardrailStatus:
        isBlocked
          ? "BLOCKED"
          : isApproved
          ? "APPROVED"
          : "NOT_EVALUATED",

      guardrailReason,
    };
  });   
}


// =============================================================
// EXPORTS
// =============================================================

module.exports = {
  getDashboardSummary,
  getRecentCases,
};