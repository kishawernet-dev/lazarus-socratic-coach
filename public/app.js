let session = null;
let history = [];
let draftSaveTimer = null;
const STORAGE_KEY = "lazarus_netlify_socratic_s1_3_v1";

const $ = (id) => document.getElementById(id);
const valueOf = (id) => ($(id) ? $(id).value.trim() : "");
const setValue = (id, value) => { if ($(id)) $(id).value = value || ""; };
const setText = (id, value) => { if ($(id)) $(id).textContent = value || ""; };
const setStatus = (id, value) => { if ($(id)) $(id).textContent = value || ""; };

async function api(path, payload) {
  const response = await fetch(`/.netlify/functions/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function startMission() {
  const firstName = valueOf("firstName");
  const lastName = valueOf("lastName");
  const period = valueOf("period");

  if (!firstName || !lastName) return setStatus("startStatus", "Enter your first and last name.");
  if (!period) return setStatus("startStatus", "Choose your class period.");
  if (!$("aiNoticeAck").checked) return setStatus("startStatus", "Read and check the academic integrity warning before starting.");

  setStatus("startStatus", "Starting mission...");
  $("startBtn").disabled = true;

  api("start", { firstName, lastName, period })
    .then((data) => {
      loadSession(data);
      setStatus("startStatus", "");
    })
    .catch((error) => setStatus("startStatus", error.message))
    .finally(() => $("startBtn").disabled = false);
}

function loadSession(data) {
  session = data;
  history = Array.isArray(data.history) ? data.history : [];

  const local = getLocalState();
  if (local && local.session && local.session.sessionId === data.sessionId) {
    if ((local.finalResponse || "").length > (data.finalDraft || "").length) data.finalDraft = local.finalResponse;
    if (local.studentMessage) setValue("studentMessage", local.studentMessage);
  }

  setText("promptTitle", `Prompt ${data.promptId}: ${data.promptTitle}`);
  setText("promptQuestion", data.promptQuestion);
  setValue("finalResponse", data.finalDraft || "");

  $("startCard").classList.add("hidden");
  $("chatCard").classList.remove("hidden");
  $("finalCard").classList.remove("hidden");

  renderChat();

  if (data.resumed) appendMessage("system", "Previous work restored. Continue from where you left off.");

  saveLocalState();
  setSaveStatus("Saved.");
}

function sendToCoach() {
  const box = $("studentMessage");
  const message = box.value.trim();
  if (!message) return;

  appendMessage("student", message);
  history.push({ role: "student", text: message });

  box.value = "";
  saveLocalState();
  scheduleServerDraftSave();

  $("sendBtn").disabled = true;
  setStatus("chatStatus", "Coach is thinking...");

  api("coach", { sessionKey: session.sessionKey, message, history })
    .then((data) => {
      setStatus("chatStatus", "");
      history = Array.isArray(data.history) ? data.history : [...history, { role: "coach", text: data.reply }];
      renderChat();
      saveLocalState();
      setSaveStatus("Saved.");
    })
    .catch((error) => setStatus("chatStatus", `Error: ${error.message}`))
    .finally(() => $("sendBtn").disabled = false);
}

function submitFinal() {
  const finalResponse = valueOf("finalResponse");
  if (finalResponse.length < 40) return setStatus("submitStatus", "Add more detail before submitting.");

  $("submitBtn").disabled = true;
  setStatus("submitStatus", "Submitting final response...");

  api("submit", { sessionKey: session.sessionKey, finalResponse, history })
    .then((data) => {
      localStorage.removeItem(STORAGE_KEY);
      setSaveStatus("Submitted.");
      setStatus("submitStatus", `${data.message}\n\nStrength: ${data.strength}\n\n${data.nextStep}`);
    })
    .catch((error) => {
      setStatus("submitStatus", error.message);
      $("submitBtn").disabled = false;
    });
}

function scheduleServerDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraftToServer, 1200);
}

function saveDraftToServer() {
  if (!session) return;
  setSaveStatus("Saving...");

  api("save", { sessionKey: session.sessionKey, finalDraft: valueOf("finalResponse"), history })
    .then(() => setSaveStatus("Saved."))
    .catch(() => setSaveStatus("Local backup saved. Server save failed."));
}

function saveLocalState() {
  if (!session) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    session,
    history,
    finalResponse: valueOf("finalResponse"),
    studentMessage: valueOf("studentMessage"),
    savedAt: new Date().toISOString()
  }));
}

function getLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function renderChat() {
  const chat = $("chat");
  chat.innerHTML = "";
  history.forEach((message) => appendMessage(message.role, message.text));
}

function appendMessage(role, text) {
  const chat = $("chat");
  const div = document.createElement("div");
  let safeRole = role || "system";
  if (!["student", "coach", "system"].includes(safeRole)) safeRole = "system";
  div.className = `msg ${safeRole}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function setSaveStatus(text) {
  setStatus("saveStatus", text);
}

window.addEventListener("beforeunload", saveLocalState);

document.addEventListener("input", (event) => {
  if (session && (event.target.id === "finalResponse" || event.target.id === "studentMessage")) {
    saveLocalState();
    if (event.target.id === "finalResponse") scheduleServerDraftSave();
  }
});

$("startBtn").addEventListener("click", startMission);
$("sendBtn").addEventListener("click", sendToCoach);
$("submitBtn").addEventListener("click", submitFinal);
