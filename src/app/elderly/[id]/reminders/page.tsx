"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import MedicationList from "@/components/MedicationList";
import AddMedicationForm from "@/components/AddMedicationForm";
import ReminderList from "@/components/ReminderList";
import AddReminderForm from "@/components/AddReminderForm";

interface ElderlyProfile {
  id: string;
  name: string;
}

export default function RemindersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [medicationRefreshKey, setMedicationRefreshKey] = useState(0);
  const [reminderRefreshKey, setReminderRefreshKey] = useState(0);

  const refreshMedications = useCallback(() => {
    setMedicationRefreshKey((k) => k + 1);
  }, []);

  const refreshReminders = useCallback(() => {
    setReminderRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && id) {
      apiFetch(`/api/elderly/${id}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load profile");
          return res.json();
        })
        .then((data) => setProfile({ id: data.id, name: data.name }))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router, id]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-red-600">{error || "Profile not found"}</p>
        <Link
          href="/dashboard"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href={`/elderly/${id}`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          Medications &amp; Reminders
        </h1>
        <span className="text-sm text-gray-500">for {profile.name}</span>
      </div>
        {/* Medications Section */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Medications
          </h2>
          <MedicationList
            elderlyProfileId={profile.id}
            refreshKey={medicationRefreshKey}
          />
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Add a medication
            </h3>
            <AddMedicationForm
              elderlyProfileId={profile.id}
              onSuccess={refreshMedications}
            />
          </div>
        </section>

        {/* Reminders Section */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reminders
          </h2>
          <ReminderList
            elderlyProfileId={profile.id}
            refreshKey={reminderRefreshKey}
          />
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Add a reminder
            </h3>
            <AddReminderForm
              elderlyProfileId={profile.id}
              onSuccess={refreshReminders}
            />
          </div>
        </section>
    </div>
  );
}
