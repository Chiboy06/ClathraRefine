"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePerm } from "./access";
import { SYSTEM_PROMPT, TOOL_DECLARATIONS } from "../lib/assistantTools";

// One model step for the plant assistant.
// Tries Gemini first (GEMINI_API_KEY), falls back to Grok/xAI (GROK_API_KEY).
// Tools run in the browser against the plant data the operator sees.
export const step = action({
  args: { contents: v.array(v.any()) },
  returns: v.object({ text: v.optional(v.string()), calls: v.optional(v.array(v.object({ name: v.string(), args: v.any() }))), cached: v.boolean() }),
  handler: async (ctx, { contents }): Promise<{ text?: string; calls?: { name: string; args: unknown }[]; cached: boolean }> => {
    await requirePerm(ctx, "read");
    const hash = await sha256(JSON.stringify(contents));
    const hit: string | null = await ctx.runQuery(internal.assistantCache.get, { hash });
    if (hit) return { text: hit, cached: true };

    const geminiKey = process.env.GEMINI_API_KEY;
    const grokKey = process.env.GROK_API_KEY;

    if (geminiKey) {
      const result = await runGemini(geminiKey, contents);
      if (result) {
        if (result.calls?.length) return { calls: result.calls, cached: false };
        if (result.text) {
          await ctx.runMutation(internal.assistantCache.set, { hash, answer: result.text });
          return { text: result.text, cached: false };
        }
      }
    }

    if (grokKey) {
      const result = await runGrok(grokKey, contents);
      if (result) {
        if (result.calls?.length) return { calls: result.calls, cached: false };
        if (result.text) {
          await ctx.runMutation(internal.assistantCache.set, { hash, answer: result.text });
          return { text: result.text, cached: false };
        }
      }
    }

    throw new Error("No AI key configured. Set GEMINI_API_KEY or GROK_API_KEY on the Convex deployment.");
  },
});

type StepResult = { text?: string; calls?: { name: string; args: unknown }[] } | null;

async function runGemini(apiKey: string, contents: unknown[]): Promise<StepResult> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const r = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: contents as Parameters<typeof ai.models.generateContent>[0]["contents"],
      config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: TOOL_DECLARATIONS }], temperature: 0.2 },
    });
    const calls = r.functionCalls?.map((c) => ({ name: c.name ?? "", args: c.args ?? {} }));
    if (calls?.length) return { calls };
    return { text: r.text ?? "" };
  } catch {
    return null;
  }
}

async function runGrok(apiKey: string, contents: unknown[]): Promise<StepResult> {
  try {
    // Grok uses an OpenAI-compatible API at api.x.ai
    const messages = contentsToOpenAI(contents);
    const tools = TOOL_DECLARATIONS.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: (t as { parametersJsonSchema?: unknown }).parametersJsonSchema ?? { type: "object", properties: {} },
      },
    }));
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-3-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        tools,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string; tool_calls?: { function: { name: string; arguments: string } }[] } }[] };
    const msg = data.choices?.[0]?.message;
    if (!msg) return null;
    if (msg.tool_calls?.length) {
      const calls = msg.tool_calls.map((tc) => ({
        name: tc.function.name,
        args: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
      }));
      return { calls };
    }
    return { text: msg.content ?? "" };
  } catch {
    return null;
  }
}

/** Convert Gemini-style contents array to OpenAI messages format. */
function contentsToOpenAI(contents: unknown[]): { role: string; content: string }[] {
  return (contents as { role: string; parts: { text?: string; functionCall?: { name: string; args: unknown }; functionResponse?: { name: string; response: unknown } }[] }[]).map((c) => {
    const text = c.parts
      .map((p) => {
        if (p.text) return p.text;
        if (p.functionCall) return `[Tool call: ${p.functionCall.name}(${JSON.stringify(p.functionCall.args)})]`;
        if (p.functionResponse) return `[Tool result for ${p.functionResponse.name}: ${JSON.stringify(p.functionResponse.response)}]`;
        return "";
      })
      .join("\n");
    return { role: c.role === "model" ? "assistant" : "user", content: text };
  });
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
