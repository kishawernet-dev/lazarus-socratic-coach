import {
  jsonResponse,
  cleanText,
  ensureSheetSetup,
  getSubmissionRecords
} from "./shared.mjs";

export const handler = async (event) => {
  try {
    const password =
      cleanText(event.headers["x-admin-password"] || event.queryStringParameters?.password || "", 100);

    if (!process.env.TEACHER_PASSWORD) {
      return jsonResponse(500, { error: "Missing TEACHER_PASSWORD environment variable." });
    }

    if (password !== process.env.TEACHER_PASSWORD) {
      return jsonResponse(401, { error: "Unauthorized." });
    }

    await ensureSheetSetup();
    const submissions = await getSubmissionRecords();

    return jsonResponse(200, { submissions });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
