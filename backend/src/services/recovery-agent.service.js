const db = require("../config/database");
const { analyzeRecoveryCase } = require("./ai-agent.service");
const {
  evaluateAction,
  MAX_RECOVERY_ATTEMPTS,
} = require("./guardrail.service");
const { routeAction } = require("./action-router.service");

async function processRecoveryCase(recoveryCase) {
  // --------------------------------------------
  // 1. Get current recovery attempts
  // --------------------------------------------

  const currentAttempts = Number(
    recoveryCase.recovery_attempts || 0
  );

  // --------------------------------------------
  // 2. HARD GUARDRAIL:
  // Never allow an action after max attempts
  // --------------------------------------------

  if (currentAttempts >= MAX_RECOVERY_ATTEMPTS) {
    const guardrailResult = {
      approved: false,
      reason: "Maximum recovery attempts reached",
      reasons: [
        `Recovery attempts (${currentAttempts}) have reached the maximum allowed (${MAX_RECOVERY_ATTEMPTS})`,
      ],
    };

    await db.query(
      `UPDATE recovery_cases
       SET status = 'RETRY_LIMIT_REACHED'
       WHERE id = ?`,
      [recoveryCase.id]
    );

    await db.query(
      `INSERT INTO audit_logs
       (recovery_case_id, event_type, actor, details)
       VALUES (?, ?, ?, ?)`,
      [
        recoveryCase.id,
        "GUARDRAIL_BLOCKED",
        "guardrail-engine",
        JSON.stringify(guardrailResult),
      ]
    );

    return {
      recoveryCaseId: recoveryCase.id,
      aiRecommendation: null,
      guardrailResult,
      actionResult: null,
    };
  }

  // --------------------------------------------
  // 3. Ask AI for a recommendation
  // --------------------------------------------

  const aiRecommendation = await analyzeRecoveryCase({
    paymentId: recoveryCase.payment_id,
    amount: Number(recoveryCase.risk_amount),
    riskLevel: recoveryCase.risk_level,
    riskScore: Number(recoveryCase.agent_confidence || 0),
    failureReason: recoveryCase.risk_reason,
    previousAttempts: currentAttempts,
  });

  // --------------------------------------------
  // 4. Run guardrails
  // --------------------------------------------

  const guardrailResult = evaluateAction(
    {
      risk_amount: recoveryCase.risk_amount,
      risk_level: recoveryCase.risk_level,
      recovery_attempts: currentAttempts,
    },
    aiRecommendation
  );

  // --------------------------------------------
  // 5. Store AI decision
  // --------------------------------------------

  await db.query(
    `UPDATE recovery_cases
     SET agent_decision = ?,
         agent_confidence = ?
     WHERE id = ?`,
    [
      aiRecommendation.recommendedAction,
      aiRecommendation.confidence,
      recoveryCase.id,
    ]
  );

  // --------------------------------------------
  // 6. Audit AI decision
  // --------------------------------------------

  await db.query(
    `INSERT INTO audit_logs
     (recovery_case_id, event_type, actor, details)
     VALUES (?, ?, ?, ?)`,
    [
      recoveryCase.id,
      "AI_DECISION",
      "gemini-agent",
      JSON.stringify(aiRecommendation),
    ]
  );

  // --------------------------------------------
  // 7. Audit guardrail decision
  // --------------------------------------------

  await db.query(
    `INSERT INTO audit_logs
     (recovery_case_id, event_type, actor, details)
     VALUES (?, ?, ?, ?)`,
    [
      recoveryCase.id,
      guardrailResult.approved
        ? "GUARDRAIL_APPROVED"
        : "GUARDRAIL_BLOCKED",
      "guardrail-engine",
      JSON.stringify(guardrailResult),
    ]
  );

  // --------------------------------------------
  // 8. Execute ONLY if guardrails approve
  // --------------------------------------------

  let actionResult = null;

  if (guardrailResult.approved) {
    actionResult = await routeAction(
      {
        ...recoveryCase,
        recovery_attempts: currentAttempts,
      },
      aiRecommendation
    );

    await db.query(
      `INSERT INTO audit_logs
       (recovery_case_id, event_type, actor, details)
       VALUES (?, ?, ?, ?)`,
      [
        recoveryCase.id,
        actionResult.executed
          ? "RECOVERY_ACTION_EXECUTED"
          : "RECOVERY_ACTION_DEFERRED",
        "action-router",
        JSON.stringify(actionResult),
      ]
    );
  }

  return {
    recoveryCaseId: recoveryCase.id,
    aiRecommendation,
    guardrailResult,
    actionResult,
  };
}

async function getPendingRecoveryCases(
  limit = 10,
  caseId = null
) {
  if (caseId) {
    const [rows] = await db.query(
      `SELECT
         rc.id,
         rc.payment_id,
         rc.risk_amount,
         rc.risk_reason,
         rc.agent_decision,
         rc.agent_confidence,
         rc.risk_level,
         rc.recovery_attempts,
         rc.status
       FROM recovery_cases rc
       WHERE rc.id = ?
         AND rc.status = 'PENDING'
         AND rc.recovery_attempts < ?
       LIMIT 1`,
      [caseId, MAX_RECOVERY_ATTEMPTS]
    );

    return rows;
  }

  const [rows] = await db.query(
    `SELECT
       rc.id,
       rc.payment_id,
       rc.risk_amount,
       rc.risk_reason,
       rc.agent_decision,
       rc.agent_confidence,
       rc.risk_level,
       rc.recovery_attempts,
       rc.status
     FROM recovery_cases rc
     WHERE rc.status = 'PENDING'
       AND rc.recovery_attempts < ?
     ORDER BY rc.created_at ASC
     LIMIT ?`,
    [MAX_RECOVERY_ATTEMPTS, limit]
  );

  return rows;
}

module.exports = {
  processRecoveryCase,
  getPendingRecoveryCases,
};