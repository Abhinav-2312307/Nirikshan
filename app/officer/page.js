"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OfficerRootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("nirikshan_officer_token");
    if (token) {
      router.replace("/officer/dashboard");
    } else {
      router.replace("/officer/login");
    }
  }, [router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-widest text-amber-400">Verifying Administrative Clearance...</p>
      </div>
    </div>
  );
}
