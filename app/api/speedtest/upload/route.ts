import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const reader = req.body?.getReader();
    let totalBytesReceived = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) totalBytesReceived += value.length;
      }
    } else {
      const blob = await req.arrayBuffer();
      totalBytesReceived = blob.byteLength;
    }

    return NextResponse.json({
      success: true,
      bytesReceived: totalBytesReceived
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
