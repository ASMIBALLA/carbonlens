import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Mock prediction logic since we cannot run the Python pickle model in Node.js
        // In a real migration, this logic would be ported to TypeScript or use ONNX.

        // Simple heuristic emulation
        const distance = body.distance_km || 10;
        const factor = body.vehicle_type?.toLowerCase().includes("truck") ? 0.8 : 0.4;
        const emissions = distance * factor;

        return NextResponse.json({
            predicted_emission_kgco2e: emissions,
            predicted_emission_tons: emissions / 1000,
            input_data: body,
            model_version: "1.0.0 (Node.js Stub)"
        });
    } catch (error) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
