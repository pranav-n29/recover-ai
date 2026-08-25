// Load environment variables first
require("dotenv").config();

const express = require("express");
const cors = require("cors");

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

    const cases = await getPendingRecoveryCases(limit);

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

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(
    `RecoverAI backend running on http://localhost:${PORT}`
  );
});