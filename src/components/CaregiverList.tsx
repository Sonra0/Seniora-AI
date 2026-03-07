"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import PhoneVerification from "@/components/PhoneVerification";

interface Caregiver {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  phoneVerified: boolean;
  avatarUrl: string | null;
}

interface CaregiverListProps {
  elderlyProfileId: string;
  refreshKey?: number;
}

export default function CaregiverList({
  elderlyProfileId,
  refreshKey,
}: CaregiverListProps) {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const fetchCaregivers = useCallback(async () => {
    try {
      setError("");
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/caregivers`
      );
      if (!res.ok) throw new Error("Failed to load caregivers");
      const data = await res.json();
      setCaregivers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [elderlyProfileId]);

  useEffect(() => {
    fetchCaregivers();
  }, [fetchCaregivers, refreshKey]);

  const handleSavePhone = async (caregiverId: string) => {
    if (!phoneInput.trim()) return;
    setSavingPhone(true);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/caregivers/${caregiverId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneInput.trim() }),
        }
      );
      if (!res.ok) throw new Error("Failed to update phone");
      setCaregivers((prev) =>
        prev.map((cg) =>
          cg.id === caregiverId
            ? { ...cg, phone: phoneInput.trim(), phoneVerified: false }
            : cg
        )
      );
      setEditingPhoneId(null);
      setPhoneInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update phone");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleDelete = async (caregiverId: string) => {
    setDeletingId(caregiverId);
    try {
      const res = await apiFetch(
        `/api/elderly/${elderlyProfileId}/caregivers/${caregiverId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete caregiver");
      setCaregivers((prev) => prev.filter((cg) => cg.id !== caregiverId));
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

  if (caregivers.length === 0) {
    return <p className="text-sm text-gray-500">No caregivers added yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {caregivers.map((cg) => (
        <li key={cg.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {cg.avatarUrl ? (
              <img
                src={cg.avatarUrl}
                alt={cg.name}
                className="h-9 w-9 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 font-medium text-sm">
                {cg.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{cg.name}</p>
              {cg.email && <p className="text-xs text-gray-400">{cg.email}</p>}
              {cg.phone ? (
                <p className="text-sm text-gray-500">{cg.phone}</p>
              ) : editingPhoneId === cg.id ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+1234567890"
                    className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    onClick={() => handleSavePhone(cg.id)}
                    disabled={savingPhone || !phoneInput.trim()}
                    className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {savingPhone ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPhoneId(null);
                      setPhoneInput("");
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingPhoneId(cg.id);
                    setPhoneInput("");
                  }}
                  className="mt-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  + Add phone number
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cg.phone ? (
              <PhoneVerification
                phone={cg.phone}
                verified={cg.phoneVerified}
                type="caregiver"
                entityId={cg.id}
                onVerified={() =>
                  setCaregivers((prev) =>
                    prev.map((c) =>
                      c.id === cg.id ? { ...c, phoneVerified: true } : c
                    )
                  )
                }
              />
            ) : null}
            <button
              onClick={() => handleDelete(cg.id)}
              disabled={deletingId === cg.id}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deletingId === cg.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
