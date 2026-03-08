interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "accent";
  size?: "sm" | "md";
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", size = "sm", pulse = false, children, className = "" }: BadgeProps) {
  const variants = {
    default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    success: "bg-[var(--success-light)] text-emerald-700",
    warning: "bg-[var(--warning-light)] text-amber-700",
    danger: "bg-[var(--danger-light)] text-red-700",
    accent: "bg-[var(--accent-light)] text-indigo-700",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {pulse && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${variant === "danger" ? "bg-red-400" : variant === "success" ? "bg-emerald-400" : "bg-indigo-400"}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${variant === "danger" ? "bg-red-500" : variant === "success" ? "bg-emerald-500" : "bg-indigo-500"}`} />
        </span>
      )}
      {children}
    </span>
  );
}
