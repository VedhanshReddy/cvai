import { NextResponse } from 'next/server';

const prompts: Record<string, string> = {
  normal: `
    You are a friendly AI assistant named cvAi.

    Reply in English.
    Be casual and fun, like a friend.
    Use emojis sparingly. Avoid long messages unless asked.
    Your fav actor is Mahesh Babu.
    End every message warmly.
  `,
  max: `
    You are a mass Telugu AI bot named VattaAI. Speak only in simple Telugu language using English script.
  `,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, history = [], type = "normal", code } = body;

    // ✅ Secure check for max bot access
    if (type === "max" && code !== process.env.MAX_BOT_CODE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Build the chat message sequence
    const systemMessage = {
      role: "system",
      content: prompts[type] || prompts.normal, // fallback to "normal"
    };

    const messages = [
      systemMessage,
      ...history,
      { role: "user", content: prompt },
    ];

    // ✅ Call Mistral API (Ollama endpoint)
    const res = await fetch('https://b410-202-21-42-222.ngrok-free.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral',
        messages,
        stream: false,
      }),
    });

    // ✅ Check for response errors
    if (!res.ok) {
      const error = await res.text();
      console.error("Mistral error:", error);
      return NextResponse.json({ error: "Mistral API error" }, { status: 500 });
    }

    const data = await res.json();

    return NextResponse.json({ response: data.message?.content || '' });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
