"use client";

import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("./components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium tracking-wide text-cyan-400">Loading Nirikshan Dashboard...</p>
      </div>
    </div>
  )
});

export default function Page() {
  return <Dashboard />;
}
