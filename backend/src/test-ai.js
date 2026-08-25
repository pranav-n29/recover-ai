require("dotenv").config();

const {
  analyzeRecoveryCase,
} = require("./services/ai-agent.service");

async function main() {
  const testCase = {
    paymentId: 123,
    amount: 2999,
    currency: "INR",
    status: "FAILED",
    failureReason: "bank_timeout",
    riskLevel: "HIGH",
    riskScore: 0.8,
    previousAttempts: 0,
  };

  console.log("Sending test case to RecoverAI AI Agent...\n");

  const result = await analyzeRecoveryCase(testCase);

  console.log("AI Recovery Recommendation:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("AI test failed:", error);
});