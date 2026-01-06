const app = document.getElementById("app");

const routes = {
  "/": renderMeetings,
  "/meetings": renderMeetings,
  "/meetings/new": renderNewMeeting,
};

async function navigate(path) {
  history.pushState({}, "", path);
  await render();
}

window.addEventListener("popstate", render);

async function render() {
  const path = window.location.pathname;
  const meetingDetailMatch = path.match(/^\/meetings\/([a-z0-9-]+)$/i);
  if (meetingDetailMatch) {
    return renderMeetingDetail(meetingDetailMatch[1]);
  }

  const handler = routes[path] || routes["/meetings"];
  return handler();
}

function html(strings, ...values) {
  return strings
    .map((str, i) => {
      const val = values[i] ?? "";
      return str + val;
    })
    .join("");
}

function setContent(content) {
  app.innerHTML = content;
  bindLinks();
}

function bindLinks() {
  document.querySelectorAll("[data-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.getAttribute("href"));
    });
  });
}

function statusPill(status) {
  return `<span class="status ${status}">${status}</span>`;
}

async function renderMeetings() {
  const data = await fetchJson("/api/meetings");
  const meetings = data?.data || [];
  setContent(
    html`<div class="hero">
        <h1>内阁议事 · 一轮定案</h1>
        <p>仿 OpenAI 科技质感的「内阁式多模型」界面，融入青绿点缀与汉字韵味，帮助你快速完成一次高质量决策。</p>
        <div class="nav">
          <a class="btn" data-link href="/meetings/new">➕ 发起新会议</a>
          <a class="btn secondary" data-link href="/meetings">📜 查看历史</a>
        </div>
      </div>
      <h2 class="section-title">最近的会议</h2>
      <div class="grid">
        ${meetings
          .map(
            (m) => html`<div class="card">
              <div class="list-meta">
                ${statusPill(m.status)}
                <span class="inline">模式：${m.mode}</span>
                <span class="inline">创建：${new Date(m.created_at).toLocaleString()}</span>
              </div>
              <h3>${m.title || "未命名会议"}</h3>
              <p class="muted">${m.issue_text.slice(0, 120) || "尚无议题"}</p>
              <div class="actions">
                <a class="btn secondary" data-link href="/meetings/${m.id}">查看详情</a>
              </div>
            </div>`
          )
          .join("")}
        ${meetings.length === 0 ? '<p class="muted">暂无会议，点击上方按钮发起。</p>' : ""}
      </div>`
  );
}

async function renderNewMeeting() {
  setContent(
    html`<div class="card">
      <h2 class="section-title">发起新会议</h2>
      <form id="new-meeting-form">
        <label>
          标题（可空）
          <input type="text" name="title" placeholder="例如：提升留存的闭环方案" />
        </label>
        <label>
          议题 <span class="muted">（必填）</span>
          <textarea required name="issue_text" rows="4" placeholder="一句话描述问题、目标或挑战"></textarea>
        </label>
        <label>
          模式
          <select name="mode">
            <option value="QUICK">QUICK（默认）</option>
            <option value="STANDARD">STANDARD</option>
          </select>
        </label>
        <div class="budget-grid">
          <label>总 token 上限
            <input type="text" name="max_total_tokens" value="12000" />
          </label>
          <label>单角色输出上限
            <input type="text" name="per_role_max_output_tokens" value="500" />
          </label>
          <label>总理输出上限
            <input type="text" name="prime_max_output_tokens" value="800" />
          </label>
          <label>书记官输出上限
            <input type="text" name="clerk_max_output_tokens" value="350" />
          </label>
        </div>
        <button class="btn" type="submit">🚀 创建并运行</button>
      </form>
    </div>`
  );

  const form = document.getElementById("new-meeting-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      title: fd.get("title") || undefined,
      issue_text: fd.get("issue_text"),
      mode: fd.get("mode") || "QUICK",
      budget: {
        max_total_tokens: Number(fd.get("max_total_tokens")),
        per_role_max_output_tokens: Number(fd.get("per_role_max_output_tokens")),
        prime_max_output_tokens: Number(fd.get("prime_max_output_tokens")),
        clerk_max_output_tokens: Number(fd.get("clerk_max_output_tokens")),
      },
    };
    const created = await fetchJson("/api/meetings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    if (created?.data?.id) {
      await fetchJson(`/api/meetings/${created.data.id}/run`, { method: "POST" });
      navigate(`/meetings/${created.data.id}`);
    }
  });
}

async function renderMeetingDetail(id) {
  const detail = await fetchJson(`/api/meetings/${id}`);
  const m = detail?.data?.meeting;
  if (!m) {
    setContent("<p class='muted'>会议不存在。</p>");
    return;
  }
  const messages = detail.data.messages || [];
  const artifacts = detail.data.artifacts || {};

  const budgetPercent = Math.min(100, Math.round((m.usage_total_tokens / m.budget_max_total_tokens) * 100));
  const degradeNotes = (m.degrade_notes || []).map((d) => `<div class="degrade-note">⚡ ${d}</div>`).join("");

  setContent(
    html`<div class="card">
        <div class="list-meta">
          ${statusPill(m.status)}
          <span class="inline">模式：${m.mode}</span>
          <span class="inline">Token 使用：${m.usage_total_tokens}/${m.budget_max_total_tokens}</span>
        </div>
        <h2>${m.title}</h2>
        <p class="muted">${m.issue_text}</p>
        <div class="progress"><div class="progress-bar" style="width:${budgetPercent}%;"></div></div>
        ${degradeNotes}
        <div class="actions">
          <a class="btn secondary" data-link href="/meetings">返回列表</a>
        </div>
      </div>
      <h3 class="section-title">时间轴</h3>
      <div class="timeline">
        ${messages
          .map((msg) => renderMessage(msg))
          .join("")}
      </div>
      <h3 class="section-title">会议产物</h3>
      <div class="grid">
        <div class="card">
          <h3>Issue Brief</h3>
          <pre class="muted">${formatJson(artifacts.issue_brief)}</pre>
        </div>
        <div class="card">
          <h3>Speak Plan</h3>
          <pre class="muted">${formatJson(artifacts.speak_plan)}</pre>
        </div>
        <div class="card">
          <h3>Round Summary</h3>
          <pre class="muted">${formatJson(artifacts.round_summary)}</pre>
        </div>
        <div class="card">
          <h3>Final Decision</h3>
          <pre class="muted">${formatJson(artifacts.final_decision)}</pre>
        </div>
      </div>`
  );
}

function renderMessage(msg) {
  const emoji = {
    PRIME: "🌿",
    CRITIC: "⚖️",
    FINANCE: "💰",
    WORKS: "🛠️",
    CLERK: "🪶",
    USER: "🙋",
    SYSTEM: "🧭",
  }[msg.sender_role] || "💬";

  const titleMap = {
    ISSUE_BRIEF: "议题解析",
    RELEVANCE: "相关性判断",
    SPEECH: "部门发言",
    SUMMARY: "书记官纪要",
    FINAL: "总理定案",
    PLAIN_TEXT: "系统说明",
  };
  return html`<div class="timeline-item">
    <div class="meta">
      <span class="role-emoji">${emoji}</span>
      <span class="pill">${msg.sender_role || msg.sender_type}</span>
      <span class="pill">${titleMap[msg.message_type] || msg.message_type}</span>
      <span class="muted">${new Date(msg.created_at).toLocaleTimeString()}</span>
    </div>
    ${renderContent(msg)}
  </div>`;
}

function renderContent(msg) {
  if (msg.message_type === "SPEECH" && msg.content_json) {
    const speech = msg.content_json;
    return html`<p class="muted">${speech.position}</p>
      <ul class="points">
        ${(speech.points || []).map((p) => `<li>[${p.type}] ${p.id}: ${p.text}</li>`).join("")}
      </ul>`;
  }
  if (msg.message_type === "ISSUE_BRIEF") {
    const brief = msg.content_json || {};
    return html`<p class="muted">${brief.context}</p>
      <div class="points">${(brief.goals || []).map((g) => `<div>🎯 ${g}</div>`).join("")}</div>`;
  }
  if (msg.message_type === "SUMMARY") {
    const s = msg.content_json || {};
    return html`<div class="points">
      <div>共识：${(s.consensus || []).join("、")}</div>
      <div>分歧：${(s.conflicts || []).map((c) => c.text).join("；")}</div>
      <div>假设：${(s.assumptions || []).map((a) => a.text).join("；")}</div>
      <div>行动草案：${(s.actions_draft || []).map((a) => a.text).join("；")}</div>
    </div>`;
  }
  if (msg.message_type === "FINAL") {
    const f = msg.content_json || {};
    return html`<p>${f.final_answer}</p>
      <div class="points">${(f.risks || []).map((r) => `<div>⚠️ ${r}</div>`).join("")}</div>`;
  }
  return `<pre class="muted">${formatJson(msg.content_json || msg.content_text)}</pre>`;
}

function formatJson(data) {
  if (!data) return "—";
  return JSON.stringify(data, null, 2);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    console.error("请求失败", res.status);
    return null;
  }
  return res.json();
}

render();
