import { optimizeSupplierDestinations } from "@/lib/optimization/matrixOptimizer";
import suppliers from "@/lib/sampleData";

export async function GET() {

  const dcs = [
    "48.8566,2.3522",   // Paris
    "41.9028,12.4964"   // Rome
  ];

  const result = await optimizeSupplierDestinations(
    suppliers.slice(0, 2),
    dcs
  );

  return Response.json(result);
}
