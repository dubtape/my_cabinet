import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../data/db.json");

const defaultBudgets = {
  max_total_tokens: 12000,
  max_cost_usd: null,
  per_role_max_output_tokens: 500,
  prime_max_output_tokens: 800,
  clerk_max_output_tokens: 350,
};

const roleDefaults = {
  PRIME: { temperature: 0.4, max_output_tokens: 800, system_prompt_version: "v1" },
  CRITIC: { temperature: 0.6, max_output_tokens: 500, system_prompt_version: "v1" },
  FINANCE: { temperature: 0.3, max_output_tokens: 500, system_prompt_version: "v1" },
  WORKS: { temperature: 0.4, max_output_tokens: 500, system_prompt_version: "v1" },
  CLERK: { temperature: 0.2, max_output_tokens: 350, system_prompt_version: "v1" },
};

let db = {
  meetings: [],
  meeting_role_configs: [],
  messages: [],
  llm_calls: [],
  meeting_artifacts: [],
};

async function loadDb() {
  try {
    const content = await fs.readFile(dbPath, "utf-8");
    db = JSON.parse(content);
  } catch {
    // ignore missing file
  }
}

async function persist() {
  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function now() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID();
}

export async function initStore() {
  await loadDb();
}

export function listMeetings({ limit = 20, offset = 0 } = {}) {
  const slice = db.meetings
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(offset, offset + limit);
  return slice;
}

export function resetDb() {
  db = {
    meetings: [],
    meeting_role_configs: [],
    messages: [],
    llm_calls: [],
    meeting_artifacts: [],
  };
}

export function getMeeting(id) {
  return db.meetings.find((m) => m.id === id);
}

export function createMeeting(input) {
  const id = randomId();
  const created = now();
  const budget = {
    max_total_tokens: input?.budget?.max_total_tokens ?? defaultBudgets.max_total_tokens,
    max_cost_usd: input?.budget?.max_cost_usd ?? defaultBudgets.max_cost_usd,
    per_role_max_output_tokens:
      input?.budget?.per_role_max_output_tokens ?? defaultBudgets.per_role_max_output_tokens,
    prime_max_output_tokens: input?.budget?.prime_max_output_tokens ?? defaultBudgets.prime_max_output_tokens,
    clerk_max_output_tokens: input?.budget?.clerk_max_output_tokens ?? defaultBudgets.clerk_max_output_tokens,
  };

  const meeting = {
    id,
    title: input?.title || buildDefaultTitle(),
    issue_text: input?.issue_text || "",
    mode: input?.mode || "QUICK",
    status: "CREATED",
    budget_max_total_tokens: budget.max_total_tokens,
    budget_max_cost_usd: budget.max_cost_usd,
    budget_per_role_max_output_tokens: budget.per_role_max_output_tokens,
    budget_prime_max_output_tokens: budget.prime_max_output_tokens,
    budget_clerk_max_output_tokens: budget.clerk_max_output_tokens,
    created_at: created,
    updated_at: created,
    usage_total_tokens: 0,
    usage_cost_usd: 0,
    degrade_notes: [],
  };

  db.meetings.push(meeting);

  const roles = ["PRIME", "CRITIC", "FINANCE", "WORKS", "CLERK"];
  roles.forEach((role) => {
    const cfg = roleDefaults[role];
    db.meeting_role_configs.push({
      id: randomId(),
      meeting_id: id,
      role,
      provider: "local-sim",
      model: "gpt-sim-001",
      temperature: cfg.temperature,
      max_output_tokens: cfg.max_output_tokens,
      system_prompt_version: cfg.system_prompt_version,
      created_at: created,
    });
  });

  return meeting;
}

function buildDefaultTitle() {
  const nowDate = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${nowDate.getFullYear()}${pad(nowDate.getMonth() + 1)}${pad(
    nowDate.getDate()
  )}-${pad(nowDate.getHours())}${pad(nowDate.getMinutes())}`;
  return `会议-${stamp}`;
}

export function updateMeeting(id, patch) {
  const meeting = getMeeting(id);
  if (!meeting) return null;
  Object.assign(meeting, patch, { updated_at: now() });
  return meeting;
}

export function addMessage(meetingId, payload) {
  const seq = nextSeq(meetingId);
  const message = {
    id: randomId(),
    meeting_id: meetingId,
    seq,
    sender_type: payload.sender_type,
    sender_role: payload.sender_role || null,
    message_type: payload.message_type,
    content_text: payload.content_text || null,
    content_json: payload.content_json || null,
    created_at: now(),
  };
  db.messages.push(message);
  return message;
}

function nextSeq(meetingId) {
  const existing = db.messages.filter((m) => m.meeting_id === meetingId);
  if (!existing.length) return 1;
  return Math.max(...existing.map((m) => m.seq)) + 1;
}

export function listMessages(meetingId) {
  return db.messages
    .filter((m) => m.meeting_id === meetingId)
    .sort((a, b) => a.seq - b.seq);
}

export function addLlmCall(meetingId, payload) {
  const record = {
    id: randomId(),
    meeting_id: meetingId,
    role: payload.role,
    stage: payload.stage,
    provider: payload.provider || "local-sim",
    model: payload.model || "gpt-sim-001",
    status: payload.status || "OK",
    latency_ms: payload.latency_ms || 0,
    input_tokens: payload.input_tokens || 0,
    output_tokens: payload.output_tokens || 0,
    cost_usd: payload.cost_usd || 0,
    prompt_hash: payload.prompt_hash || null,
    error_code: payload.error_code || null,
    error_message: payload.error_message || null,
    created_at: now(),
  };
  db.llm_calls.push(record);
  return record;
}

export function listLlmCalls(meetingId) {
  return db.llm_calls.filter((c) => c.meeting_id === meetingId);
}

export function saveArtifact(meetingId, patch) {
  let artifact = db.meeting_artifacts.find((a) => a.meeting_id === meetingId);
  if (!artifact) {
    artifact = { meeting_id: meetingId, issue_brief: null, speak_plan: null, round_summary: null, final_decision: null };
    db.meeting_artifacts.push(artifact);
  }
  Object.assign(artifact, patch);
  return artifact;
}

export function getArtifacts(meetingId) {
  return db.meeting_artifacts.find((a) => a.meeting_id === meetingId);
}

export async function flush() {
  await persist();
}

export const tokens = { estimateTokens };
