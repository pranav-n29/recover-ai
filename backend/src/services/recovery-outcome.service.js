const db = require("../config/database");
const {
  MAX_RECOVERY_ATTEMPTS,
} = require("./guardrail.service");

async function recordRecoveryOutcome(
  recoveryCaseId,
  outcome
) {
  const [cases] = await db.query(
    `SELECT
       id,
       risk_amount,
       recovery_attempts,
       status
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCaseId]
  );

  if (cases.length === 0) {
    throw new Error("Recovery case not found");
  }

  const recoveryCase = cases[0];

  const attempts = Number(
    recoveryCase.recovery_attempts || 0
  );

  // ==================================================
  // SUCCESS
  // ==================================================

  if (outcome === "SUCCESS") {
    const amountRecovered = Number(
      recoveryCase.risk_amount
    );

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
          attempt: attempts,
        }),
      ]
    );

    return {
      success: true,
      status: "RECOVERED",
      amountRecovered,
      attempts,
    };
  }

  // ==================================================
  // FAILED
  // ==================================================

  if (outcome === "FAILED") {

    // --------------------------------------------
    // HARD STOP:
    // Never increment beyond maximum attempts
    // --------------------------------------------

    if (attempts >= MAX_RECOVERY_ATTEMPTS) {

      // Make sure status is terminal
      await db.query(
        `UPDATE recovery_cases
         SET status = 'RETRY_LIMIT_REACHED'
         WHERE id = ?`,
        [recoveryCaseId]
      );

      // Do NOT create another RECOVERY_FAILED event
      // and do NOT increment the counter.

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
            maxAttempts: MAX_RECOVERY_ATTEMPTS,
          }),
        ]
      );

      return {
        success: false,
        status: "RETRY_LIMIT_REACHED",
        amountRecovered: 0,
        attempts,
        stopped: true,
        retryAllowed: false,
      };
    }

    // --------------------------------------------
    // Count the new failed attempt
    // --------------------------------------------

    const newAttempts = attempts + 1;

    await db.query(
      `UPDATE recovery_cases
       SET recovery_attempts = ?
       WHERE id = ?`,
      [newAttempts, recoveryCaseId]
    );

    // --------------------------------------------
    // Mark latest recovery action as failed
    // --------------------------------------------

    await db.query(
      `UPDATE recovery_actions
       SET result = 'RECOVERY_FAILED'
       WHERE recovery_case_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [recoveryCaseId]
    );

    // --------------------------------------------
    // Audit failure
    // --------------------------------------------

    await db.query(
      `INSERT INTO audit_logs
       (recovery_case_id, event_type, actor, details)
       VALUES (?, ?, ?, ?)`,
      [
        recoveryCaseId,
        "RECOVERY_FAILED",
        "recovery-system",
        JSON.stringify({
          attempt: newAttempts,
          maxAttempts: MAX_RECOVERY_ATTEMPTS,
          message: "Recovery attempt failed",
        }),
      ]
    );

    // --------------------------------------------
    // Maximum reached AFTER this attempt
    // --------------------------------------------

    if (newAttempts >= MAX_RECOVERY_ATTEMPTS) {

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
            attempts: newAttempts,
            maxAttempts: MAX_RECOVERY_ATTEMPTS,
          }),
        ]
      );

      return {
        success: false,
        status: "RETRY_LIMIT_REACHED",
        amountRecovered: 0,
        attempts: newAttempts,
        stopped: true,
        retryAllowed: false,
      };
    }

    // --------------------------------------------
    // Retry is still allowed
    // --------------------------------------------

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
      attempts: newAttempts,
      stopped: false,
      retryAllowed: true,
    };
  }

  throw new Error(
    "Invalid recovery outcome"
  );
}

module.exports = {
  recordRecoveryOutcome,
};