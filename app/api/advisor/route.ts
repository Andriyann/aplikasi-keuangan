import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return new Response(null, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const config = env as unknown as Record<string, string>;
  if (!config.OPENAI_API_KEY)
    return Response.json(
      { error: "Model AI belum dikonfigurasi." },
      { status: 503 },
    );
  const body = await request.text();
  if (body.length > 9000) return new Response(null, { status: 413 });
  const { question, summary } = JSON.parse(body);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + config.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 600,
      instructions:
        "Jelaskan ringkasan keuangan pribadi. Gunakan bahasa pertanyaan, data agregat saja. Jika roasting diminta, lakukan dengan ramah. Jangan mengarang angka atau merekomendasikan produk investasi.",
      input: JSON.stringify({ question, summary }),
    }),
  });
  if (!response.ok)
    return Response.json(
      { error: "Penyedia AI gagal memproses permintaan." },
      { status: 502 },
    );
  const result = (await response.json()) as {
    output?: { content?: { text?: string }[] }[];
  };
  const answer = result.output
    ?.flatMap((x) => x.content || [])
    .map((x) => x.text || "")
    .join("")
    .trim();
  return answer
    ? Response.json({ answer })
    : Response.json({ error: "Jawaban kosong." }, { status: 502 });
}
