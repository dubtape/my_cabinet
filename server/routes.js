import { initStore, createMeeting, listMeetings, getMeeting, listMessages, listLlmCalls, getArtifacts, flush } from "./store.js";
import { runMeeting } from "./orchestrator.js";

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
        req.connection.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve(null);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function parseId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1];
}

export async function bootstrap() {
  await initStore();
}

export async function handleApi(req, res, parsedUrl) {
  const { pathname, query } = parsedUrl;

  if (req.method === "GET" && pathname === "/api/meetings") {
    const limit = Number(query.limit || 20);
    const offset = Number(query.offset || 0);
    const list = listMeetings({ limit, offset });
    return sendJson(res, 200, { data: list });
  }

  if (req.method === "POST" && pathname === "/api/meetings") {
    try {
      const body = await readBody(req);
      if (!body?.issue_text) {
        return sendJson(res, 400, { error: "issue_text is required" });
      }
      const meeting = createMeeting(body);
      await flush();
      return sendJson(res, 201, { data: meeting });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && pathname.startsWith("/api/meetings/") && !pathname.endsWith("/run") && !pathname.endsWith("/stream")) {
    const id = parseId(pathname);
    const meeting = getMeeting(id);
    if (!meeting) return sendJson(res, 404, { error: "Meeting not found" });
    const messages = listMessages(id);
    const calls = listLlmCalls(id);
    const artifacts = getArtifacts(id) || {};
    return sendJson(res, 200, { data: { meeting, messages, llm_calls: calls, artifacts } });
  }

  if (req.method === "POST" && pathname.endsWith("/run")) {
    const id = parseId(pathname);
    const meeting = getMeeting(id);
    if (!meeting) return sendJson(res, 404, { error: "Meeting not found" });
    try {
      const result = await runMeeting(id);
      await flush();
      return sendJson(res, 200, { data: result });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === "GET" && pathname.endsWith("/stream")) {
    const id = parseId(pathname);
    const meeting = getMeeting(id);
    if (!meeting) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const payload = JSON.stringify({ meeting, messages: listMessages(id), llm_calls: listLlmCalls(id) });
    res.write(`event: meeting.updated\n`);
    res.write(`data: ${payload}\n\n`);
    res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}
