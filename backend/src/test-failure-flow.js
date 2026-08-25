require("dotenv").config();

const db = require("./config/database");
const {
  executeRecovery,
} = require("./services/recovery-executor.service");

const {
  recordRecoveryOutcome,
} = require("./services/recovery-outcome.service");

async function main() {
  const recoveryCaseId = 3;

  console.log("========================================");
  console.log(" RECOVERAI FAILURE HANDLING TEST");
  console.log("========================================\n");

  // --------------------------------------------
  // Get Case #3
  // --------------------------------------------

  const [cases] = await db.query(
    `SELECT
       id,
       risk_amount,
       risk_level,
       status,
       agent_decision,
       recovery_attempts
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCaseId]
  );

  if (cases.length === 0) {
    throw new Error("Recovery case #3 not found");
  }

  let recoveryCase = cases[0];

  console.log("Initial Case:");
  console.log(recoveryCase);

  // --------------------------------------------
  // ATTEMPT #1
  // --------------------------------------------

  console.log("\n========================================");
  console.log(" ATTEMPT #1");
  console.log("========================================");

  const firstExecution =
    await executeRecovery(recoveryCase);

  console.log("\nRecovery order created:");
  console.log(firstExecution);

  const firstFailure =
    await recordRecoveryOutcome(
      recoveryCase.id,
      "FAILED"
    );

  console.log("\nFirst recovery failure:");
  console.log(firstFailure);

  // --------------------------------------------
  // Reload case
  // --------------------------------------------

  const [afterFirst] = await db.query(
    `SELECT
       id,
       risk_amount,
       risk_level,
       status,
       agent_decision,
       recovery_attempts
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCase.id]
  );

  recoveryCase = afterFirst[0];

  console.log("\nCase after Attempt #1:");
  console.log(recoveryCase);

  // --------------------------------------------
  // ATTEMPT #2
  // --------------------------------------------

  console.log("\n========================================");
  console.log(" ATTEMPT #2");
  console.log("========================================");

  const secondExecution =
    await executeRecovery(recoveryCase);

  console.log("\nSecond recovery order created:");
  console.log(secondExecution);

  const secondFailure =
    await recordRecoveryOutcome(
      recoveryCase.id,
      "FAILED"
    );

  console.log("\nSecond recovery failure:");
  console.log(secondFailure);

  // --------------------------------------------
  // FINAL STATE
  // --------------------------------------------

  const [finalRows] = await db.query(
    `SELECT
       id,
       risk_amount,
       status,
       recovery_attempts
     FROM recovery_cases
     WHERE id = ?`,
    [recoveryCase.id]
  );

  console.log("\n========================================");
  console.log(" FINAL CASE STATE");
  console.log("========================================");

  console.log(finalRows[0]);

  process.exit(0);
}

main().catch((error) => {
  console.error("\nFailure-flow test failed:");
  console.error(error.message);

  process.exit(1);
});