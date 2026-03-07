"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import CaregiverList from "@/components/CaregiverList";
import AddCaregiverForm from "@/components/AddCaregiverForm";
import PhoneVerification from "@/components/PhoneVerification";

interface Caregiver {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
}

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
}

interface Reminder {
  id: string;
  title: string;
  type: string;
  scheduledTime: string;
  active: boolean;
}

interface ElderlyProfile {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  language: string;
  createdAt: string;
  caregivers: Caregiver[];
  medications: Medication[];
  reminders: Reminder[];
}

export default function ElderlyDetailPage() {
  const { user, isLoading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [caregiverRefreshKey, setCaregiverRefreshKey] = useState(0);

  const refreshCaregivers = useCallback(() => {
    setCaregiverRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/api/auth/login");
      return;
    }
    if (user && id) {
      fetch(`/api/elderly/${id}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load profile");
          return res.json();
        })
        .then(setProfile)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router, id]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 gap-4">
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

  const languageLabel = profile.language === "ar" ? "Arabic" : "English";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            &larr; Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Profile Info */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Profile Information
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{profile.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                {profile.phone}
                <PhoneVerification
                  phone={profile.phone}
                  verified={profile.phoneVerified}
                  type="elderly"
                  entityId={profile.id}
                  onVerified={() =>
                    setProfile((prev) =>
                      prev ? { ...prev, phoneVerified: true } : prev
                    )
                  }
                />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Language</dt>
              <dd className="mt-1 text-sm text-gray-900">{languageLabel}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(profile.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>

        {/* Caregivers */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Caregivers
          </h2>
          <CaregiverList
            elderlyProfileId={profile.id}
            refreshKey={caregiverRefreshKey}
          />
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Add a caregiver
            </h3>
            <AddCaregiverForm
              elderlyProfileId={profile.id}
              onSuccess={refreshCaregivers}
            />
          </div>
        </section>

        {/* Medications */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Medications
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {profile.medications.length} total
              </span>
              <Link
                href={`/elderly/${id}/reminders`}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Manage Medications &amp; Reminders
              </Link>
            </div>
          </div>
          {profile.medications.length === 0 ? (
            <p className="text-sm text-gray-500">No medications added yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {profile.medications.map((med) => (
                <li key={med.id} className="py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {med.name}
                  </p>
                  {med.dosage && (
                    <p className="text-sm text-gray-500">
                      Dosage: {med.dosage}
                    </p>
                  )}
                  {med.instructions && (
                    <p className="text-sm text-gray-500">
                      {med.instructions}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reminders */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Reminders</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {profile.reminders.length} total
              </span>
              <Link
                href={`/elderly/${id}/logs`}
                className="rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                View Call History
              </Link>
            </div>
          </div>
          {profile.reminders.length === 0 ? (
            <p className="text-sm text-gray-500">No reminders set up yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {profile.reminders.map((rem) => (
                <li
                  key={rem.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {rem.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {rem.type} &middot; {rem.scheduledTime}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      rem.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {rem.active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
