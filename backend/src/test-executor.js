require("dotenv").config();

const db = require("./config/database");
const {
  executeRecovery,
} = require("./services/recovery-executor.service");

async function main() {
  console.log("Testing Razorpay recovery executor...\n");

  // Get a real pending recovery case
  const [cases] = await db.query(`
    SELECT
      id,
      risk_amount,
      risk_level,
      status
    FROM recovery_cases
    WHERE status = 'PENDING'
    ORDER BY id ASC
    LIMIT 1
  `);

  if (cases.length === 0) {
    throw new Error("No pending recovery case found.");
  }

  const recoveryCase = cases[0];

  console.log("Using real recovery case:");
  console.log(recoveryCase);

  const result = await executeRecovery(recoveryCase);

  console.log("\nRecovery Executor Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("\nExecutor test failed:");
  console.error(error.message);
});