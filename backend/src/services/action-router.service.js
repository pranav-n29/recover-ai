const {
  executeRecovery,
} = require("./recovery-executor.service");

async function routeAction(recoveryCase, aiRecommendation) {
  const action = aiRecommendation.recommendedAction;

  switch (action) {
    case "SEND_RECOVERY_LINK":
      return {
        executed: true,
        action,
        result: await executeRecovery(recoveryCase),
      };

    case "RETRY_PAYMENT":
      return {
        executed: false,
        action,
        result: "AUTOMATIC_RETRY_NOT_ENABLED",
        message:
          "Payment retry requires an explicit retry workflow.",
      };

    case "WAIT_AND_RETRY":
      return {
        executed: false,
        action,
        result: "WAIT_REQUIRED",
        message:
          "Recovery deferred because the AI recommended waiting.",
      };

    case "ESCALATE":
      return {
        executed: false,
        action,
        result: "HUMAN_REVIEW_REQUIRED",
        message:
          "Case escalated for human review.",
      };

    case "NO_ACTION":
      return {
        executed: false,
        action,
        result: "NO_ACTION",
        message:
          "No recovery action will be taken.",
      };

    default:
      return {
        executed: false,
        action,
        result: "BLOCKED",
        message:
          "Unknown action blocked by action router.",
      };
  }
}

module.exports = {
  routeAction,
};