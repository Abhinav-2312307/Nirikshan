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
            <div className="bg-[#151717]/80 backdrop-blur-xl rounded-[20px] p-[30px] w-full max-w-[450px] shadow-2xl flex flex-col gap-[10px] font-sans relative border border-slate-800">
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Official Sign In</h3>

              {/* Active preset indicator */}
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">Selected Profile:</span>
                <span className="font-semibold text-amber-300 font-mono text-[11px] truncate max-w-[200px]">
                  {SAMPLE_OFFICERS.find(p => p.email === selectedPreset)?.badge || "Custom Officer"}
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[13px]">
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-[10px]">
                <div className="flex flex-col">
                  <label className="text-white font-semibold mb-2 text-[14px]">Official Email or ID</label>
                  <div className="flex items-center border-[1.5px] border-slate-700 rounded-[10px] h-[50px] pl-[10px] transition-all duration-200 focus-within:border-amber-500 bg-transparent">
                    <svg height="20" viewBox="0 0 32 32" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-slate-400 shrink-0">
                      <g id="Layer_3" data-name="Layer 3"><path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path></g>
                    </svg>
                    <input 
                      type="email" 
                      className="ml-[10px] rounded-[10px] border-none w-[85%] h-full bg-transparent focus:outline-none text-white text-[14px] placeholder:text-slate-500" 
                      placeholder="officer.name@nirikshan.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white font-semibold text-[14px]">Security PIN</label>
                    <span className="text-[10px] text-slate-500 font-mono">Demo: admin123</span>
                  </div>
                  <div className="flex items-center border-[1.5px] border-slate-700 rounded-[10px] h-[50px] pl-[10px] pr-4 transition-all duration-200 focus-within:border-amber-500 bg-transparent">
                    <svg height="20" viewBox="-64 0 512 512" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-slate-400 shrink-0"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>        
                    <input 
                      type="password" 
                      className="ml-[10px] rounded-[10px] border-none w-full h-full bg-transparent focus:outline-none text-white text-[14px] placeholder:text-slate-500" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <svg viewBox="0 0 576 512" height="1em" xmlns="http://www.w3.org/2000/svg" className="fill-slate-400 cursor-pointer ml-2 hover:fill-slate-200 transition-colors shrink-0"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"></path></svg>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between mt-2">
                  <div className="flex items-center gap-[10px]">
                    <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-700 bg-transparent text-amber-500 focus:ring-amber-500 cursor-pointer" />
                    <label htmlFor="remember" className="text-[14px] text-slate-300 font-normal cursor-pointer select-none">Remember Me</label>
                  </div>
                  <span className="text-[14px] ml-[5px] text-amber-500 font-medium cursor-pointer hover:text-amber-400 transition-colors">Forgot Security PIN?</span>
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="mt-5 mb-[10px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-[15px] font-bold rounded-[10px] h-[50px] w-full cursor-pointer transition-colors border-none shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying Clearance...</span>
                    </>
                  ) : (
                    "Access Command Console"
                  )}
                </button>
              </form>

              <div className="flex items-center justify-center gap-4 my-2">
                <div className="h-[1px] flex-1 bg-slate-800"></div>
                <p className="text-slate-500 text-[12px] font-medium uppercase tracking-wider text-center">Secure Link</p>
                <div className="h-[1px] flex-1 bg-slate-800"></div>
              </div>

              <div className="mt-1 pt-1 text-[10px] text-slate-500 space-y-0.5 text-center">
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
