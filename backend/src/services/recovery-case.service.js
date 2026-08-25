const db = require("../config/database");

async function createRecoveryCase(payment, risk) {
  const [result] = await db.query(
    `INSERT INTO recovery_cases
    (
      payment_id,
      risk_amount,
      risk_reason,
      agent_decision,
      agent_confidence,
      risk_level,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.paymentId,
      payment.amount,
      risk.reasons.join("; "),
      "PENDING_AI_REVIEW",
      risk.score,
      risk.riskLevel,
      "PENDING",
    ]
  );

  return result.insertId;
}

async function createAuditLog(recoveryCaseId, eventType, actor, details) {
  await db.query(
    `INSERT INTO audit_logs
    (
      recovery_case_id,
      event_type,
      actor,
      details
    )
    VALUES (?, ?, ?, ?)`,
    [
      recoveryCaseId,
      eventType,
      actor,
      details,
    ]
  );
}

module.exports = {
  createRecoveryCase,
  createAuditLog,
};