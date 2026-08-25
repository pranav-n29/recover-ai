const db = require("../config/database");

const firstNames = [
  "Rahul",
  "Priya",
  "Arjun",
  "Ananya",
  "Vikram",
  "Sneha",
  "Rohan",
  "Neha",
  "Aman",
  "Kavya",
];

const failureReasons = [
  "temporary_failure",
  "bank_timeout",
  "insufficient_funds",
  "gateway_error",
  "customer_cancelled",
];

const paymentMethods = [
  "upi",
  "card",
  "netbanking",
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomAmount() {
  const amounts = [
    499,
    799,
    999,
    1499,
    1999,
    2499,
    2999,
    3999,
    4999,
    7999,
  ];

  return randomItem(amounts);
}

async function generateCustomers(count = 100) {
  const customerIds = [];

  for (let i = 0; i < count; i++) {
    const name = `${randomItem(firstNames)} Customer${i + 1}`;

    const [result] = await db.query(
      `INSERT INTO customers
      (name, email, phone, total_payments, successful_payments, failed_payments)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        `customer${i + 1}@example.com`,
        `90000${String(i).padStart(5, "0")}`,
        0,
        0,
        0,
      ]
    );

    customerIds.push(result.insertId);
  }

  return customerIds;
}

async function generatePayments(count = 1000) {
  const customerIds = await generateCustomers(100);

  let successCount = 0;
  let failedCount = 0;
  let abandonedCount = 0;

  for (let i = 0; i < count; i++) {
    const customerId = randomItem(customerIds);
    const amount = randomAmount();

    const probability = Math.random();

    let status;
    let failureReason = null;

    if (probability < 0.70) {
      status = "SUCCESS";
      successCount++;
    } else if (probability < 0.90) {
      status = "FAILED";
      failureReason = randomItem(failureReasons);
      failedCount++;
    } else {
      status = "ABANDONED";
      failureReason = "checkout_abandoned";
      abandonedCount++;
    }

    await db.query(
      `INSERT INTO payments
      (razorpay_payment_id, customer_id, amount, currency, status, failure_reason, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `synthetic_pay_${Date.now()}_${i}`,
        customerId,
        amount,
        "INR",
        status,
        failureReason,
        randomItem(paymentMethods),
      ]
    );
  }

  return {
    total: count,
    success: successCount,
    failed: failedCount,
    abandoned: abandonedCount,
  };
}

module.exports = {
  generatePayments,
};