const razorpay = require("./razorpay.service");
const db = require("../config/database");

const MAX_RECOVERY_ATTEMPTS = 2;
const MAX_RECOVERY_AMOUNT = 10000;

async function executeRecovery(recoveryCase) {
  const amount = Number(recoveryCase.risk_amount);
  const attempts = Number(recoveryCase.recovery_attempts || 0);

  // Safety check: amount
  if (amount <= 0) {
    throw new Error("Invalid recovery amount");
  }

  if (amount > MAX_RECOVERY_AMOUNT) {
    throw new Error(
      `Recovery amount exceeds automated limit of ₹${MAX_RECOVERY_AMOUNT}`
    );
  }

  // Safety check: attempts
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    throw new Error(
      `Maximum recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached`
    );
  }

  const newAttemptNumber = attempts + 1;

  const receipt = `recover_${recoveryCase.id}_${Date.now()}`;

  // Create Razorpay Test Mode order
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt,
  });

  // Increment attempt count
  await db.query(
    `UPDATE recovery_cases
     SET recovery_attempts = ?,
         status = 'RECOVERY_INITIATED'
     WHERE id = ?`,
    [
      newAttemptNumber,
      recoveryCase.id,
    ]
  );

  // Store recovery action
  await db.query(
    `INSERT INTO recovery_actions
     (
       recovery_case_id,
       action_type,
       reason,
       approved,
       result,
       amount_recovered,
       external_reference
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      recoveryCase.id,
      "CREATE_RECOVERY_ORDER",
      "Guardrail-approved recovery execution",
      true,
      "RECOVERY_LINK_CREATED",
      0,
      order.id,
    ]
  );

  // Audit
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
      recoveryCase.id,
      "RECOVERY_ORDER_CREATED",
      "recovery-executor",
      JSON.stringify({
        orderId: order.id,
        amount,
        currency: "INR",
        attempt: newAttemptNumber,
      }),
    ]
  );

  return {
    success: true,
    orderId: order.id,
    amount,
    currency: "INR",
    status: "RECOVERY_LINK_CREATED",
    attempt: newAttemptNumber,
    attemptsRemaining:
      MAX_RECOVERY_ATTEMPTS - newAttemptNumber,
  };
}

module.exports = {
  executeRecovery,
  MAX_RECOVERY_ATTEMPTS,
  MAX_RECOVERY_AMOUNT,
};