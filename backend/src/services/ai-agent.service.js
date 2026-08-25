const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

let text = response.text.trim();

// Remove Markdown code fences if Gemini adds them
if (text.startsWith("```")) {
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

let result;

try {
  result = JSON.parse(text);
} catch (error) {
  console.error("Invalid JSON returned by AI:");
  console.error(text);

  throw new Error("AI returned invalid JSON");
}

// Validate the AI output before returning it
const allowedActions = [
  "SEND_RECOVERY_LINK",
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "ESCALATE",
  "NO_ACTION",
];

if (!allowedActions.includes(result.recommendedAction)) {
  throw new Error(
    `AI returned unsupported action: ${result.recommendedAction}`
  );
}

if (
  typeof result.confidence !== "number" ||
  result.confidence < 0 ||
  result.confidence > 1
) {
  throw new Error("AI returned invalid confidence score");
}

return result;
}

module.exports = {
  analyzeRecoveryCase,
};