"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface Medication {
  id: string;
  name: string;
}

interface AddReminderFormProps {
  elderlyProfileId: string;
  onSuccess: () => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AddReminderForm({
  elderlyProfileId,
  onSuccess,
}: AddReminderFormProps) {
  const [type, setType] = useState<"MEDICATION" | "CUSTOM">("CUSTOM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<"DAILY" | "SPECIFIC_DAYS">(
    "DAILY"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(false);

  useEffect(() => {
    if (type === "MEDICATION") {
      setLoadingMeds(true);
      apiFetch(`/api/elderly/${elderlyProfileId}/medications`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load medications");
          return res.json();
        })
        .then((data) => setMedications(data))
        .catch(() => setMedications([]))
        .finally(() => setLoadingMeds(false));
    }
  }, [type, elderlyProfileId]);

  const handleMedicationSelect = (medId: string) => {
    setMedicationId(medId);
    const med = medications.find((m) => m.id === medId);
    if (med) setTitle(med.name);
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/elderly/${elderlyProfileId}/reminders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            title,
            description: description || null,
            medicationId: type === "MEDICATION" ? medicationId || null : null,
            scheduledTime,
            recurrence,
            daysOfWeek: recurrence === "SPECIFIC_DAYS" ? daysOfWeek : [],
            leadTimeMinutes,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reminder");
      }

      // Reset form
      setType("CUSTOM");
      setTitle("");
      setDescription("");
      setMedicationId("");
      setScheduledTime("09:00");
      setRecurrence("DAILY");
      setDaysOfWeek([]);
      setLeadTimeMinutes(0);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="reminderType"
              value="CUSTOM"
              checked={type === "CUSTOM"}
              onChange={() => {
                setType("CUSTOM");
                setMedicationId("");
                setTitle("");
              }}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Custom
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="reminderType"
              value="MEDICATION"
              checked={type === "MEDICATION"}
              onChange={() => {
                setType("MEDICATION");
                setTitle("");
              }}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Medication
          </label>
        </div>
      </div>

      {/* Medication selector or title input */}
      {type === "MEDICATION" ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Medication
          </label>
          {loadingMeds ? (
            <p className="text-sm text-gray-400">Loading medications...</p>
          ) : medications.length === 0 ? (
            <p className="text-sm text-gray-400">
              No medications found. Add one above first.
            </p>
          ) : (
            <select
              value={medicationId}
              onChange={(e) => handleMedicationSelect(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select a medication</option>
              {medications.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Title
          </label>
          <input
            type="text"
            placeholder="Reminder title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Description (optional)
        </label>
        <textarea
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Time and lead time */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Scheduled Time
          </label>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Lead Time (minutes)
          </label>
          <input
            type="number"
            min={0}
            value={leadTimeMinutes}
            onChange={(e) => setLeadTimeMinutes(parseInt(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Recurrence */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Recurrence
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="recurrence"
              value="DAILY"
              checked={recurrence === "DAILY"}
              onChange={() => setRecurrence("DAILY")}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Daily
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="recurrence"
              value="SPECIFIC_DAYS"
              checked={recurrence === "SPECIFIC_DAYS"}
              onChange={() => setRecurrence("SPECIFIC_DAYS")}
              className="text-indigo-600 focus:ring-indigo-500"
            />
            Specific Days
          </label>
        </div>
      </div>

      {/* Day checkboxes */}
      {recurrence === "SPECIFIC_DAYS" && (
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, index) => (
            <label
              key={index}
              className={`flex items-center justify-center w-10 h-10 rounded-full border text-xs font-medium cursor-pointer transition-colors ${
                daysOfWeek.includes(index)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={daysOfWeek.includes(index)}
                onChange={() => toggleDay(index)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add Reminder"}
      </button>
    </form>
  );
}
