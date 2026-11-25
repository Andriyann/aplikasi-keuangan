import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "Masuk ke akun MyUang." }, 401);
  const row = await env
    .DB!.prepare("SELECT revision,body FROM books WHERE owner=?")
    .bind(user.userId)
    .first<{ revision: number; body: string }>();
  return reply({
    revision: row?.revision || 0,
    book: row ? JSON.parse(row.body) : null,
    name: user.fullName || "",
    mode: "cloud",
  });
}
export async function PUT(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "Masuk diperlukan." }, 401);
  if (
    req.headers.get("Origin") !== new URL(req.url).origin ||
    !req.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({}, 403);
  const raw = await req.text();
  if (raw.length > 3500000)
    return reply({ error: "Ukuran buku melebihi batas." }, 413);
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return reply({}, 400);
  }
  const { revision, book } = value;
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (!book?.vault && book?.version !== 1)
  )
    return reply({}, 400);
  const body = JSON.stringify(book);
  const query =
    revision === 0
      ? env
          .DB!.prepare(
            "INSERT INTO books(owner,revision,body) VALUES(?,1,?) ON CONFLICT(owner) DO NOTHING",
          )
          .bind(user.userId, body)
      : env
          .DB!.prepare(
            "UPDATE books SET revision=revision+1,body=? WHERE owner=? AND revision=?",
          )
          .bind(body, user.userId, revision);
  const result = await query.run();
  return result.meta.changes === 1
    ? reply({ revision: revision + 1 })
    : reply(
        {
          error:
            "Buku telah berubah pada perangkat lain. Muat ulang lalu ulangi perubahan.",
        },
        409,
      );
}
