const ALLOWED_ACTIONS = [
  "SEND_RECOVERY_LINK",
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "ESCALATE",
  "NO_ACTION",
];

const MAX_RECOVERY_ATTEMPTS = 2;
const MAX_RECOVERY_AMOUNT = 10000;

function evaluateAction(recoveryCase, aiRecommendation) {
  const reasons = [];

  // 1. Validate AI action
  if (!ALLOWED_ACTIONS.includes(aiRecommendation.recommendedAction)) {
    return {
      approved: false,
      reason: "AI recommended an unsupported action",
      reasons: ["Unsupported action"],
    };
  }

  // 2. Validate amount
  if (Number(recoveryCase.risk_amount) > MAX_RECOVERY_AMOUNT) {
    reasons.push(
      `Amount exceeds recovery limit of ₹${MAX_RECOVERY_AMOUNT}`
    );
  }

  // 3. Validate recovery attempts
  const attempts = Number(recoveryCase.recovery_attempts || 0);

  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    reasons.push(
      `Maximum recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached`
    );
  }

  // 4. Don't allow recovery actions for low-risk cases
  if (
    recoveryCase.risk_level === "LOW" &&
    aiRecommendation.recommendedAction !== "NO_ACTION"
  ) {
    reasons.push("Low-risk case requires no automated recovery action");
  }

  // 5. Confidence threshold
  if (Number(aiRecommendation.confidence) < 0.60) {
    reasons.push("AI confidence is below the minimum threshold of 0.60");
  }

  if (reasons.length > 0) {
    return {
      approved: false,
      reason: "Action blocked by guardrails",
      reasons,
    };
  }

  return {
    approved: true,
    reason: "Action passed all guardrail checks",
    reasons: [],
  };
}

module.exports = {
  evaluateAction,
  ALLOWED_ACTIONS,
  MAX_RECOVERY_ATTEMPTS,
  MAX_RECOVERY_AMOUNT,
};