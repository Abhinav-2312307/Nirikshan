"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sun, Moon, Shield, Building2, Landmark, Lock, ArrowRight, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

const SAMPLE_OFFICERS = [
  {
    level: "National Level (MoHUA)",
    icon: "🏛️",
    badge: "Apex Command",
    badgeColor: "rgba(245, 158, 11, 0.15)",
    badgeBorder: "rgba(245, 158, 11, 0.4)",
    badgeText: "#fbbf24",
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
    badgeColor: "rgba(168, 85, 247, 0.15)",
    badgeBorder: "rgba(168, 85, 247, 0.4)",
    badgeText: "#c084fc",
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
    badgeColor: "rgba(59, 130, 246, 0.15)",
    badgeBorder: "rgba(59, 130, 246, 0.4)",
    badgeText: "#60a5fa",
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
    badgeColor: "rgba(6, 182, 212, 0.15)",
    badgeBorder: "rgba(6, 182, 212, 0.4)",
    badgeText: "#22d3ee",
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
    badgeColor: "rgba(16, 185, 129, 0.15)",
    badgeBorder: "rgba(16, 185, 129, 0.4)",
    badgeText: "#34d399",
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
    badgeColor: "rgba(244, 63, 94, 0.15)",
    badgeBorder: "rgba(244, 63, 94, 0.4)",
    badgeText: "#fb7185",
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
    badgeColor: "rgba(236, 72, 153, 0.15)",
    badgeBorder: "rgba(236, 72, 153, 0.4)",
    badgeText: "#f472b6",
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
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("nirikshan_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nirikshan_theme", next);
  };

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
    <div className="min-h-screen w-full flex flex-col justify-between relative" style={{ color: "var(--text-primary)" }}>
      {/* Official Top Navbar */}
      <header className="navbar" style={{ padding: "0 24px" }}>
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(var(--accent-1-rgb), 0.3)"
            }}
          >
            🏛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-1)" }}>
                Government of India & Municipal Directorate
              </span>
              <span className="officer-badge-pill">
                NIC-SECURE
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
              Nirikshan Administrative Command Console
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "var(--green-bg)", border: "1px solid var(--green-border)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)" }}></span>
            <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>NIC Gateway Active</span>
          </div>

          <button 
            onClick={toggleTheme}
            className="theme-toggle"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link 
            href="/" 
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
            style={{
              background: "var(--glass-inner-bg)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-secondary)"
            }}
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Citizen Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-8 z-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): 1-Click Fast-Switch Hierarchy Selector */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2" style={{ background: "rgba(var(--accent-1-rgb), 0.12)", border: "1px solid rgba(var(--accent-1-rgb), 0.3)", color: "var(--accent-1)" }}>
                <span>⚡ 1-Click Hierarchy Fast-Switch</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                Administrative Command Access
              </h2>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Select any administrative profile below to instantly simulate that tier’s jurisdiction, live maps, fund requisitions, and governance powers.
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {/* 1. National Level - Full Width */}
              <button
                type="button"
                onClick={() => handleSelectPreset(SAMPLE_OFFICERS[0])}
                className="sm:col-span-2 text-left p-3.5 rounded-2xl border transition-all duration-200 group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                style={{
                  background: selectedPreset === SAMPLE_OFFICERS[0].email ? "var(--glass-bg-strong)" : "var(--glass-bg)",
                  backdropFilter: "var(--glass-blur)",
                  WebkitBackdropFilter: "var(--glass-blur)",
                  borderColor: selectedPreset === SAMPLE_OFFICERS[0].email ? "var(--accent-1)" : "var(--glass-border)",
                  boxShadow: selectedPreset === SAMPLE_OFFICERS[0].email ? "0 8px 32px rgba(var(--accent-1-rgb), 0.25)" : "var(--glass-shadow)"
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)" }}
                  >
                    {SAMPLE_OFFICERS[0].icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-1)" }}>
                        {SAMPLE_OFFICERS[0].level}
                      </span>
                      <span 
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{
                          background: SAMPLE_OFFICERS[0].badgeColor,
                          borderColor: SAMPLE_OFFICERS[0].badgeBorder,
                          color: SAMPLE_OFFICERS[0].badgeText
                        }}
                      >
                        {SAMPLE_OFFICERS[0].badge}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold transition-colors" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                      {SAMPLE_OFFICERS[0].name}
                    </h4>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {SAMPLE_OFFICERS[0].designation}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
                  <span className="font-mono text-xs font-semibold" style={{ color: "var(--accent-1)" }}>
                    📍 {SAMPLE_OFFICERS[0].jurisdiction}
                  </span>
                  <span className="text-xs font-bold mt-1 group-hover:translate-x-1 transition-transform flex items-center gap-1" style={{ color: "var(--accent-1)" }}>
                    Instant Login →
                  </span>
                </div>
              </button>

              {/* Remaining 6 Presets */}
              {SAMPLE_OFFICERS.slice(1).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="text-left p-3 rounded-2xl border transition-all duration-200 relative group flex flex-col justify-between gap-2 cursor-pointer"
                  style={{
                    background: selectedPreset === preset.email ? "var(--glass-bg-strong)" : "var(--glass-bg)",
                    backdropFilter: "var(--glass-blur)",
                    WebkitBackdropFilter: "var(--glass-blur)",
                    borderColor: selectedPreset === preset.email ? "var(--accent-1)" : "var(--glass-border)",
                    boxShadow: selectedPreset === preset.email ? "0 8px 24px rgba(var(--accent-1-rgb), 0.2)" : "var(--glass-shadow)"
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 truncate" style={{ color: "var(--text-secondary)" }}>
                        <span>{preset.icon}</span>
                        <span className="truncate">{preset.level}</span>
                      </span>
                      <span 
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0"
                        style={{
                          background: preset.badgeColor,
                          borderColor: preset.badgeBorder,
                          color: preset.badgeText
                        }}
                      >
                        {preset.badge}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold transition-colors truncate" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                      {preset.name}
                    </h4>
                    <p className="text-[11px] line-clamp-1" style={{ color: "var(--text-secondary)" }}>
                      {preset.designation}
                    </p>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="font-mono truncate max-w-[130px]" style={{ color: "var(--accent-1)" }}>
                      📍 {preset.jurisdiction}
                    </span>
                    <span className="font-bold group-hover:translate-x-0.5 transition-transform shrink-0 ml-1 text-xs" style={{ color: "var(--accent-1)" }}>
                      Login →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Hierarchy Info Box */}
            <div className="p-3.5 glass-inner rounded-xl text-xs flex items-start gap-2.5 mt-1" style={{ color: "var(--text-secondary)" }}>
              <span className="text-sm shrink-0">🏛️</span>
              <span className="leading-relaxed">
                <strong style={{ color: "var(--text-primary)" }}>Jurisdictional Matrix:</strong> Apex Central Command and State Urban Development oversee regional policy; District Magistrates & Municipal Commissioners manage allocations; Ward Junior Engineers inspect field grievances on site.
              </span>
            </div>
          </div>

          {/* Right Column (5 cols): Secure Credentials Form */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div 
              className="w-full max-w-[440px] rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-3 relative border"
              style={{
                background: "var(--glass-bg-strong)",
                backdropFilter: "var(--glass-blur-heavy)",
                WebkitBackdropFilter: "var(--glass-blur-heavy)",
                borderColor: "var(--glass-border)",
                boxShadow: "var(--glass-shadow-lg)"
              }}
            >
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-title)", color: "var(--text-primary)" }}>
                  Official Sign In
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Enter your assigned NIC administrative credentials to continue.
                </p>
              </div>

              {/* Active preset indicator */}
              <div 
                className="px-3 py-2 rounded-xl flex items-center justify-between text-xs"
                style={{
                  background: "rgba(var(--accent-1-rgb), 0.08)",
                  border: "1px solid rgba(var(--accent-1-rgb), 0.25)"
                }}
              >
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Selected Profile:</span>
                <span className="font-semibold font-mono text-[11px] truncate max-w-[200px]" style={{ color: "var(--accent-1)" }}>
                  {SAMPLE_OFFICERS.find(p => p.email === selectedPreset)?.badge || "Custom Officer"}
                </span>
              </div>

              {error && (
                <div 
                  className="p-3 rounded-xl text-xs flex items-center gap-2"
                  style={{
                    background: "var(--red-bg)",
                    border: "1px solid var(--red-border)",
                    color: "var(--red)"
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-3 mt-1">
                <div className="flex flex-col">
                  <label className="font-semibold mb-1 text-xs" style={{ color: "var(--text-secondary)" }}>Official Email or Service ID</label>
                  <div className="relative">
                    <input 
                      type="email" 
                      className="glass-input" 
                      placeholder="officer.name@nirikshan.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Security PIN / Password</label>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Demo: admin123</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="password" 
                      className="glass-input" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" id="remember" className="rounded" style={{ accentColor: "var(--accent-1)" }} />
                    <span>Remember Device</span>
                  </label>
                  <span className="cursor-pointer hover:underline text-[11px]" style={{ color: "var(--accent-1)" }}>
                    Security Clearance Help
                  </span>
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying Clearance...</span>
                    </>
                  ) : (
                    <>
                      <span>Access Command Console</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-2 pt-2 border-t text-[11px] text-center space-y-1" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                <p className="flex items-center justify-center gap-1 font-medium">
                  <Lock size={12} />
                  <span>256-Bit Encrypted Inter-Departmental Link</span>
                </p>
                <p className="text-[10px]">Access events and IP addresses are audited under the National Cybersecurity Policy.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Official Footer */}
      <footer 
        className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs z-10 gap-2 shrink-0 border-t"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          borderColor: "var(--border-primary)",
          color: "var(--text-muted)"
        }}
      >
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Nirikshan National Municipal Ledger</span>
          <span>•</span>
          <span>Directorate of Urban Local Bodies</span>
          <span>•</span>
          <span>Smart Cities Mission</span>
        </div>
        <div>
          <span>Connected via UP State Data Center (UPSDC)</span>
        </div>
      </footer>
    </div>
  );
}
