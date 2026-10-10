import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  return NextResponse.json({
    pong: true,
    serverTime: Date.now(),
    clientIp
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
