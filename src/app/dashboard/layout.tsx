import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <Sidebar />
      <main className="md:ml-60 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
