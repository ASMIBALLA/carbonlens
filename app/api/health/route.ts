import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        status: "healthy",
        model_loaded: true, // Mocked for Node.js service
        version: "1.0.0 (Node.js)",
    });
}
