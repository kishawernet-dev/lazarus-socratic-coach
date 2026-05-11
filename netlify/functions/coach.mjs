import {
  jsonResponse,
  parseBody,
  cleanText,
  cleanLongText,
  getSessionsStore,
  getPromptById,
  compactHistory,
  trimHistory,
  APPROVED_EVIDENCE,
  tutorInstructions,
  callOpenAI
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

    const body = parseBody(event);
    const sessionKey = cleanText(body.sessionKey, 200);
    const message = cleanLongText(body.message, 2000);
    const history = trimHistory(body.history || []);

    if (!sessionKey) return jsonResponse(400, { error: "Session missing. Refresh and start again." });
    if (!message) return jsonResponse(400, { error: "Type a response before sending." });

    const store = getSessionsStore();
    const session = await store.get(sessionKey, { type: "json" });
    if (!session || session.status !== "ACTIVE") return jsonResponse(404, { error: "Active session not found." });

    const prompt = getPromptById(session.promptId);
    const input = `
Student: ${session.studentName}
Period: ${session.period}

Assigned prompt:
${prompt.question}

Approved station evidence:
${APPROVED_EVIDENCE}

Conversation so far:
${compactHistory(history)}

Most recent student message:
${message}
`;

    const reply = await callOpenAI(tutorInstructions(), input, 900, null);
    const updatedHistory = trimHistory([...history, { role: "coach", text: reply }]);

    session.history = updatedHistory;
    session.updatedAt = new Date().toISOString();
    await store.setJSON(sessionKey, session);

    return jsonResponse(200, { reply, history: updatedHistory });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
