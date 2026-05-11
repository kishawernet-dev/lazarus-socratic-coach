import {
  jsonResponse,
  parseBody,
  cleanText,
  cleanLongText,
  getSessionsStore,
  getSubmissionsStore,
  makeSubmissionKey,
  getPromptById,
  compactHistory,
  trimHistory,
  APPROVED_EVIDENCE,
  evaluatorInstructions,
  evaluationResponseFormat,
  callOpenAI,
  sanitizeEvaluation,
  runSaplingSafely
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

    const body = parseBody(event);
    const sessionKey = cleanText(body.sessionKey, 200);
    const finalResponse = cleanLongText(body.finalResponse, 10000);
    const history = trimHistory(body.history || []);

    if (!sessionKey) return jsonResponse(400, { error: "Session missing." });
    if (finalResponse.length < 40) return jsonResponse(400, { error: "Your final response needs more detail before submission." });

    const sessionStore = getSessionsStore();
    const submissionStore = getSubmissionsStore();
    const session = await sessionStore.get(sessionKey, { type: "json" });

    if (!session || session.status !== "ACTIVE") return jsonResponse(404, { error: "Active session not found." });

    const prompt = getPromptById(session.promptId);

    const input = `
Evaluate this student's final response as formative feedback. Return JSON only.

Student: ${session.studentName}
Period: ${session.period}

Assigned prompt:
${prompt.question}

Approved station evidence:
${APPROVED_EVIDENCE}

Conversation before final response:
${compactHistory(history)}

Final student response:
${finalResponse}
`;

    const evaluationText = await callOpenAI(evaluatorInstructions(), input, 1500, evaluationResponseFormat());
    const evaluation = sanitizeEvaluation(JSON.parse(evaluationText));
    const total =
      Number(evaluation.claimScore) +
      Number(evaluation.evidenceScore) +
      Number(evaluation.reasoningScore) +
      Number(evaluation.biologyAccuracyScore);

    const aiDetection = await runSaplingSafely(finalResponse);

    const submittedAt = new Date().toISOString();
    const submission = {
      submittedAt,
      firstName: session.firstName,
      lastName: session.lastName,
      studentName: session.studentName,
      period: session.period,
      sessionId: session.sessionId,
      promptId: prompt.id,
      promptTitle: prompt.title,
      promptQuestion: prompt.question,
      finalResponse,
      evaluation,
      total,
      aiDetection,
      chatHistory: history
    };

    await submissionStore.setJSON(makeSubmissionKey(session.sessionId), submission);

    session.finalDraft = finalResponse;
    session.history = history;
    session.status = "SUBMITTED";
    session.submittedAt = submittedAt;
    session.updatedAt = submittedAt;
    await sessionStore.setJSON(sessionKey, session);

    return jsonResponse(200, {
      message: "Submitted. Your response has been sent to your teacher.",
      strength: evaluation.strength,
      nextStep: `Before you move on, check this: ${evaluation.misconceptionOrMissingPiece}`
    });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
