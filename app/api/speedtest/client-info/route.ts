import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  let geo = {
    ip: clientIp,
    city: "Unknown City",
    country: "Unknown Country",
    countryCode: "UN",
    isp: "Local ISP",
    as: "AS0"
  };

  if (clientIp !== "127.0.0.1" && !clientIp.startsWith("192.168.") && !clientIp.startsWith("10.")) {
    try {
      const res = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city,isp,as`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          geo = {
            ip: clientIp,
            city: data.city || "Unknown City",
            country: data.country || "Unknown Country",
            countryCode: data.countryCode || "UN",
            isp: data.isp || "Unknown ISP",
            as: data.as || "Unknown AS"
          };
        }
      }
    } catch {
      // Ignore
    }
  }

  return NextResponse.json(geo, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
