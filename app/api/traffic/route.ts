import { NextResponse } from "next/server";
import { fetchTrafficSignal } from "@/lib/optimization/trafficAdapter";

export async function POST(req: Request) {
  const body = await req.json();

  const data = await fetchTrafficSignal(
    body.origin,
    body.destination
  );

  return NextResponse.json(data);
}
