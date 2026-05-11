import { getStore } from "@netlify/blobs";

export const CONFIG = {
  OPENAI_API_URL: "https://api.openai.com/v1/chat/completions",
  SAPLING_API_URL: "https://api.sapling.ai/api/v1/aidetect",
  DEFAULT_MODEL: "gpt-4.1-mini"
};

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
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

export function cleanText(value, maxLength = 5000) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function cleanLongText(value, maxLength = 12000) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function makeStudentKey(firstName, lastName, period) {
  return `active/${normalizeKey(period)}/${normalizeKey(lastName)}_${normalizeKey(firstName)}.json`;
}

export function makeSubmissionKey(sessionId) {
  return `submitted/${sessionId}.json`;
}

export function uuid() {
  return crypto.randomUUID();
}

export function getSessionsStore() {
  return getStore("lazarus-s1-3-sessions");
}

export function getSubmissionsStore() {
  return getStore("lazarus-s1-3-submissions");
}

export function getCountsStore() {
  return getStore("lazarus-s1-3-counts");
}

export function getPromptById(id) {
  const prompt = PROMPTS.find((p) => Number(p.id) === Number(id));
  if (!prompt) throw new Error("Invalid prompt ID.");
  return prompt;
}

export async function pickBalancedPrompt() {
  const store = getCountsStore();
  const current = (await store.get("prompt-counts.json", { type: "json" })) || {};
  const rows = PROMPTS.map((prompt) => ({
    id: prompt.id,
    count: Number(current[prompt.id] || 0)
  }));
  const min = Math.min(...rows.map((row) => row.count));
  const candidates = rows.filter((row) => row.count === min);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  current[selected.id] = Number(current[selected.id] || 0) + 1;
  await store.setJSON("prompt-counts.json", current);
  return getPromptById(selected.id);
}

export function compactHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return "No previous conversation.";
  return history
    .slice(-12)
    .map((item) => `${cleanText(item.role || "unknown", 20)}: ${cleanLongText(item.text || "", 1200)}`)
    .join("\n");
}

export function trimHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-30).map((item) => ({
    role: cleanText(item.role || "unknown", 20),
    text: cleanLongText(item.text || "", 1200)
  }));
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
          claimScore: { type: "integer" },
          evidenceScore: { type: "integer" },
          reasoningScore: { type: "integer" },
          biologyAccuracyScore: { type: "integer" },
          strength: { type: "string" },
          misconceptionOrMissingPiece: { type: "string" },
          suggestedTeacherFollowUp: { type: "string" }
        },
        required: [
          "claimScore",
          "evidenceScore",
          "reasoningScore",
          "biologyAccuracyScore",
          "strength",
          "misconceptionOrMissingPiece",
          "suggestedTeacherFollowUp"
        ]
      }
    }
  };
}

export async function callOpenAI(instructions, input, maxTokens = 900, responseFormat = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || CONFIG.DEFAULT_MODEL;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY environment variable.");

  const payload = {
    model,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input }
    ],
    temperature: responseFormat ? 0 : 0.3,
    max_completion_tokens: Math.max(maxTokens, 900)
  };

  if (responseFormat) payload.response_format = responseFormat;

  const response = await fetch(CONFIG.OPENAI_API_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

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
    claimScore: clampScore(evaluation.claimScore),
    evidenceScore: clampScore(evaluation.evidenceScore),
    reasoningScore: clampScore(evaluation.reasoningScore),
    biologyAccuracyScore: clampScore(evaluation.biologyAccuracyScore),
    strength: cleanLongText(evaluation.strength || "No specific strength identified.", 1000),
    misconceptionOrMissingPiece: cleanLongText(evaluation.misconceptionOrMissingPiece || "Needs more specific evidence or reasoning.", 1000),
    suggestedTeacherFollowUp: cleanLongText(evaluation.suggestedTeacherFollowUp || "Review claim, evidence, and reasoning.", 1000)
  };
}

export async function runSaplingSafely(text) {
  try {
    const key = process.env.SAPLING_API_KEY;
    if (!key) {
      return {
        score: "",
        riskLevel: "Not checked",
        notes: "SAPLING_API_KEY was not configured."
      };
    }

    const response = await fetch(CONFIG.SAPLING_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key,
        text: String(text || ""),
        sent_scores: false,
        score_string: false
      })
    });

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

    return {
      score,
      riskLevel,
      notes: "Detector score is probabilistic, not proof. Use only as a review flag."
    };
  } catch (error) {
    return {
      score: "",
      riskLevel: "Not checked",
      notes: `Sapling check failed: ${String(error.message || error).slice(0, 500)}`
    };
  }
}
