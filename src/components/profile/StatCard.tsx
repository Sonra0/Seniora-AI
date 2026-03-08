interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--card-bg)] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)] shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  );
}
