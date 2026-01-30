export interface MatrixCell {
  distanceKm: number;
  durationMin: number;
}

export interface MatrixResult {
  matrix: MatrixCell[][];
}

const KEY = process.env.ORS_KEY!;

export async function fetchRouteMatrix(
  origins: string[],
  destinations: string[]
): Promise<MatrixResult> {

  const locations = [...origins, ...destinations].map(p => {
    const [lat, lon] = p.split(",").map(Number);
    return [lon, lat]; // ORS uses lon,lat
  });

  const body = {
    locations,
    sources: origins.map((_, i) => i),
    destinations: destinations.map((_, i) => i + origins.length),
    metrics: ["distance", "duration"],
  };

  const res = await fetch(
    "https://api.openrouteservice.org/v2/matrix/driving-car",
    {
      method: "POST",
      headers: {
        "Authorization": KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const j = await res.json();

  const matrix: MatrixCell[][] = j.distances.map((row: number[], i: number) =>
    row.map((distMeters: number, jIdx: number) => ({
      distanceKm: distMeters / 1000,
      durationMin: j.durations[i][jIdx] / 60,
    }))
  );

  return { matrix };
}
