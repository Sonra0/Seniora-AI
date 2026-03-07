"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
}

interface MedicationListProps {
  elderlyProfileId: string;
  refreshKey?: number;
}

export default function MedicationList({
  elderlyProfileId,
  refreshKey,
}: MedicationListProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    dosage: "",
    instructions: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchMedications = useCallback(async () => {
    try {
      setError("");
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/medications`
      );
      if (!res.ok) throw new Error("Failed to load medications");
      const data = await res.json();
      setMedications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [elderlyProfileId]);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications, refreshKey]);

  const handleDelete = async (medId: string) => {
    setDeletingId(medId);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/medications/${medId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete medication");
      setMedications((prev) => prev.filter((m) => m.id !== medId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (med: Medication) => {
    setEditingId(med.id);
    setEditForm({
      name: med.name,
      dosage: med.dosage || "",
      instructions: med.instructions || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", dosage: "", instructions: "" });
  };

  const handleSave = async (medId: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/medications/${medId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );
      if (!res.ok) throw new Error("Failed to update medication");
      const updated = await res.json();
      setMedications((prev) =>
        prev.map((m) => (m.id === medId ? updated : m))
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
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

  if (medications.length === 0) {
    return <p className="text-sm text-gray-500">No medications added yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {medications.map((med) => (
        <li
          key={med.id}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          {editingId === med.id ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Medication name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={editForm.dosage}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, dosage: e.target.value }))
                }
                placeholder="Dosage (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <textarea
                value={editForm.instructions}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    instructions: e.target.value,
                  }))
                }
                placeholder="Instructions (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(med.id)}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{med.name}</p>
                {med.dosage && (
                  <p className="text-sm text-gray-500">
                    Dosage: {med.dosage}
                  </p>
                )}
                {med.instructions && (
                  <p className="text-sm text-gray-500 mt-1">
                    {med.instructions}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(med)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(med.id)}
                  disabled={deletingId === med.id}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === med.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
