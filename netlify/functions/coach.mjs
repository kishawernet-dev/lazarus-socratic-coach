import {
  jsonResponse,
  parseBody,
  cleanText,
  cleanLongText,
  ensureSheetSetup,
  findActiveSessionByKey,
  updateActiveSession,
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

    await ensureSheetSetup();

    const body = parseBody(event);
    const sessionKey = cleanText(body.sessionKey, 200);
    const message = cleanLongText(body.message, 2000);
    const history = trimHistory(body.history || []);

    if (!sessionKey) return jsonResponse(400, { error: "Session missing. Refresh and start again." });
    if (!message) return jsonResponse(400, { error: "Type a response before sending." });

    const found = await findActiveSessionByKey(sessionKey);
    if (!found) return jsonResponse(404, { error: "Active session not found." });

    const session = found.session;
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

    await updateActiveSession(sessionKey, {
      history: updatedHistory
    });

    return jsonResponse(200, { reply, history: updatedHistory });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
