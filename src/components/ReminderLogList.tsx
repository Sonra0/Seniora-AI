"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ReminderLog {
  id: string;
  status: string;
  attemptNumber: number;
  calledAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  reminder: {
    title: string;
  };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-green-100 text-green-700",
  },
  CALLING: {
    label: "Calling",
    className: "bg-amber-100 text-amber-700",
  },
  PENDING: {
    label: "Pending",
    className: "bg-gray-100 text-gray-600",
  },
  NO_ANSWER: {
    label: "No Answer",
    className: "bg-orange-100 text-orange-700",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
};

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ReminderLogList({
  elderlyProfileId,
}: {
  elderlyProfileId: string;
}) {
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/elderly/${elderlyProfileId}/logs`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load logs");
        return res.json();
      })
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [elderlyProfileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">{error}</p>;
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">No call logs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Date / Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Reminder
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Attempt
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => {
            const config = statusConfig[log.status] ?? {
              label: log.status,
              className: "bg-gray-100 text-gray-600",
            };
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                  {formatDateTime(log.calledAt || log.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {log.reminder.title}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {log.attemptNumber} / 3
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
                  >
                    {config.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
