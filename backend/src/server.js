const express = require("express");
const cors = require("cors");
require("dotenv").config();

const razorpay = require("./services/razorpay.service");
const db = require("./config/database");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "RecoverAI",
    message: "Backend is running",
  });
});

// Database health check
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

// Razorpay Test Mode order
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

// Start server
app.listen(PORT, () => {
  console.log(`RecoverAI backend running on http://localhost:${PORT}`);
});