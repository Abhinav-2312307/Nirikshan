import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Nirikshan - Civic Issue Reporter & Quality Map",
  description: "High-resolution geospatial platform to report civic issues and analyze neighborhood AQI/maintenance quality scores.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 relative overflow-x-hidden">
        <div className="glass-blob blob-1"></div>
        <div className="glass-blob blob-2"></div>
        <div className="glass-blob blob-3"></div>
        {children}
      </body>
    </html>
  );
}
