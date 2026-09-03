const db = require("../config/database");

async function getAuditLogs(limit = 100) {
  const safeLimit = Math.min(Number(limit) || 100, 200);

  const [rows] = await db.query(`
    SELECT
      id,
      recovery_case_id,
      event_type,
      actor,
      details,
      created_at AS timestamp
    FROM audit_logs
    ORDER BY id DESC
    LIMIT ${safeLimit}
  `);

  return rows.map((row) => {
    let parsedDetails = row.details;

    try {
      if (typeof row.details === "string") {
        parsedDetails = JSON.parse(row.details);
      }
    } catch {
      // Keep original value if it is not valid JSON
    }

    return {
      id: row.id,
      recoveryCaseId: row.recovery_case_id,
      eventType: row.event_type,
      actor: row.actor,
      details: parsedDetails,
      timestamp: row.timestamp,
    };
  });
}

async function getCaseAuditLogs(recoveryCaseId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      recovery_case_id,
      event_type,
      actor,
      details,
      created_at AS timestamp
    FROM audit_logs
    WHERE recovery_case_id = ?
    ORDER BY id DESC
    `,
    [recoveryCaseId]
  );

  return rows.map((row) => {
    let parsedDetails = row.details;

    try {
      if (typeof row.details === "string") {
        parsedDetails = JSON.parse(row.details);
      }
    } catch {
      // Keep original value
    }

    return {
      id: row.id,
      recoveryCaseId: row.recovery_case_id,
      eventType: row.event_type,
      actor: row.actor,
      details: parsedDetails,
      timestamp: row.timestamp,
    };
  });
}

module.exports = {
  getAuditLogs,
  getCaseAuditLogs,
};