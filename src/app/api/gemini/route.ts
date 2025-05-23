import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const API_KEY = process.env.GEMINI_API_KEY; // Use a secret, not NEXT_PUBLIC

  if (!API_KEY) {
    return NextResponse.json({ error: "API key not set" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    const aiResponse = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    });
    const result = await aiResponse.response;
    return NextResponse.json({ text: result.text() });
  } catch {
    return NextResponse.json({ error: "Gemini API error" }, { status: 500 });
  }
}