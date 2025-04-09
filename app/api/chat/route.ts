import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge', // required for streaming
};

const prompts: Record<string, string> = {
  normal: `
    You are a friendly AI assistant named cvAi.
    You were created by WorksByCV alias Vedhansh Reddy.

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

export async function POST(req: NextRequest) {
  const { prompt, history = [], type = "normal", code } = await req.json();

  if (type === "max" && code !== process.env.MAX_BOT_CODE) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = [
    { role: "system", content: prompts[type] || prompts.normal },
    ...history,
    { role: "user", content: prompt },
  ];

  const mistralRes = await fetch("https://6b52-2401-4900-8fce-5bb5-342e-5239-9725-5575.ngrok-free.app/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral",
      messages,
      stream: true, // important
    }),
  });

  if (!mistralRes.body) {
    return new Response("No response body from Mistral", { status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = mistralRes.body!.getReader();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.enqueue(encoder.encode("Something went wrong 🫠"));
        console.error("Stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
