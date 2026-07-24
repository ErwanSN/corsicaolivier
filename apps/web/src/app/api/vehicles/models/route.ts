import { NextResponse } from "next/server";

type VpicModel = Readonly<{ Model_Name: string }>;

export async function GET(request: Request) {
  const make = new URL(request.url).searchParams.get("make")?.trim();
  if (!make) return NextResponse.json({ models: [] });
  const endpoint = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`;
  const response = await fetch(endpoint, { next: { revalidate: 86_400 } });
  if (!response.ok) return NextResponse.json({ models: [] }, { status: 502 });
  const payload = (await response.json()) as Readonly<{ Results: VpicModel[] }>;
  const names = payload.Results.map(({ Model_Name }) => Model_Name.trim()).filter(Boolean);
  const models = [...new Set(names)].sort((left, right) => left.localeCompare(right, "fr"));
  return NextResponse.json({ models });
}
