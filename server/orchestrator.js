import {
  addLlmCall,
  addMessage,
  getMeeting,
  listMessages,
  saveArtifact,
  updateMeeting,
  tokens,
} from "./store.js";

const SPEAK_ROLES = ["CRITIC", "FINANCE", "WORKS"];

function estimateCost(outputTokens) {
  const pricePer1k = 0.0004;
  return Number(((outputTokens / 1000) * pricePer1k).toFixed(6));
}

function pushUsage(meeting, extraTokens, note) {
  meeting.usage_total_tokens = (meeting.usage_total_tokens || 0) + extraTokens;
  meeting.usage_cost_usd = Number(((meeting.usage_total_tokens / 1000) * 0.0004).toFixed(6));
  if (note) meeting.degrade_notes.push(note);
}

function makeIssueBrief(issueText) {
  return {
    topic: issueText.slice(0, 50) || "未命名议题",
    context: "基于用户输入的概述，确保聚焦一轮内阁讨论。",
    goals: ["澄清目标", "制定一轮可落地的行动"],
    constraints: ["预算与token受限", "一轮内完成定案"],
    questions: ["核心风险在哪里？", "需要优先验证什么？"],
    decision_type: "plan",
    missing_info: ["用户的资源限制", "优先级边界"],
  };
}

function makeRelevance(role) {
  const angleMap = {
    CRITIC: "验证关键假设与失败路径",
    FINANCE: "评估投入产出与成本兜底",
    WORKS: "制定阶段性路线与交付保障",
  };
  return {
    role,
    related: true,
    score: 0.48,
    angle: angleMap[role],
    need_inputs: [],
  };
}

function makePlan(relevanceList) {
  const orderedRoles = relevanceList
    .filter((r) => r.related !== false)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.role);
  return {
    ordered_roles: orderedRoles,
    focus: {
      CRITIC: ["关键假设与失败点"],
      FINANCE: ["预算、ROI与风险"],
      WORKS: ["阶段拆分与交付约束"],
    },
    stop_after_rounds: 1,
  };
}

function makePoints(role) {
  const base = {
    CRITIC: [
      { text: "假设A需验证，缺少反例数据", type: "assumption" },
      { text: "可能的失败路径：供应风险", type: "risk" },
      { text: "建议先做小范围验证", type: "recommendation" },
    ],
    FINANCE: [
      { text: "预算上限按轻量PoC估算", type: "constraint" },
      { text: "ROI取决于核心指标提升", type: "recommendation" },
      { text: "建议设置成本熔断阈值", type: "risk" },
    ],
    WORKS: [
      { text: "MVP聚焦最小闭环", type: "recommendation" },
      { text: "迭代阶段加入自动化", type: "recommendation" },
      { text: "稳定期补齐监控与治理", type: "constraint" },
    ],
  };

  return base[role].map((p, idx) => ({
    id: `${role[0]}${idx + 1}`,
    text: p.text,
    type: p.type,
  }));
}

function makeSpeech(role) {
  return {
    role,
    position: {
      CRITIC: "谨慎推进，先验证假设",
      FINANCE: "控制预算，按指标解锁投入",
      WORKS: "分阶段交付，先跑通闭环",
    }[role],
    points: makePoints(role),
    questions_to_user: ["是否有现成数据？", "时间优先级如何？"].slice(0, 2),
  };
}

function buildSummary(allPoints) {
  const consensus = [
    "先做小范围验证，再放大投入",
    "为关键假设设置验证与监控",
  ];
  const conflicts = [
    {
      id: "C1",
      text: "推进速度 vs 预算控制",
      sides: ["CRITIC:C2", "FINANCE:F2"],
    },
  ];
  const assumptions = [
    {
      id: "A1",
      text: "现有数据足以支撑MVP验证",
      how_to_verify: "收集一周数据样本，验证稳定性",
    },
  ];
  const actions = [
    { id: "T1", text: "组织一周PoC并记录成本", owner: "PRIME", priority: "P0" },
    { id: "T2", text: "确认成本熔断阈值与监控", owner: "FINANCE", priority: "P1" },
  ];

  return {
    consensus,
    conflicts,
    assumptions,
    actions_draft: actions,
  };
}

function buildFinalDecision(pointsByRole, degraded) {
  const refs = [
    `${pointsByRole.CRITIC?.[1]?.id ? "CRITIC:" + pointsByRole.CRITIC[1].id : "CRITIC:P1"}`,
    `${pointsByRole.FINANCE?.[0]?.id ? "FINANCE:" + pointsByRole.FINANCE[0].id : "FINANCE:P1"}`,
    `${pointsByRole.WORKS?.[0]?.id ? "WORKS:" + pointsByRole.WORKS[0].id : "WORKS:P1"}`,
  ];

  return {
    final_answer: "基于单轮讨论，先完成最小验证闭环，再按指标解锁资源。",
    rationale: ["聚焦核心假设验证，再进行规模化投入"],
    tradeoffs: ["短期减小投入可能导致速度放缓，但降低失败成本"],
    risks: ["供应链或数据不足导致验证偏差", "预算熔断未设可能超支"],
    next_actions: [
      { text: "启动一周PoC并定义成功指标", priority: "P0", timebox_days: 7 },
      { text: "设定预算熔断与监控看板", priority: "P1", timebox_days: 14 },
    ],
    references: refs,
    missing_info: degraded ? ["部分角色发言缺失，定案需复核"] : [],
    confidence: degraded ? 0.48 : 0.62,
  };
}

function stageTokens(meeting, role) {
  if (role === "PRIME") return meeting.budget_prime_max_output_tokens;
  if (role === "CLERK") return meeting.budget_clerk_max_output_tokens;
  return meeting.budget_per_role_max_output_tokens;
}

export async function runMeeting(meetingId) {
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.status === "RUNNING") throw new Error("Meeting already running");

  updateMeeting(meetingId, { status: "RUNNING" });

  const usedPoints = {};
  let degraded = false;

  // Stage 1: parse issue
  const issueBrief = makeIssueBrief(meeting.issue_text);
  pushUsage(meeting, Math.min(stageTokens(meeting, "PRIME"), tokens.estimateTokens(JSON.stringify(issueBrief))));
  addMessage(meetingId, {
    sender_type: "ROLE",
    sender_role: "PRIME",
    message_type: "ISSUE_BRIEF",
    content_json: issueBrief,
  });
  addLlmCall(meetingId, {
    role: "PRIME",
    stage: "PARSE_ISSUE",
    output_tokens: stageTokens(meeting, "PRIME"),
    latency_ms: 120,
  });
  saveArtifact(meetingId, { issue_brief: issueBrief });

  // Stage 2: relevance
  const relevance = SPEAK_ROLES.map((role) => makeRelevance(role));
  relevance.forEach((item) => {
    const text = JSON.stringify(item);
    pushUsage(meeting, Math.min(stageTokens(meeting, item.role), tokens.estimateTokens(text)));
    addMessage(meetingId, {
      sender_type: "ROLE",
      sender_role: item.role,
      message_type: "RELEVANCE",
      content_json: item,
    });
    addLlmCall(meetingId, {
      role: item.role,
      stage: "RELEVANCE",
      output_tokens: stageTokens(meeting, item.role),
      latency_ms: 50,
    });
  });

  // Stage 3: plan
  const plan = makePlan(relevance);
  pushUsage(meeting, tokens.estimateTokens(JSON.stringify(plan)));
  addMessage(meetingId, {
    sender_type: "ROLE",
    sender_role: "PRIME",
    message_type: "PLAIN_TEXT",
    content_json: plan,
    content_text: "排程已制定，进入发言环节。",
  });
  addLlmCall(meetingId, { role: "PRIME", stage: "PLAN", output_tokens: 120, latency_ms: 80 });
  saveArtifact(meetingId, { speak_plan: plan });

  // Stage 4: speak with budget checks
  for (const role of plan.ordered_roles) {
    const budgetRatio = meeting.usage_total_tokens / meeting.budget_max_total_tokens;
    if (budgetRatio >= 1) {
      degraded = true;
      meeting.degrade_notes.push("达到100%预算，直接进入定案");
      break;
    }
    if (budgetRatio >= 0.9) {
      degraded = true;
      meeting.degrade_notes.push("达到90%预算，跳过剩余发言转入纪要");
      break;
    }

    const speech = makeSpeech(role);
    usedPoints[role] = speech.points;
    const tokenUse = Math.min(stageTokens(meeting, role), tokens.estimateTokens(JSON.stringify(speech)));
    pushUsage(meeting, tokenUse);
    addMessage(meetingId, {
      sender_type: "ROLE",
      sender_role: role,
      message_type: "SPEECH",
      content_json: speech,
    });
    addLlmCall(meetingId, {
      role,
      stage: "SPEAK",
      output_tokens: stageTokens(meeting, role),
      latency_ms: 140,
    });
  }

  // Stage 5: summary
  const summary = buildSummary(usedPoints);
  pushUsage(meeting, tokens.estimateTokens(JSON.stringify(summary)));
  addMessage(meetingId, {
    sender_type: "ROLE",
    sender_role: "CLERK",
    message_type: "SUMMARY",
    content_json: summary,
  });
  addLlmCall(meetingId, { role: "CLERK", stage: "SUMMARY", output_tokens: stageTokens(meeting, "CLERK"), latency_ms: 90 });
  saveArtifact(meetingId, { round_summary: summary });

  // Stage 6: final decision
  const finalDecision = buildFinalDecision(usedPoints, degraded);
  pushUsage(meeting, tokens.estimateTokens(JSON.stringify(finalDecision)));
  addMessage(meetingId, {
    sender_type: "ROLE",
    sender_role: "PRIME",
    message_type: "FINAL",
    content_json: finalDecision,
  });
  addLlmCall(meetingId, { role: "PRIME", stage: "FINAL", output_tokens: stageTokens(meeting, "PRIME"), latency_ms: 110 });
  saveArtifact(meetingId, { final_decision: finalDecision });

  updateMeeting(meetingId, { status: "COMPLETED" });
  return {
    meeting: getMeeting(meetingId),
    messages: listMessages(meetingId),
  };
}
