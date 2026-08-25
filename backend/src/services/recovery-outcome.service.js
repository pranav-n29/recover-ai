const db = require("../config/database");

async function recordRecoveryOutcome(
  recoveryCaseId,
  outcome
) {
  const [cases] = await db.query(
    `SELECT
       id,
       risk_amount,
       status
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCaseId]
  );

  if (cases.length === 0) {
    throw new Error("Recovery case not found");
  }

  const recoveryCase = cases[0];

  if (outcome === "SUCCESS") {
    const amountRecovered = Number(recoveryCase.risk_amount);

    await db.query(
      `UPDATE recovery_cases
       SET status = 'RECOVERED'
       WHERE id = ?`,
      [recoveryCaseId]
    );

    await db.query(
      `UPDATE recovery_actions
       SET result = 'RECOVERY_SUCCESS',
           amount_recovered = ?
       WHERE recovery_case_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [amountRecovered, recoveryCaseId]
    );

    await db.query(
      `INSERT INTO audit_logs
       (recovery_case_id, event_type, actor, details)
       VALUES (?, ?, ?, ?)`,
      [
        recoveryCaseId,
        "RECOVERY_SUCCESS",
        "recovery-system",
        JSON.stringify({
          amountRecovered,
        }),
      ]
    );

    return {
      success: true,
      status: "RECOVERED",
      amountRecovered,
    };
  }

if (outcome === "FAILED") {
  const [attemptRows] = await db.query(
    `SELECT recovery_attempts
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCaseId]
  );

  const attempts = Number(
    attemptRows[0].recovery_attempts || 0
  );

  await db.query(
    `UPDATE recovery_actions
     SET result = 'RECOVERY_FAILED'
     WHERE recovery_case_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [recoveryCaseId]
  );

  await db.query(
    `INSERT INTO audit_logs
     (recovery_case_id, event_type, actor, details)
     VALUES (?, ?, ?, ?)`,
    [
      recoveryCaseId,
      "RECOVERY_FAILED",
      "recovery-system",
      JSON.stringify({
        attempt: attempts,
        message: "Recovery attempt failed",
      }),
    ]
  );

  // Stop after maximum attempts
  if (attempts >= 2) {
    await db.query(
      `UPDATE recovery_cases
       SET status = 'RETRY_LIMIT_REACHED'
       WHERE id = ?`,
      [recoveryCaseId]
    );

    await db.query(
      `INSERT INTO audit_logs
       (recovery_case_id, event_type, actor, details)
       VALUES (?, ?, ?, ?)`,
      [
        recoveryCaseId,
        "RECOVERY_STOPPED",
        "guardrail-engine",
        JSON.stringify({
          reason: "Maximum recovery attempts reached",
          attempts,
        }),
      ]
    );

    return {
      success: false,
      status: "RETRY_LIMIT_REACHED",
      amountRecovered: 0,
      attempts,
      stopped: true,
    };
  }

  // Retry still allowed
  await db.query(
    `UPDATE recovery_cases
     SET status = 'RECOVERY_FAILED'
     WHERE id = ?`,
    [recoveryCaseId]
  );

  return {
    success: false,
    status: "RECOVERY_FAILED",
    amountRecovered: 0,
    attempts,
    stopped: false,
    retryAllowed: true,
  };
}

  throw new Error(
    "Outcome must be SUCCESS or FAILED"
  );
}

module.exports = {
  recordRecoveryOutcome,
};