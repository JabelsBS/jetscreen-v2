import { NextResponse } from "next/server";
export const revalidate = 0;
const API_URL = process.env.LOCAL_ADSB_URL || "";

export async function GET() {
  if (!API_URL) {
    return NextResponse.json({ error: "LOCAL_ADSB_URL is not configured" }, { status: 503 });
  }
  try {
    // Fetch data from the external API
    const response = await fetch(API_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });

    // Handle unsuccessful requests
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch aircraft data" },
        { status: response.status }
      );
    }

    // Parse the JSON data from the response
    const data = await response.json();

    // Return the data as a JSON response
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Handle any errors that occur during the fetch
    return NextResponse.json(
      { error: "An error occurred while fetching data" },
      { status: 500 }
    );
  }
}
