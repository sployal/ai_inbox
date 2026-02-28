// ─── app/api/groq/route.ts ────────────────────────────────────────────────────
// Server-side Groq proxy. The page.tsx calls this instead of hitting Groq
// directly, so GROQ_API_KEY is never exposed to the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt, system } = await req.json();

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model:       "llama-3.1-70b-versatile",
        max_tokens:  600,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user",   content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[api/groq] Groq error:", err);
      return NextResponse.json({ error: "Groq request failed", detail: err }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });

  } catch (err) {
    console.error("[api/groq] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}