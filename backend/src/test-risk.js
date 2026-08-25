const { calculateRecoveryRisk } = require("./services/risk-engine.service");

const testPayment = {
  status: "FAILED",
  failure_reason: "temporary_failure",
  recovery_attempts: 0,
};

const result = calculateRecoveryRisk(testPayment);

console.log("Risk Engine Result:");
console.log(JSON.stringify(result, null, 2));