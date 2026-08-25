const db = require("../config/database");
const { calculateRecoveryRisk } = require("./risk-engine.service");
const {
  createRecoveryCase,
  createAuditLog,
} = require("./recovery-case.service");

async function analyzePayments() {
const [payments] = await db.query(`
    SELECT
      p.id,
      p.razorpay_payment_id,
      p.customer_id,
      p.amount,
      p.currency,
      p.status,
      p.failure_reason,
      p.payment_method
    FROM payments p
    LEFT JOIN recovery_cases rc
      ON rc.payment_id = p.id
    WHERE p.status IN ('FAILED', 'ABANDONED')
      AND rc.id IS NULL
  `);

  const results = [];

  for (const payment of payments) {
    const risk = calculateRecoveryRisk({
      ...payment,
      recovery_attempts: 0,
    });

    const paymentResult = {
      paymentId: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      failureReason: payment.failure_reason,
      riskScore: risk.score,
      riskLevel: risk.riskLevel,
      reasons: risk.reasons,
    };

    results.push(paymentResult);
  }

  return results;
}

async function persistRecoveryCases(results) {
  let created = 0;

  for (const result of results) {
    const recoveryCaseId = await createRecoveryCase(result, {
      score: result.riskScore,
      riskLevel: result.riskLevel,
      reasons: result.reasons,
    });

    await createAuditLog(
      recoveryCaseId,
      "RISK_DETECTED",
      "risk-engine",
      JSON.stringify({
        paymentId: result.paymentId,
        amount: result.amount,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        reasons: result.reasons,
      })
    );

    created++;
  }

  return created;
}

function calculateSummary(results) {
  const summary = {
    totalCandidates: results.length,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
    revenueAtRisk: 0,
  };

  for (const result of results) {
    summary.revenueAtRisk += result.amount;

    if (result.riskLevel === "HIGH") {
      summary.highRisk++;
    } else if (result.riskLevel === "MEDIUM") {
      summary.mediumRisk++;
    } else {
      summary.lowRisk++;
    }
  }

  summary.revenueAtRisk = Number(
    summary.revenueAtRisk.toFixed(2)
  );

  return summary;
}

module.exports = {
  analyzePayments,
  persistRecoveryCases,
  calculateSummary,
};