"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Medication {
  id: string;
  name: string;
}

interface Reminder {
  id: string;
  type: "MEDICATION" | "CUSTOM";
  title: string;
  description: string | null;
  medicationId: string | null;
  medication: Medication | null;
  scheduledTime: string;
  scheduledDate: string | null;
  recurrence: string;
  daysOfWeek: number[];
  leadTimeMinutes: number;
  active: boolean;
}

interface ReminderListProps {
  elderlyProfileId: string;
  refreshKey?: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const RECURRENCE_LABELS: Record<string, string> = {
  NONE: "One-time",
  EVERY_1_HOUR: "Every 1 hour",
  EVERY_4_HOURS: "Every 4 hours",
  EVERY_6_HOURS: "Every 6 hours",
  EVERY_8_HOURS: "Every 8 hours",
  EVERY_12_HOURS: "Every 12 hours",
  DAILY: "Daily",
  EVERY_OTHER_DAY: "Every other day",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  SPECIFIC_DAYS: "Specific days",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${ampm}`;
}

export default function ReminderList({
  elderlyProfileId,
  refreshKey,
}: ReminderListProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    try {
      setError("");
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/reminders`
      );
      if (!res.ok) throw new Error("Failed to load reminders");
      const data = await res.json();
      setReminders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [elderlyProfileId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders, refreshKey]);

  const handleToggle = async (reminder: Reminder) => {
    setTogglingId(reminder.id);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/reminders/${reminder.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !reminder.active }),
        }
      );
      if (!res.ok) throw new Error("Failed to update reminder");
      const updated = await res.json();
      setReminders((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (reminderId: string) => {
    setDeletingId(reminderId);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/reminders/${reminderId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete reminder");
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (reminders.length === 0) {
    return <p className="text-sm text-gray-500">No reminders set up yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {reminders.map((reminder) => (
        <li
          key={reminder.id}
          className={`rounded-lg border p-4 ${
            reminder.active
              ? "border-gray-200 bg-gray-50"
              : "border-gray-100 bg-gray-100 opacity-60"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900">
                  {reminder.title}
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    reminder.type === "MEDICATION"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {reminder.type === "MEDICATION" ? "Medication" : "Custom"}
                </span>
              </div>

              <p className="text-sm text-gray-700">
                {reminder.scheduledDate && (
                  <span className="mr-1">{reminder.scheduledDate} &middot;</span>
                )}
                {formatTime(reminder.scheduledTime)}
              </p>

              <p className="text-xs text-gray-500 mt-0.5">
                {reminder.recurrence === "SPECIFIC_DAYS"
                  ? reminder.daysOfWeek
                      .sort((a, b) => a - b)
                      .map((d) => DAY_LABELS[d])
                      .join(", ")
                  : RECURRENCE_LABELS[reminder.recurrence] || reminder.recurrence}
              </p>

              {reminder.leadTimeMinutes > 0 && (
                <p className="text-xs text-gray-500">
                  {reminder.leadTimeMinutes} min before
                </p>
              )}

              {reminder.medication && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Linked: {reminder.medication.name}
                </p>
              )}

              {reminder.description && (
                <p className="text-xs text-gray-500 mt-1">
                  {reminder.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleToggle(reminder)}
                disabled={togglingId === reminder.id}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  reminder.active ? "bg-indigo-600" : "bg-gray-300"
                }`}
                role="switch"
                aria-checked={reminder.active}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    reminder.active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <button
                onClick={() => handleDelete(reminder.id)}
                disabled={deletingId === reminder.id}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deletingId === reminder.id ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
