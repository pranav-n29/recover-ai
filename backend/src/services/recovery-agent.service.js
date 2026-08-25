const db = require("../config/database");
const { analyzeRecoveryCase } = require("./ai-agent.service");
const { evaluateAction } = require("./guardrail.service");
const {
  routeAction,
} = require("./action-router.service");
async function processRecoveryCase(recoveryCase) {
  // --------------------------------------------
  // 1. Ask AI for a recommendation
  // --------------------------------------------

  const aiRecommendation = await analyzeRecoveryCase({
    paymentId: recoveryCase.payment_id,
    amount: Number(recoveryCase.risk_amount),
    riskLevel: recoveryCase.risk_level,
    riskScore: Number(recoveryCase.agent_confidence),
    failureReason: recoveryCase.risk_reason,
    previousAttempts: recoveryCase.recovery_attempts || 0,
  });

  // --------------------------------------------
  // 2. Run guardrails
  // --------------------------------------------

  const guardrailResult = evaluateAction(
    {
      risk_amount: recoveryCase.risk_amount,
      risk_level: recoveryCase.risk_level,
      recovery_attempts: recoveryCase.recovery_attempts || 0,
    },
    aiRecommendation
  );

  // --------------------------------------------
  // 3. Store AI decision
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
  // 4. Audit AI decision
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
  // 5. Audit guardrail decision
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
  // 6. Execute ONLY if guardrails approve
  // --------------------------------------------

  let actionResult = null;

  if (guardrailResult.approved) {
    actionResult = await routeAction(
      recoveryCase,
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

async function getPendingRecoveryCases(limit = 10) {
  const [rows] = await db.query(
    `SELECT
       rc.id,
       rc.payment_id,
       rc.risk_amount,
       rc.risk_reason,
       rc.agent_decision,
       rc.agent_confidence,
       rc.risk_level,
       rc.status
     FROM recovery_cases rc
     WHERE rc.status = 'PENDING'
     ORDER BY rc.created_at ASC
     LIMIT ?`,
    [limit]
  );

  return rows;
}

module.exports = {
  processRecoveryCase,
  getPendingRecoveryCases,
};