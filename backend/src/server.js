// Load environment variables first
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  getAuditLogs,
  getCaseAuditLogs,
} = require("./services/audit.service");
const {
  ALLOWED_ACTIONS,
  MAX_RECOVERY_ATTEMPTS,
  MAX_RECOVERY_AMOUNT,
} = require("./services/guardrail.service");

const razorpay = require("./services/razorpay.service");
const db = require("./config/database");

const {
  generatePayments,
} = require("./services/data-generator.service");

const {
  analyzePayments,
  persistRecoveryCases,
  calculateSummary,
} = require("./services/recovery-analysis.service");

const {
  processRecoveryCase,
  getPendingRecoveryCases,
} = require("./services/recovery-agent.service");
const {
  recordRecoveryOutcome,
} = require("./services/recovery-outcome.service");

const {
  getDashboardSummary,
  getRecentCases,
} = require("./services/dashboard.service");

const {
  getRecoveryCaseDetails,
} = require("./services/recovery-case.service");

const {
  createRecoveryCase,
  createAuditLog,
} = require("./services/recovery-case.service");

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// BASIC HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "RecoverAI",
    message: "Backend is running",
  });
});

// ======================================================
// DATABASE HEALTH CHECK
// ======================================================

app.get("/api/health/db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS connected");

    res.json({
      status: "ok",
      database: "MySQL",
      result: rows[0],
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// ======================================================
// RAZORPAY TEST MODE ORDER
// ======================================================

app.post("/api/test/razorpay-order", async (req, res) => {
  try {
    const options = {
      amount: 50000,
      currency: "INR",
      receipt: `recoverai_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      message: "Razorpay Test Mode order created",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create Razorpay order",
      error: error.error?.description || error.message,
    });
  }
});

// ======================================================
// SYNTHETIC PAYMENT DATA GENERATOR
// ======================================================

app.post("/api/dev/generate-payments", async (req, res) => {
  try {
    const count = Number(req.body.count) || 1000;

    if (count < 1 || count > 10000) {
      return res.status(400).json({
        success: false,
        message: "Count must be between 1 and 10000",
      });
    }

    const result = await generatePayments(count);

    res.json({
      success: true,
      message: "Synthetic payment data generated",
      result,
    });
  } catch (error) {
    console.error("Data generation failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate payment data",
      error: error.message,
    });
  }
});

// ======================================================
// REVENUE RECOVERY ANALYSIS
// ======================================================

app.post("/api/recovery/analyze", async (req, res) => {
  try {
    const results = await analyzePayments();

    const createdCases = await persistRecoveryCases(results);

    const summary = calculateSummary(results);

    res.json({
      success: true,
      summary,
      createdRecoveryCases: createdCases,
      results,
    });
  } catch (error) {
    console.error("Recovery analysis failed:", error);

    res.status(500).json({
      success: false,
      message: "Recovery analysis failed",
      error: error.message,
    });
  }
});

app.post("/api/recovery/run-agent", async (req, res) => {
  try {
   const limit = Math.min(
  Number(req.body.limit) || 5,
  10
);

const caseId = req.body.caseId
  ? Number(req.body.caseId)
  : null;

const cases = await getPendingRecoveryCases(
  limit,
  caseId
);

    if (cases.length === 0) {
      return res.json({
        success: true,
        message: "No pending recovery cases",
        processed: 0,
        results: [],
      });
    }

    const results = [];

    for (const recoveryCase of cases) {
      try {
        const result = await processRecoveryCase(recoveryCase);

        results.push({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error(
          `Recovery case ${recoveryCase.id} failed:`,
          error
        );

        results.push({
          success: false,
          recoveryCaseId: recoveryCase.id,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Agent execution failed:", error);

    res.status(500).json({
      success: false,
      message: "Agent execution failed",
      error: error.message,
    });
  }
});

app.post("/api/recovery/outcome", async (req, res) => {
  try {
    const recoveryCaseId = Number(req.body.recoveryCaseId);
    const outcome = req.body.outcome;

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "recoveryCaseId is required",
      });
    }

    if (!["SUCCESS", "FAILED"].includes(outcome)) {
      return res.status(400).json({
        success: false,
        message: "Outcome must be SUCCESS or FAILED",
      });
    }

    const result = await recordRecoveryOutcome(
      recoveryCaseId,
      outcome
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Recovery outcome failed:", error);

    res.status(500).json({
      success: false,
      message: "Could not record recovery outcome",
      error: error.message,
    });
  }
});

// Dashboard summary
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const summary = await getDashboardSummary();

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error(
      "Dashboard summary failed:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Could not load dashboard summary",
      error: error.message,
    });
  }
});

// Dashboard recovery cases
app.get("/api/dashboard/cases", async (req, res) => {
  try {
    const cases = await getRecentCases(
      req.query.limit
    );

    res.json({
      success: true,
      cases,
    });
  } catch (error) {
    console.error(
      "Dashboard cases failed:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Could not load recovery cases",
      error: error.message,
    });
  }
});

app.get("/api/recovery/cases/:id", async (req, res) => {
  try {
    const recoveryCaseId = Number(req.params.id);

    if (!Number.isInteger(recoveryCaseId) || recoveryCaseId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid recovery case ID",
      });
    }

    const result = await getRecoveryCaseDetails(
      recoveryCaseId
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Recovery case details failed:",
      error
    );

    if (error.message === "Recovery case not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not load recovery case",
      error: error.message,
    });
  }
});

// Guardrails configuration
app.get("/api/guardrails", (req, res) => {
  res.json({
    success: true,
    guardrails: {
      maxRecoveryAttempts: MAX_RECOVERY_ATTEMPTS,
      maxRecoveryAmount: MAX_RECOVERY_AMOUNT,
      minimumAIConfidence: 0.60,
      lowRiskAutomatedRecovery: false,
      allowedActions: ALLOWED_ACTIONS,
    },
  });
});

// Audit trail
app.get("/api/audit", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;

    const logs = await getAuditLogs(limit);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Audit trail error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch audit trail",
      error: error.message,
    });
  }
});

// Audit trail for a specific recovery case
app.get("/api/audit/case/:id", async (req, res) => {
  try {
    const recoveryCaseId = Number(req.params.id);

    if (!recoveryCaseId) {
      return res.status(400).json({
        success: false,
        message: "Invalid recovery case ID",
      });
    }

    const logs = await getCaseAuditLogs(recoveryCaseId);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Case audit trail error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch case audit trail",
      error: error.message,
    });
  }
});

// ======================================================
// GUARDRail TEST CASE
// Creates one guaranteed high-value failed payment
// ======================================================

app.post("/api/dev/create-guardrail-test", async (req, res) => {
  try {
    // Create a test customer
    const [customerResult] = await db.query(
      `INSERT INTO customers
      (
        name,
        email,
        phone,
        total_payments,
        successful_payments,
        failed_payments
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "Guardrail Test Customer",
        `guardrail_test_${Date.now()}@example.com`,
        "9999999999",
        0,
        0,
        1,
      ]
    );

    const customerId = customerResult.insertId;

    // Create a payment ABOVE the ₹10,000 recovery limit
    const [paymentResult] = await db.query(
      `INSERT INTO payments
      (
        razorpay_payment_id,
        customer_id,
        amount,
        currency,
        status,
        failure_reason,
        payment_method
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `guardrail_test_${Date.now()}`,
        customerId,
        14999,
        "INR",
        "FAILED",
        "gateway_error",
        "card",
      ]
    );

    res.json({
      success: true,
      message: "Guardrail test payment created",
      paymentId: paymentResult.insertId,
      amount: 14999,
      status: "FAILED",
      expectedGuardrail: "BLOCKED",
    });
  } catch (error) {
    console.error(
      "Guardrail test creation failed:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Could not create guardrail test case",
      error: error.message,
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `RecoverAI backend running on http://localhost:${PORT}`
  );
});