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
          <div>
            <p className="text-sm font-medium text-gray-900">{cg.name}</p>
            {cg.email && <p className="text-xs text-gray-400">{cg.email}</p>}
            <p className="text-sm text-gray-500">{cg.phone}</p>
          </div>
          <div className="flex items-center gap-2">
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
