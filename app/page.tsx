import TrafficViz from "@/components/TrafficViz";

export default function Page() {
  return (
    <main style={{
      minHeight: "100vh",
      padding: "28px",
      background:
        "radial-gradient(900px 420px at 12% 10%, rgba(99,102,241,0.28), transparent 55%)," +
        "radial-gradient(700px 380px at 80% 8%, rgba(168,85,247,0.20), transparent 55%)," +
        "linear-gradient(180deg, rgba(2,6,23,1), rgba(15,23,42,1))",
      color: "white"
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>CarbonLens</div>
            <div style={{ marginTop: 6, opacity: 0.75 }}>
              Real-time traffic signal → emission multiplier → route recommendation
            </div>
          </div>
          <div style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            opacity: 0.9,
            fontSize: 12
          }}>
            Telemetry
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <TrafficViz
            point="52.5200,13.4050"
            baseDurationMin={60}
            title="Live Traffic Signal"
            pollMs={2000}
          />
        </div>
      </div>
    </main>
  );
}
