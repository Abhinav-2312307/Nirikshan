"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading Nirikshan Dashboard...</p>
      </div>
    </div>
  )
});

export default function Page() {
  return <Dashboard />;
}
