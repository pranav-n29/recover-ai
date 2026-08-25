require("dotenv").config();

const razorpay = require("./services/razorpay.service");

async function main() {
  console.log("Testing Razorpay Test Mode...");

  console.log("orders.create available:",
    typeof razorpay.orders?.create
  );

  const order = await razorpay.orders.create({
    amount: 2999 * 100,
    currency: "INR",
    receipt: `test_recoverai_${Date.now()}`,
  });

  console.log("Razorpay Test Order Created:");
  console.log({
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
  });
}

main().catch((error) => {
  console.error("Razorpay test failed:");
  console.error(error.message);
});