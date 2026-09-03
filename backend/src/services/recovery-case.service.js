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

async function getRecoveryCaseDetails(recoveryCaseId) {
  const [caseRows] = await db.query(
    `SELECT
       id,
       payment_id,
       risk_amount,
       risk_reason,
       agent_decision,
       agent_confidence,
       risk_level,
       status,
       created_at
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCaseId]
  );

  if (caseRows.length === 0) {
    throw new Error("Recovery case not found");
  }

  const recoveryCase = caseRows[0];

  const [actionRows] = await db.query(
    `SELECT
       id,
       recovery_case_id,
       action_type,
       approved,
       result,
       amount_recovered
     FROM recovery_actions
     WHERE recovery_case_id = ?
     ORDER BY id DESC`,
    [recoveryCaseId]
  );

 const [auditRows] = await db.query(
  `SELECT
     id,
     recovery_case_id,
     event_type,
     actor,
     details,
     created_at AS timestamp
   FROM audit_logs
   WHERE recovery_case_id = ?
   ORDER BY id ASC`,
  [recoveryCaseId]
);

  return {
    case: {
      id: recoveryCase.id,
      paymentId: recoveryCase.payment_id,
      amount: Number(recoveryCase.risk_amount),
      riskReason: recoveryCase.risk_reason,
      agentDecision: recoveryCase.agent_decision,
      agentConfidence:
        recoveryCase.agent_confidence !== null
          ? Number(recoveryCase.agent_confidence)
          : null,
      riskLevel: recoveryCase.risk_level,
      status: recoveryCase.status,
      createdAt: recoveryCase.created_at,
    },

    actions: actionRows.map((action) => ({
      id: action.id,
      actionType: action.action_type,
      approved: Boolean(action.approved),
      result: action.result,
      amountRecovered:
        action.amount_recovered !== null
          ? Number(action.amount_recovered)
          : 0,
    })),

   auditTrail: auditRows.map((audit) => ({
  id: audit.id,
  eventType: audit.event_type,
  actor: audit.actor,
  details: audit.details,
  timestamp: audit.timestamp,
})),
  };
}

module.exports = {
  createRecoveryCase,
  createAuditLog,
  getRecoveryCaseDetails,
};