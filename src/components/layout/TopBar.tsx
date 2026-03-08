"use client";

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
      {title && <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>}
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
