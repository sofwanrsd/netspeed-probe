import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sizeMb = Math.min(25, Math.max(1, parseInt(searchParams.get("size") || "10", 10)));
  const totalBytes = sizeMb * 1024 * 1024;
  const chunkSize = 65536; // 64KB per chunk
  const chunkBuffer = new Uint8Array(chunkSize);

  let bytesSent = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (bytesSent >= totalBytes) {
        controller.close();
        return;
      }
      const remaining = totalBytes - bytesSent;
      const toSend = Math.min(chunkSize, remaining);
      controller.enqueue(chunkBuffer.subarray(0, toSend));
      bytesSent += toSend;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": totalBytes.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
