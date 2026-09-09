// POST /api/help — the "Need help?" assistant. Answers how-do-I questions
// about this app, powered by Claude with the app guide as its knowledge.
// Requires ANTHROPIC_API_KEY; without it the client falls back to the
// built-in topic browser (same knowledge, no conversation).

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { authEnforced, verifyUser } from "@/lib/server/auth";
import { APP_GUIDE } from "@/lib/help-guide";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const who = await verifyUser(req);
  if (!who.ok)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: who.status });
  if (!who.userId && authEnforced)
    return NextResponse.json({ ok: false, reason: "sign in first" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ ok: false, reason: "assistant not configured" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid body" }, { status: 400 });
  }
  const question = String(body?.question ?? "").slice(0, 2000).trim();
  if (!question)
    return NextResponse.json({ ok: false, reason: "ask a question" }, { status: 400 });

  // a short conversational memory — enough for follow-up questions
  const history: Anthropic.MessageParam[] = Array.isArray(body?.history)
    ? body.history
        .slice(-6)
        .filter(
          (m: any) =>
            (m?.role === "user" || m?.role === "assistant") &&
            typeof m?.content === "string"
        )
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    : [];

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      // help answers are deliberately short — a couple of paragraphs at most
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: APP_GUIDE,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [...history, { role: "user", content: question }],
    });
    if (response.stop_reason === "refusal")
      return NextResponse.json({
        ok: false,
        reason: "the assistant declined that question — try rephrasing it",
      });
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!answer)
      return NextResponse.json({ ok: false, reason: "no answer came back — try again" });
    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return NextResponse.json({ ok: false, reason: "assistant not configured" });
    if (error instanceof Anthropic.RateLimitError)
      return NextResponse.json({
        ok: false,
        reason: "the assistant is busy — try again in a minute",
      });
    if (error instanceof Anthropic.APIError)
      return NextResponse.json({
        ok: false,
        reason: `the assistant hit an error (${error.status}) — try again`,
      });
    return NextResponse.json({ ok: false, reason: "could not reach the assistant" });
  }
}
