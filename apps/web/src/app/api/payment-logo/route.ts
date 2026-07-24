import { type NextRequest, NextResponse } from "next/server";

const logoSources = {
  amex: "https://cdn.simpleicons.org/americanexpress",
  cb: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo%20GIE%20CB%20(2024).svg",
  mastercard: "https://cdn.simpleicons.org/mastercard",
  visa: "https://cdn.simpleicons.org/visa"
} as const;

export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const brand = request.nextUrl.searchParams.get("brand");
  const source =
    brand && brand in logoSources ? logoSources[brand as keyof typeof logoSources] : undefined;
  if (!source) return NextResponse.json({ error: "Unknown payment brand" }, { status: 404 });

  const response = await fetch(source, { next: { revalidate } });
  if (!response.ok)
    return NextResponse.json({ error: "Payment logo unavailable" }, { status: 502 });

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "image/svg+xml; charset=utf-8"
    }
  });
}
