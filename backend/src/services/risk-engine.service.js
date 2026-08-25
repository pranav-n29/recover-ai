function calculateRecoveryRisk(payment) {
  let score = 0;
  const reasons = [];

  // Only failed or abandoned payments are candidates
  if (payment.status === "FAILED") {
    score += 0.30;
    reasons.push("Payment failed");
  }

  if (payment.status === "ABANDONED") {
    score += 0.20;
    reasons.push("Checkout was abandoned");
  }

  // Failure reason
  if (
    payment.failure_reason === "temporary_failure" ||
    payment.failure_reason === "bank_timeout" ||
    payment.failure_reason === "gateway_error"
  ) {
    score += 0.30;
    reasons.push("Failure appears potentially recoverable");
  }

  if (payment.failure_reason === "insufficient_funds") {
    score += 0.10;
    reasons.push("Insufficient funds may recover later");
  }

  if (payment.failure_reason === "customer_cancelled") {
    score -= 0.20;
    reasons.push("Customer explicitly cancelled");
  }

  // Previous recovery attempts
  const attempts = Number(payment.recovery_attempts || 0);

  if (attempts === 0) {
    score += 0.20;
    reasons.push("No previous recovery attempt");
  } else if (attempts === 1) {
    score -= 0.05;
    reasons.push("One recovery attempt already made");
  } else {
    score -= 0.30;
    reasons.push("Multiple recovery attempts already made");
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  let riskLevel;

  if (score >= 0.70) {
    riskLevel = "HIGH";
  } else if (score >= 0.40) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  return {
    score: Number(score.toFixed(4)),
    riskLevel,
    reasons,
  };
}

module.exports = {
  calculateRecoveryRisk,
};