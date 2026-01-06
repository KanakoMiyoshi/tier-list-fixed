// app/api/img/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return new NextResponse("missing url", { status: 400 });

  // ✅ セキュリティ：自分のSupabaseドメインだけ許可（必要なら調整）
  // 例: https://zutnxhoxzrtoyxemgptx.supabase.co/...
  const allowedHost = "zutnxhoxzrtoyxemgptx.supabase.co";
  const u = new URL(url);
  if (u.host !== allowedHost) {
    return new NextResponse("forbidden host", { status: 403 });
  }

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return new NextResponse(`upstream error: ${upstream.status}`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const buf = await upstream.arrayBuffer();

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      // ✅ これで “localhost配下の画像” として扱える
      "Cache-Control": "public, max-age=3600",
    },
  });
}
