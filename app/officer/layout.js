export const metadata = {
  title: "Nirikshan - Government & Officer Command Console",
  description: "Official Administrative Portal for Civic Grievance Redressal, Inter-Departmental Governance, and Infrastructure Oversight.",
};

export default function OfficerLayout({ children }) {
  return (
    <div className="officer-portal-root min-h-screen w-full flex flex-col bg-slate-950 text-slate-100">
      {children}
    </div>
  );
}
