const { evaluateAction } = require("./services/guardrail.service");

const recoveryCase = {
  risk_amount: 2999,
  risk_level: "HIGH",
  recovery_attempts: 0,
};

const aiRecommendation = {
  recommendedAction: "WAIT_AND_RETRY",
  confidence: 0.3,
};

const result = evaluateAction(
  recoveryCase,
  aiRecommendation
);

console.log("Guardrail Result:");
console.log(JSON.stringify(result, null, 2));