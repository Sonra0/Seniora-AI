"use client";

import { Badge } from "@/components/ui/Badge";

interface Session {
  id: string;
  date: string;
  overallScore: number | null;
  severity: "GREEN" | "YELLOW" | "RED" | null;
}

interface HistoryTimelineProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

const severityVariant: Record<string, "success" | "warning" | "danger"> = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "danger",
};

export function HistoryTimeline({
  sessions,
  activeSessionId,
  onSelect,
}: HistoryTimelineProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No assessment history
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2 -mx-2 px-2">
      <div className="flex gap-3 min-w-min">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all shrink-0 ${
                isActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-xs text-gray-500">{session.date}</span>
              <span
                className={`text-lg font-bold ${
                  isActive ? "text-indigo-400" : "text-white"
                }`}
              >
                {session.overallScore !== null
                  ? `${Math.round(session.overallScore)}%`
                  : "—"}
              </span>
              {session.severity && (
                <Badge variant={severityVariant[session.severity]} size="sm">
                  {session.severity}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
