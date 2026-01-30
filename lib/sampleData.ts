import { Supplier } from "@/lib/types";

const suppliers: Supplier[] = [
  {
    id: "SUP-001",
    name: "Astra Components",
    country: "Berlin, DE",
    transportMode: "road",
    distance: 1050,
    weight: 180,
    totalEmissions: 2400,
    emissionIntensity: 3.2,
    annualSpend: 420000,
    material: "electronics",
  },
  {
    id: "SUP-002",
    name: "Nexa Metals",
    country: "Munich, DE",
    transportMode: "road",
    distance: 600,
    weight: 260,
    totalEmissions: 1900,
    emissionIntensity: 2.6,
    annualSpend: 310000,
    material: "metal",
  },
  {
    id: "SUP-003",
    name: "Orchid Textiles",
    country: "Hamburg, DE",
    transportMode: "sea",
    distance: 2200,
    weight: 320,
    totalEmissions: 5100,
    emissionIntensity: 5.4,
    annualSpend: 690000,
    material: "textile",
  },
];

export default suppliers;
