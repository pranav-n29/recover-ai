const { routeAction } = require("./services/action-router.service");

async function main() {
  const recoveryCase = {
    id: 999,
    risk_amount: 2999,
  };

  const actions = [
    "WAIT_AND_RETRY",
    "ESCALATE",
    "NO_ACTION",
  ];

  for (const action of actions) {
    console.log("\n-----------------------------");
    console.log(`Testing: ${action}`);
    console.log("-----------------------------");

    const result = await routeAction(
      recoveryCase,
      {
        recommendedAction: action,
        confidence: 0.9,
      }
    );

    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("Router test failed:", error);
});