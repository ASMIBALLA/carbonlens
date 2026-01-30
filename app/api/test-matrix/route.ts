import { fetchRouteMatrix } from "@/lib/optimization/matrixAdapter";

export async function GET() {

  try {

    const matrix = await fetchRouteMatrix(
      ["52.5200,13.4050"], // Berlin
      ["48.8566,2.3522"]   // Paris
    );

    return Response.json({
      ok: true,
      matrix
    });

  } catch (e: any) {

    return Response.json({
      ok: false,
      error: e.message
    }, { status: 500 });

  }
}
