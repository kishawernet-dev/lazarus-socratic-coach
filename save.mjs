import {
  jsonResponse,
  parseBody,
  cleanText,
  cleanLongText,
  trimHistory,
  getSessionsStore
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

    const body = parseBody(event);
    const sessionKey = cleanText(body.sessionKey, 200);
    if (!sessionKey) return jsonResponse(400, { error: "Session missing." });

    const store = getSessionsStore();
    const session = await store.get(sessionKey, { type: "json" });
    if (!session || session.status !== "ACTIVE") return jsonResponse(404, { error: "Active session not found." });

    session.finalDraft = cleanLongText(body.finalDraft || "", 10000);
    session.history = trimHistory(body.history || session.history || []);
    session.updatedAt = new Date().toISOString();

    await store.setJSON(sessionKey, session);
    return jsonResponse(200, { saved: true });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
