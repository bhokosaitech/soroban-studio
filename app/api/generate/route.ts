import { NextResponse } from "next/server";
import { generateWorkflow } from "@/lib/ai/generate";

export const runtime = "nodejs";

/** POST /api/generate  { prompt: string } -> { workflow, source } */
export async function POST(req: Request) {
  let prompt = "";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!prompt.trim()) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  const result = await generateWorkflow(prompt);
  return NextResponse.json(result);
}
