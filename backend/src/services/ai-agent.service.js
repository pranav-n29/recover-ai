const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const ALLOWED_ACTIONS = [
  "SEND_RECOVERY_LINK",
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "ESCALATE",
  "NO_ACTION",
];

/* =========================================================
   FALLBACK AI
   Used when Gemini is unavailable or quota is exceeded.
========================================================= */

function getFallbackRecommendation(recoveryCase) {
  const riskLevel = String(
    recoveryCase?.riskLevel || ""
  ).toUpperCase();

  const amount = Number(
    recoveryCase?.amount || 0
  );

  const previousAttempts = Number(
    recoveryCase?.previousAttempts || 0
  );

  // LOW risk
  if (riskLevel === "LOW") {
    return {
      diagnosis:
        "The payment represents a low-risk recovery opportunity.",

      recommendedAction: "NO_ACTION",

      confidence: 0.9,

      reason:
        "Low-risk cases should not trigger automated recovery.",

      customerMessage:
        "No action is required at this time.",
    };
  }

  // HIGH risk
  if (riskLevel === "HIGH") {
    if (previousAttempts >= 2) {
      return {
        diagnosis:
          "The payment remains high risk but has reached the recovery attempt limit.",

        recommendedAction: "NO_ACTION",

        confidence: 0.9,

        reason:
          "Maximum recovery attempts have already been reached.",

        customerMessage:
          "No further automated recovery attempt will be made.",
      };
    }

    return {
      diagnosis:
        "The payment appears potentially recoverable and represents a high-value opportunity.",

      recommendedAction:
        "SEND_RECOVERY_LINK",

      confidence: 0.85,

      reason:
        "High-risk recoverable payments should receive a bounded recovery intervention.",

      customerMessage:
        "Your payment could not be completed. Please use the recovery link to try again.",
    };
  }

  // MEDIUM risk
  if (riskLevel === "MEDIUM") {
    return {
      diagnosis:
        "The payment appears potentially recoverable with moderate risk.",

      recommendedAction:
        "WAIT_AND_RETRY",

      confidence: 0.7,

      reason:
        "A delayed retry is appropriate for a medium-risk recovery opportunity.",

      customerMessage:
        "Your payment could not be completed. Please try again shortly.",
    };
  }

  // Unknown risk
  return {
    diagnosis:
      "The recovery case could not be confidently classified.",

    recommendedAction: "ESCALATE",

    confidence: 0.7,

    reason:
      "Unknown risk should be reviewed rather than automatically recovered.",

    customerMessage:
      "Your payment requires additional review.",
  };
}

/* =========================================================
   GEMINI AI ANALYSIS
========================================================= */

async function analyzeRecoveryCase(recoveryCase) {
  const prompt = `
You are RecoverAI, a payment revenue recovery assistant.

Your job is to analyze a failed or abandoned payment
and recommend ONE bounded recovery action.

You are NOT authorized to move money.
You only recommend an action.

Allowed actions:
- SEND_RECOVERY_LINK
- RETRY_PAYMENT
- WAIT_AND_RETRY
- ESCALATE
- NO_ACTION

Payment information:
${JSON.stringify(recoveryCase, null, 2)}

Return ONLY valid JSON with exactly these fields:

{
  "diagnosis": "short explanation",
  "recommendedAction": "one allowed action",
  "confidence": 0.0,
  "reason": "short explanation",
  "customerMessage": "short customer-safe message"
}

Rules:
- Never invent payment information.
- Never recommend an action outside the allowed list.
- Never request sensitive customer information.
- Never claim that money was recovered.
- Confidence must be between 0 and 1.

Recovery strategy rules:
- LOW risk cases MUST recommend NO_ACTION.
- MEDIUM risk cases should normally recommend WAIT_AND_RETRY or SEND_RECOVERY_LINK based on the failure reason.
- HIGH risk cases should normally recommend SEND_RECOVERY_LINK when recovery is appropriate.
- If the customer explicitly cancelled a LOW risk payment, recommend NO_ACTION.
- Do not recommend an automated recovery action for LOW risk cases.
`;

  try {
    /* =====================================================
       CALL GEMINI
    ===================================================== */

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

    let text =
      response.text.trim();

    /* =====================================================
       REMOVE MARKDOWN CODE BLOCK IF GEMINI RETURNS ONE
    ===================================================== */

    if (text.startsWith("```")) {
      text = text
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();
    }

    /* =====================================================
       PARSE GEMINI RESPONSE
    ===================================================== */

    const result =
      JSON.parse(text);

    /* =====================================================
       VALIDATE ACTION
    ===================================================== */

    if (
      !ALLOWED_ACTIONS.includes(
        result.recommendedAction
      )
    ) {
      throw new Error(
        `AI returned unsupported action: ${result.recommendedAction}`
      );
    }

    /* =====================================================
       VALIDATE CONFIDENCE
    ===================================================== */

    if (
      typeof result.confidence !==
        "number" ||
      result.confidence < 0 ||
      result.confidence > 1
    ) {
      throw new Error(
        "AI returned invalid confidence score"
      );
    }

    console.log(
      "Gemini AI decision generated."
    );

    return result;

  } catch (error) {

    /* =====================================================
       GEMINI FAILED
    ===================================================== */

    console.error(
      "========== GEMINI ERROR =========="
    );

    console.error(error);

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "Status:",
      error?.status
    );

    console.error(
      "=================================="
    );

    /* =====================================================
       FALLBACK AI
    ===================================================== */

    console.log(
      "Gemini unavailable. Using RecoverAI fallback decision."
    );

    const fallback =
      getFallbackRecommendation(
        recoveryCase
      );

    console.log(
      `Fallback AI decision: ${fallback.recommendedAction} confidence: ${fallback.confidence}`
    );

    return fallback;
  }
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  analyzeRecoveryCase,
};