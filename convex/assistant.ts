"use node";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePerm } from "./access";
import { SYSTEM_PROMPT, TOOL_DECLARATIONS } from "../lib/assistantTools";

// One model step for the plant assistant. Tools run in the browser against the plant data the operator sees,
// so the key stays here (Convex env GEMINI_API_KEY) and answers come from tool results, never from memory.
export const step = action({
  args: { contents: v.array(v.any()) },
  returns: v.object({ text: v.optional(v.string()), calls: v.optional(v.array(v.object({ name: v.string(), args: v.any() }))), cached: v.boolean() }),
  handler: async (ctx, { contents }): Promise<{ text?: string; calls?: { name: string; args: unknown }[]; cached: boolean }> => {
    await requirePerm(ctx, "read");
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const hash = await sha256(JSON.stringify(contents));
    const hit: string | null = await ctx.runQuery(internal.assistantCache.get, { hash });
    if (hit) return { text: hit, cached: true };

    const ai = new GoogleGenAI({ apiKey: key });
    const r = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents,
      config: { systemInstruction: SYSTEM_PROMPT, tools: [{ functionDeclarations: TOOL_DECLARATIONS }], temperature: 0.2 },
    });
    const calls = r.functionCalls?.map((c) => ({ name: c.name ?? "", args: c.args ?? {} }));
    if (calls?.length) return { calls, cached: false };
    const text = r.text ?? "";
    // Answers that already used tool results are cached for 2 minutes against the same question and data.
    if (text) await ctx.runMutation(internal.assistantCache.set, { hash, answer: text });
    return { text, cached: false };
  },
});

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
