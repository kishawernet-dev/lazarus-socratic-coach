import {
  jsonResponse,
  parseBody,
  cleanText,
  cleanLongText,
  ensureSheetSetup,
  findActiveSessionByKey,
  updateActiveSession,
  trimHistory
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

    await ensureSheetSetup();

    const body = parseBody(event);
    const sessionKey = cleanText(body.sessionKey, 200);
    if (!sessionKey) return jsonResponse(400, { error: "Session missing." });

    const found = await findActiveSessionByKey(sessionKey);
    if (!found) return jsonResponse(404, { error: "Active session not found." });

    await updateActiveSession(sessionKey, {
      finalDraft: cleanLongText(body.finalDraft || "", 10000),
      history: trimHistory(body.history || found.session.history || [])
    });

    return jsonResponse(200, { saved: true });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
