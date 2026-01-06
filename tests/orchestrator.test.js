import test from "node:test";
import assert from "node:assert/strict";
import { createMeeting, resetDb, listMessages, getMeeting } from "../server/store.js";
import { runMeeting } from "../server/orchestrator.js";

test("T1 正常议题：输出完整链路并完成定案", async () => {
  resetDb();
  const meeting = createMeeting({ issue_text: "推出面向高校的AI助教计划", title: "高校助教" });
  await runMeeting(meeting.id);
  const messages = listMessages(meeting.id);
  const finalMsg = messages.find((m) => m.message_type === "FINAL");
  assert.ok(finalMsg, "应产生最终定案");
  assert.equal(getMeeting(meeting.id).status, "COMPLETED");
  assert.ok((finalMsg.content_json.references || []).length >= 2, "定案引用至少两个部门要点");
});

test("T5 超小预算触发降级仍能完成定案", async () => {
  resetDb();
  const meeting = createMeeting({
    issue_text: "预算紧张的风控改造",
    budget: { max_total_tokens: 200, per_role_max_output_tokens: 80, prime_max_output_tokens: 100, clerk_max_output_tokens: 60 },
  });
  await runMeeting(meeting.id);
  const updated = getMeeting(meeting.id);
  assert.equal(updated.status, "COMPLETED");
  assert.ok((updated.degrade_notes || []).length > 0, "应记录降级原因");
});
