"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SAMPLE_OFFICERS = [
  {
    level: "National Level (MoHUA)",
    icon: "🏛️",
    badge: "Apex Command",
    badgeColor: "from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300",
    name: "Dr. Rajeshwar Prasad, IAS",
    designation: "Director General (Urban Governance)",
    email: "national.director@nirikshan.gov.in",
    jurisdiction: "Pan-India Command",
    password: "admin123"
  },
  {
    level: "State Level (Govt of UP)",
    icon: "🏢",
    badge: "State Directorate",
    badgeColor: "from-purple-500/20 to-indigo-500/20 border-purple-500/40 text-purple-300",
    name: "Smt. Anuradha Singhal, IAS",
    designation: "Principal Secretary, Urban Development",
    email: "secretary.up@nirikshan.gov.in",
    jurisdiction: "Uttar Pradesh (All Districts)",
    password: "admin123"
  },
  {
    level: "District Level (DM Lucknow)",
    icon: "⚖️",
    badge: "District Magistrate",
    badgeColor: "from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-300",
    name: "Vikramaditya Rao, IAS",
    designation: "District Magistrate & Special Officer",
    email: "dm.lucknow@nirikshan.gov.in",
    jurisdiction: "Lucknow District",
    password: "admin123"
  },
  {
    level: "District Level (MC Kanpur)",
    icon: "📐",
    badge: "Municipal Commissioner",
    badgeColor: "from-cyan-500/20 to-teal-500/20 border-cyan-500/40 text-cyan-300",
    name: "Alok Kumar Saxena, IAS",
    designation: "Municipal Commissioner & CEO Smart City",
    email: "commissioner.kanpur@nirikshan.gov.in",
    jurisdiction: "Kanpur Nagar District",
    password: "admin123"
  },
  {
    level: "Zonal Level (Zone 3 Lucknow)",
    icon: "⚡",
    badge: "Zonal Executive",
    badgeColor: "from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300",
    name: "Er. Devendra Nath Shukla",
    designation: "Zonal Executive Officer (Zone-3)",
    email: "zonal.officer.zone3@nirikshan.gov.in",
    jurisdiction: "Zone 3 Central (Hazratganj)",
    password: "admin123"
  },
  {
    level: "Ward Level (Ward 88 Kanpur)",
    icon: "📍",
    badge: "Ward Engineer",
    badgeColor: "from-rose-500/20 to-orange-500/20 border-rose-500/40 text-rose-300",
    name: "Er. Manoj Bajpai",
    designation: "Ward Junior Engineer (Civil & Sanitation)",
    email: "ward88.engineer@nirikshan.gov.in",
    jurisdiction: "Ward 88 (Naubasta East)",
    password: "admin123"
  },
  {
    level: "Ward Level (Ward 12 Lucknow)",
    icon: "📍",
    badge: "Ward Engineer",
    badgeColor: "from-rose-500/20 to-pink-500/20 border-pink-500/40 text-pink-300",
    name: "Er. Shashi Bhushan",
    designation: "Ward Junior Engineer (Roads & Drainage)",
    email: "ward12.engineer@nirikshan.gov.in",
    jurisdiction: "Ward 12 (Hazratganj Central)",
    password: "admin123"
  }
];

export default function OfficerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ward88.engineer@nirikshan.gov.in");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("ward88.engineer@nirikshan.gov.in");

  const handleLogin = async (overrideEmail, overridePass) => {
    setError("");
    setLoading(true);

    const targetEmail = overrideEmail || email;
    const targetPass = overridePass || password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          password: targetPass,
          role: "officer"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Please verify credentials.");
      }

      // Store in localStorage for client components
      localStorage.setItem("nirikshan_officer_token", data.token);
      localStorage.setItem("nirikshan_officer_profile", JSON.stringify(data.officer));

      router.push("/officer/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.email);
    setEmail(preset.email);
    setPassword(preset.password);
    handleLogin(preset.email, preset.password);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-950 text-slate-100 font-sans relative selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.06),transparent_50%)] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40"></div>

      {/* Official Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-3.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold text-lg border border-amber-400/30">
            🏛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs tracking-widest uppercase font-semibold text-amber-400">Government of India & Municipal Directorate</span>
              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded font-mono">GOVT-SECURE</span>
            </div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">Nirikshan Administrative Command & Grievance Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            NIC Gateway Active
          </span>
          <Link href="/" className="hover:text-amber-400 transition-colors flex items-center gap-1 text-[11px] bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded">
            ← Return to Public Citizen Site
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 lg:py-5 z-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): 1-Click Fast-Switch Hierarchy Selector */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
                <span>⚡ Fast-Switch Hierarchy Testing</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Administrative Command Login
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any pre-configured official account below to log in directly into that tier’s designated jurisdiction, maps, and administrative powers.
              </p>
            </div>

            {/* Symmetrical 7-Account Grid (1 Apex Full-Width + 3 Rows of 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 1. National Level (MoHUA) - Spans both columns as Apex Header */}
              <button
                type="button"
                onClick={() => handleSelectPreset(SAMPLE_OFFICERS[0])}
                className={`sm:col-span-2 text-left p-2.5 sm:p-3 rounded-xl border transition-all duration-200 group relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  selectedPreset === SAMPLE_OFFICERS[0].email
                    ? "bg-slate-900/95 border-amber-400/90 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
                    {SAMPLE_OFFICERS[0].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {SAMPLE_OFFICERS[0].level}
                      </span>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border bg-gradient-to-r ${SAMPLE_OFFICERS[0].badgeColor}`}>
                        {SAMPLE_OFFICERS[0].badge}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                      {SAMPLE_OFFICERS[0].name}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {SAMPLE_OFFICERS[0].designation}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-800/80 pt-1.5 sm:pt-0 shrink-0">
                  <span className="text-cyan-400 font-mono text-[10px]">
                    📍 {SAMPLE_OFFICERS[0].jurisdiction}
                  </span>
                  <span className="text-amber-400 font-semibold text-[11px] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Instant Login →
                  </span>
                </div>
              </button>

              {/* Remaining 6 Presets in 2-Column Pairs */}
              {SAMPLE_OFFICERS.slice(1).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-2.5 rounded-xl border transition-all duration-200 relative group flex flex-col justify-between gap-1.5 ${
                    selectedPreset === preset.email
                      ? "bg-slate-900/95 border-amber-400/90 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400 flex items-center gap-1 truncate">
                        <span>{preset.icon}</span>
                        <span className="truncate">{preset.level}</span>
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border shrink-0 bg-gradient-to-r ${preset.badgeColor}`}>
                        {preset.badge}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                      {preset.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1">
                      {preset.designation}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-cyan-400 font-mono truncate max-w-[130px]">
                      📍 {preset.jurisdiction}
                    </span>
                    <span className="text-amber-400 font-medium group-hover:translate-x-0.5 transition-transform shrink-0 ml-1">
                      Login →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Hierarchy Scoping Note */}
            <div className="p-2.5 bg-slate-900/50 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
              <span className="text-amber-400 text-xs shrink-0">ℹ️</span>
              <span className="leading-snug">
                <strong className="text-slate-200">Administrative Scoping:</strong> Higher tiers supervise broader jurisdictions (National: Pan-India; State: UP; District: Lucknow/Kanpur); Ward Engineers manage frontline grievances and raise financial requisitions.
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Secure Credentials Form */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div className="w-full bg-slate-900/85 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              {/* Top decorative gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500"></div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                  🛡️
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Official Credentials Sign In</h3>
                  <p className="text-[11px] text-slate-400">Restricted Government Personnel Access</p>
                </div>
              </div>

              {/* Active preset indicator */}
              <div className="mb-3.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Selected Profile:</span>
                <span className="font-semibold text-amber-300 font-mono text-[11px] truncate max-w-[200px]">
                  {SAMPLE_OFFICERS.find(p => p.email === selectedPreset)?.badge || "Custom Officer"}
                </span>
              </div>

              {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Official Email or Officer ID
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="officer.name@nirikshan.gov.in"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Password / Security PIN
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Demo: admin123</span>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Verifying Security Clearance...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Command Console</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-4 pt-3.5 border-t border-slate-800/80 text-[10px] text-slate-500 space-y-0.5 text-center">
                <p className="flex items-center justify-center gap-1">
                  <span>🔒</span>
                  <span>256-Bit Encrypted Inter-Departmental Link</span>
                </p>
                <p className="text-[9px] text-slate-600">Access logs and IP addresses are audited for integrity.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Official Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          <span>Nirikshan National Municipal Ledger System</span>
          <span className="hidden sm:inline">•</span>
          <span>Directorate of Urban Local Bodies</span>
        </div>
        <div>
          <span>Integrated with UP State Data Center & MoHUA Smart City Mission</span>
        </div>
      </footer>
    </div>
  );
}
