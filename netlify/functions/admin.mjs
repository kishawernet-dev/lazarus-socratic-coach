import { jsonResponse, getSubmissionsStore, cleanText } from "./shared.mjs";

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

    const store = getSubmissionsStore();
    const listed = await store.list({ prefix: "submitted/" });
    const rows = [];

    for (const blob of listed.blobs || []) {
      const record = await store.get(blob.key, { type: "json" });
      if (record) rows.push(record);
    }

    rows.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

    return jsonResponse(200, { submissions: rows });
  } catch (error) {
    return jsonResponse(500, { error: String(error.message || error) });
  }
};
