import { NextResponse } from "next/server";
//import { fetchTrafficSignal } from "@/lib/optimization/trafficAdapter";
import { getTrafficSnapshot } from "@/lib/optimization/trafficAdapter";



export async function POST(req: Request) {
  console.log("🔥 /api/traffic/route HIT");

  const body = await req.json();
  console.log("📦 body:", body);

  const data = await fetchTrafficSignal(
    body.origin,
    body.destination
  );

  return NextResponse.json(data);
}
