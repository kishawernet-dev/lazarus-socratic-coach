import {
  jsonResponse,
  parseBody,
  cleanText,
  makeStudentKey,
  uuid,
  getSessionsStore,
  pickBalancedPrompt,
  trimHistory
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

    const body = parseBody(event);
    const firstName = cleanText(body.firstName, 40);
    const lastName = cleanText(body.lastName, 40);
    const period = cleanText(body.period, 20);

    if (!firstName) return jsonResponse(400, { error: "Please enter your first name." });
    if (!lastName) return jsonResponse(400, { error: "Please enter your last name." });
    if (!period) return jsonResponse(400, { error: "Please choose your class period." });

    const studentName = `${firstName} ${lastName}`;
    const sessionKey = makeStudentKey(firstName, lastName, period);
    const store = getSessionsStore();
    const existing = await store.get(sessionKey, { type: "json" });

    if (existing && existing.status === "ACTIVE") {
      return jsonResponse(200, {
        ...existing,
        resumed: true,
        greeting: "Welcome back. Your previous mission has been restored."
      });
    }

    const prompt = await pickBalancedPrompt();
    const greeting = `Mission assigned: ${prompt.title}. I will not give you the answer. First, write a one-sentence claim that answers the prompt.`;
    const now = new Date().toISOString();

    const session = {
      sessionKey,
      sessionId: uuid(),
      firstName,
      lastName,
      studentName,
      period,
      promptId: prompt.id,
      promptTitle: prompt.title,
      promptQuestion: prompt.question,
      history: trimHistory([{ role: "coach", text: greeting }]),
      finalDraft: "",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      resumed: false,
      greeting
    };

    await store.setJSON(sessionKey, session);
    return jsonResponse(200, session);
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
