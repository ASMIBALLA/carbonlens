import "./globals.css";
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: "CarbonLens",
  description: "Carbon risk + optimization demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
