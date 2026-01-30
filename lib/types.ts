export type TransportMode = "air" | "sea" | "road" | "rail";

export interface Supplier {
  id: string;
  name: string;

  // For demo, we use "country" as origin label
  country: string;

  // Logistics
  transportMode: TransportMode;
  distance: number; // km
  weight: number; // tonnes (or ton-equivalent)

  // Sustainability / finance (demo fields)
  totalEmissions: number; // tons CO2e
  emissionIntensity: number; // arbitrary intensity scale
  annualSpend: number; // USD

  // Optional
  material?: string;
}
