import { JWT } from "google-auth-library";

export const CONFIG = {
  OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
  SAPLING_API_URL: "https://api.sapling.ai/api/v1/aidetect",
  GOOGLE_SHEETS_API_URL: "https://sheets.googleapis.com/v4/spreadsheets",
  DEFAULT_MODEL: "gpt-4.1-mini",
  ACTIVE_SHEET: "Active Sessions",
  RESPONSES_SHEET: "Student Responses",
  COUNTS_SHEET: "Prompt Counts"
};

export const ACTIVE_HEADERS = [
  "Created Timestamp", "Updated Timestamp", "First Name", "Last Name", "Full Name", "Period",
  "Session Key", "Session ID", "Prompt ID", "Prompt Title", "Prompt Question", "History JSON",
  "Final Draft", "Status", "Submitted Timestamp"
];

export const RESPONSE_HEADERS = [
  "Timestamp", "First Name", "Last Name", "Full Name", "Period", "Session ID", "Prompt ID",
  "Prompt Title", "Prompt Question", "Final Response", "Claim Score", "Evidence Score",
  "Reasoning Score", "Biology Accuracy Score", "Total Score", "Strength",
  "Misconception or Missing Piece", "Suggested Teacher Follow-Up", "Sapling AI Score",
  "AI Risk Level", "AI Detector Notes", "Chat History JSON", "Teacher Final Score", "Teacher Notes"
];

export const COUNT_HEADERS = ["Prompt ID", "Prompt Title", "Times Assigned"];

export const PROMPTS = [
  { id: 1, title: "Viral Fuel Source", question: "Explain how the Lazarus Virus changes macromolecule use and why this weakens the body." },
  { id: 2, title: "Enzyme Manipulation", question: "Explain how altered enzyme activity helps the virus replicate." },
  { id: 3, title: "Immune System Failure", question: "Explain why immune system failure allows the infection to spread." },
  { id: 4, title: "Nervous System Damage", question: "Connect nervous system damage to infected behavior." },
  { id: 5, title: "Subject 47 vs. Subject 48", question: "Use Subject 47 and Subject 48 data to explain why one resisted infection and one did not." },
  { id: 6, title: "Mutation and Vulnerability", question: "Explain how mutation type could affect immune resistance or vulnerability." },
  { id: 7, title: "Cell Cycle and Viral Spread", question: "Explain why the cell cycle affects viral spread in different tissues." },
  { id: 8, title: "Membrane Damage and Homeostasis", question: "Explain how membrane damage causes transport failure and loss of homeostasis." },
  { id: 9, title: "Mitochondria and Ribosomes", question: "Explain how mitochondrial and ribosomal failure produce zombie-like symptoms." },
  { id: 10, title: "Cell Type Targeting", question: "Explain why the virus infects animal eukaryotic cells but not bacteria or plant cells." }
];

export const APPROVED_EVIDENCE = `
Station 1 evidence:
- Infected cells show carbohydrate depletion.
- Lipids and proteins are broken down and repurposed.
- Digestive enzymes increase activity while metabolic control decreases.
- Infected cells become acidic.
- The immune system fails to recognize infected cells.
- The nervous system degenerates, causing erratic movement.
- The digestive system no longer breaks down carbohydrates properly.

Station 2 evidence:
- Subject 47 maintains white blood cell levels and resists infection.
- Subject 48's white blood cell count drops sharply.
- Subject 47 shows little or no viral replication.
- Subject 48's viral load rises quickly.
- Subject 47 has a mutation linked to immune response.
- Subject 48 has a mutation that reduces immune efficiency.
- Rapidly dividing cells show greater infection.
- Nerve cells show limited infection because they rarely divide.

Station 3 evidence:
- Infected eukaryotic cells swell and some burst.
- Bacteria remain uninfected.
- Plant cells appear resistant.
- The cell membrane is damaged, disrupting transport and homeostasis.
- ATP production drops in infected cells.
- Protein production drops in infected cells.
- Active transport fails when ATP is unavailable.
- Endocytosis and exocytosis can be hijacked to move viral material.
- Plant cell walls may help resist infection.
`;

export function jsonResponse(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, body: JSON.stringify(body) };
}

export function parseBody(event) {
  if (!event.body) return {};
  try { return JSON.parse(event.body); } catch { throw new Error("Invalid JSON body."); }
}

export function cleanText(value, maxLength = 5000) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function cleanLongText(value, maxLength = 12000) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[<>]/g, "").trim().slice(0, maxLength);
}

export function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

export function makeStudentKey(firstName, lastName, period) {
  return `p${normalizeKey(period)}_${normalizeKey(lastName)}_${normalizeKey(firstName)}`;
}

export function uuid() { return crypto.randomUUID(); }

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  return id;
}

function getPrivateKey() {
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  if (!raw) throw new Error("Missing GOOGLE_PRIVATE_KEY environment variable.");
  return raw.replace(/\\n/g, "\n");
}

async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable.");
  const client = new JWT({ email, key: getPrivateKey(), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Could not get Google access token.");
  return token;
}

function quoteSheetName(name) { return `'${String(name).replace(/'/g, "''")}'`; }

async function sheetsFetch(path, options = {}) {
  const token = await getGoogleAccessToken();
  const response = await fetch(`${CONFIG.GOOGLE_SHEETS_API_URL}/${getSheetId()}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(options.headers || {}) }
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Google Sheets API error ${response.status}: ${raw}`);
  return raw ? JSON.parse(raw) : {};
}

export async function ensureSheetSetup() {
  const meta = await sheetsFetch("?fields=sheets.properties.title");
  const existingTitles = new Set((meta.sheets || []).map((sheet) => sheet.properties.title));
  const needed = [CONFIG.ACTIVE_SHEET, CONFIG.RESPONSES_SHEET, CONFIG.COUNTS_SHEET];
  const requests = needed.filter((title) => !existingTitles.has(title)).map((title) => ({ addSheet: { properties: { title } } }));
  if (requests.length > 0) await sheetsFetch(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  await ensureHeaders(CONFIG.ACTIVE_SHEET, ACTIVE_HEADERS);
  await ensureHeaders(CONFIG.RESPONSES_SHEET, RESPONSE_HEADERS);
  await ensureHeaders(CONFIG.COUNTS_SHEET, COUNT_HEADERS);
  await ensurePromptCounts();
}

async function ensureHeaders(sheetName, headers) {
  const values = await getValues(`${quoteSheetName(sheetName)}!1:1`);
  const firstRow = values[0] || [];
  if (firstRow.length === 0 || firstRow[0] !== headers[0]) {
    await updateValues(`${quoteSheetName(sheetName)}!A1:${columnLetter(headers.length)}1`, [headers]);
  }
}

async function ensurePromptCounts() {
  const values = await getValues(`${quoteSheetName(CONFIG.COUNTS_SHEET)}!A2:C`);
  const existingIds = new Set(values.map((row) => Number(row[0])).filter(Boolean));
  const missingRows = PROMPTS.filter((prompt) => !existingIds.has(prompt.id)).map((prompt) => [prompt.id, prompt.title, 0]);
  if (missingRows.length > 0) await appendValues(CONFIG.COUNTS_SHEET, "A:C", missingRows);
}

export async function getValues(a1Range) {
  const encodedRange = encodeURIComponent(a1Range);
  const data = await sheetsFetch(`/values/${encodedRange}`);
  return data.values || [];
}

export async function updateValues(a1Range, values) {
  const encodedRange = encodeURIComponent(a1Range);
  return sheetsFetch(`/values/${encodedRange}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ range: a1Range, majorDimension: "ROWS", values }) });
}

export async function appendValues(sheetName, rangeColumns, values) {
  const a1Range = `${quoteSheetName(sheetName)}!${rangeColumns}`;
  const encodedRange = encodeURIComponent(a1Range);
  return sheetsFetch(`/values/${encodedRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ range: a1Range, majorDimension: "ROWS", values }) });
}

function columnLetter(columnNumber) {
  let temp = columnNumber;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function normalizeRow(row, length) {
  const out = Array.from(row || []);
  while (out.length < length) out.push("");
  return out.slice(0, length);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

export async function findActiveSessionByStudent(firstName, lastName, period) {
  return findActiveSessionByKey(makeStudentKey(firstName, lastName, period));
}

export async function findActiveSessionByKey(sessionKey) {
  const rows = await getValues(`${quoteSheetName(CONFIG.ACTIVE_SHEET)}!A2:O`);
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = normalizeRow(rows[i], ACTIVE_HEADERS.length);
    if (String(row[6]) === String(sessionKey) && String(row[13]).toUpperCase() === "ACTIVE") {
      return { rowNumber: i + 2, row, session: activeRowToSession(row) };
    }
  }
  return null;
}

function activeRowToSession(row) {
  return {
    sessionKey: row[6], sessionId: row[7], firstName: row[2], lastName: row[3], studentName: row[4], period: row[5],
    promptId: Number(row[8]), promptTitle: row[9], promptQuestion: row[10], history: trimHistory(parseJson(row[11], [])),
    finalDraft: row[12] || "", status: row[13] || "ACTIVE", createdAt: row[0], updatedAt: row[1], submittedAt: row[14] || ""
  };
}

export async function createActiveSession(session) {
  const now = new Date().toISOString();
  const row = [now, now, session.firstName, session.lastName, session.studentName, session.period, session.sessionKey, session.sessionId, session.promptId, session.promptTitle, session.promptQuestion, JSON.stringify(trimHistory(session.history)), session.finalDraft || "", "ACTIVE", ""];
  await appendValues(CONFIG.ACTIVE_SHEET, "A:O", [row]);
}

export async function updateActiveSession(sessionKey, updates) {
  const found = await findActiveSessionByKey(sessionKey);
  if (!found) throw new Error("Active session not found.");
  const row = found.row;
  row[1] = new Date().toISOString();
  if (updates.history !== undefined) row[11] = JSON.stringify(trimHistory(updates.history));
  if (updates.finalDraft !== undefined) row[12] = cleanLongText(updates.finalDraft, 10000);
  if (updates.status !== undefined) row[13] = updates.status;
  if (updates.submittedAt !== undefined) row[14] = updates.submittedAt;
  await updateValues(`${quoteSheetName(CONFIG.ACTIVE_SHEET)}!A${found.rowNumber}:O${found.rowNumber}`, [row]);
  return activeRowToSession(row);
}

export async function pickBalancedPrompt() {
  const rows = await getValues(`${quoteSheetName(CONFIG.COUNTS_SHEET)}!A2:C`);
  const normalized = rows.map((row, index) => ({ rowNumber: index + 2, id: Number(row[0]), title: row[1], count: Number(row[2] || 0) })).filter((row) => row.id);
  const min = Math.min(...normalized.map((row) => row.count));
  const candidates = normalized.filter((row) => row.count === min);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  await updateValues(`${quoteSheetName(CONFIG.COUNTS_SHEET)}!C${selected.rowNumber}:C${selected.rowNumber}`, [[selected.count + 1]]);
  return getPromptById(selected.id);
}

export async function appendSubmissionRecord(record) {
  const e = record.evaluation || {};
  const ai = record.aiDetection || {};
  const row = [
    record.submittedAt, record.firstName, record.lastName, record.studentName, record.period, record.sessionId, record.promptId,
    record.promptTitle, record.promptQuestion, record.finalResponse, e.claimScore, e.evidenceScore, e.reasoningScore,
    e.biologyAccuracyScore, record.total, e.strength, e.misconceptionOrMissingPiece, e.suggestedTeacherFollowUp,
    ai.score, ai.riskLevel, ai.notes, JSON.stringify(record.chatHistory || []), "", ""
  ];
  await appendValues(CONFIG.RESPONSES_SHEET, "A:X", [row]);
}

export async function getSubmissionRecords() {
  await ensureSheetSetup();
  const rows = await getValues(`${quoteSheetName(CONFIG.RESPONSES_SHEET)}!A2:X`);
  return rows.map((raw) => {
    const row = normalizeRow(raw, RESPONSE_HEADERS.length);
    return {
      submittedAt: row[0], firstName: row[1], lastName: row[2], studentName: row[3], period: row[4], sessionId: row[5],
      promptId: row[6], promptTitle: row[7], promptQuestion: row[8], finalResponse: row[9],
      evaluation: { claimScore: row[10], evidenceScore: row[11], reasoningScore: row[12], biologyAccuracyScore: row[13], strength: row[15], misconceptionOrMissingPiece: row[16], suggestedTeacherFollowUp: row[17] },
      total: row[14], aiDetection: { score: row[18], riskLevel: row[19], notes: row[20] }, chatHistory: parseJson(row[21], [])
    };
  }).reverse();
}

export function getPromptById(id) {
  const prompt = PROMPTS.find((p) => Number(p.id) === Number(id));
  if (!prompt) throw new Error("Invalid prompt ID.");
  return prompt;
}

export function compactHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "No previous conversation.";
  return history.slice(-12).map((item) => `${cleanText(item.role || "unknown", 20)}: ${cleanLongText(item.text || "", 1200)}`).join("\n");
}

export function trimHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-30).map((item) => ({ role: cleanText(item.role || "unknown", 20), text: cleanLongText(item.text || "", 1200) }));
}

export function tutorInstructions() {
  return `
You are the Project Lazarus Socratic Response Coach for a high school biology class.

Your job is to help students improve their scientific response without giving them the answer.

Rules:
- Do not write the student's answer.
- Do not provide a complete model response.
- Do not list all evidence that would answer the prompt.
- Ask one guiding question at a time.
- Push the student to use claim, evidence, and reasoning.
- Require evidence from the approved station evidence.
- If the student asks for the answer, refuse briefly and ask a guiding question instead.
- If the student gives a weak answer, name what is missing and ask for one specific improvement.
- If the student gives an inaccurate answer, correct only the misconception, then ask a question.
- Keep responses short, urgent, mission-based, and classroom appropriate.
- Do not invent new Lazarus data beyond the approved evidence.

Preferred response structure:
1. One sentence of feedback.
2. One Socratic guiding question.
3. Optional reminder: Claim + Evidence + Reasoning.
`;
}

export function evaluatorInstructions() {
  return `
You are evaluating a high school biology student's final response.

Use this 8-point rubric:

Claim, 0 to 2:
0 = no clear claim
1 = partially clear claim
2 = accurate, focused claim

Evidence, 0 to 2:
0 = no station evidence
1 = vague or incomplete evidence
2 = specific evidence from station data

Reasoning, 0 to 2:
0 = evidence is listed but not explained
1 = partial explanation
2 = explains how the evidence supports the claim

Biology Accuracy, 0 to 2:
0 = major misconception
1 = minor error or incomplete science
2 = accurate biology

Be honest. Do not inflate scores. This is formative feedback, not a final grade.

Return JSON only. No markdown. No extra text.
`;
}

export function evaluationResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "student_evaluation",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimScore: { type: "integer" }, evidenceScore: { type: "integer" }, reasoningScore: { type: "integer" }, biologyAccuracyScore: { type: "integer" },
          strength: { type: "string" }, misconceptionOrMissingPiece: { type: "string" }, suggestedTeacherFollowUp: { type: "string" }
        },
        required: ["claimScore", "evidenceScore", "reasoningScore", "biologyAccuracyScore", "strength", "misconceptionOrMissingPiece", "suggestedTeacherFollowUp"]
      }
    }
  };
}

export async function callOpenAI(instructions, input, maxTokens = 900, responseFormat = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || CONFIG.DEFAULT_MODEL;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY environment variable.");
  const payload = { model, messages: [{ role: "system", content: instructions }, { role: "user", content: input }], temperature: responseFormat ? 0 : 0.3, max_completion_tokens: Math.max(maxTokens, 900) };
  if (responseFormat) payload.response_format = responseFormat;
  const response = await fetch(CONFIG.OPENAI_API_URL, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${raw}`);
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No text returned from OpenAI. Raw: ${raw.slice(0, 1000)}`);
  return String(content).trim();
}

export function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(2, Math.round(number)));
}

export function sanitizeEvaluation(evaluation) {
  return {
    claimScore: clampScore(evaluation.claimScore), evidenceScore: clampScore(evaluation.evidenceScore), reasoningScore: clampScore(evaluation.reasoningScore), biologyAccuracyScore: clampScore(evaluation.biologyAccuracyScore),
    strength: cleanLongText(evaluation.strength || "No specific strength identified.", 1000),
    misconceptionOrMissingPiece: cleanLongText(evaluation.misconceptionOrMissingPiece || "Needs more specific evidence or reasoning.", 1000),
    suggestedTeacherFollowUp: cleanLongText(evaluation.suggestedTeacherFollowUp || "Review claim, evidence, and reasoning.", 1000)
  };
}

export async function runSaplingSafely(text) {
  try {
    const key = process.env.SAPLING_API_KEY;
    if (!key) return { score: "", riskLevel: "Not checked", notes: "SAPLING_API_KEY was not configured." };
    const response = await fetch(CONFIG.SAPLING_API_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, text: String(text || ""), sent_scores: false, score_string: false }) });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Sapling API error ${response.status}: ${raw}`);
    const data = JSON.parse(raw);
    const score = typeof data.score === "number" ? data.score : "";
    let riskLevel = "Unavailable";
    if (typeof score === "number") {
      if (score >= 0.85) riskLevel = "High";
      else if (score >= 0.65) riskLevel = "Medium";
      else if (score >= 0.4) riskLevel = "Low-Medium";
      else riskLevel = "Low";
    }
    return { score, riskLevel, notes: "Detector score is probabilistic, not proof. Use only as a review flag." };
  } catch (error) {
    return { score: "", riskLevel: "Not checked", notes: `Sapling check failed: ${String(error.message || error).slice(0, 500)}` };
  }
}
