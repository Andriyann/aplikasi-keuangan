import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export async function GET() {
  if (!(await getChatGPTUser())) return new Response(null, { status: 401 });
  const url = (env as unknown as Record<string, string>).MYUANG_PRICES_URL;
  if (!url)
    return Response.json(
      { error: "Sumber harga harian belum diatur." },
      { status: 503 },
    );
  if (new URL(url).protocol !== "https:")
    return new Response(null, { status: 400 });
  const r = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return new Response(null, { status: 502 });
  const data = (await r.json()) as {
    date: string;
    currency: string;
    prices: Record<string, number>;
  };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
    !data.prices ||
    typeof data.currency !== "string"
  )
    return new Response(null, { status: 502 });
  return Response.json(
    {
      date: data.date,
      currency: data.currency,
      prices: Object.fromEntries(
        Object.entries(data.prices).filter(
          ([k, v]) => k.length < 40 && Number.isFinite(v) && v > 0,
        ),
      ),
    },
    { headers: { "Cache-Control": "private, max-age=900" } },
  );
}
