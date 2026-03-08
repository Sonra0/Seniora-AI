interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", hover = false, padding = "md" }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };

  return (
    <div
      className={`rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] theme-transition ${
        hover ? "hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer" : ""
      } ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
