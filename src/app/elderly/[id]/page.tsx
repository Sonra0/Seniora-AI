"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
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
  avatarUrl: string | null;
  phone: string;
  phoneVerified: boolean;
  language: string;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  emergencyPhoneVerified: boolean;
  createdAt: string;
  caregivers: Caregiver[];
  medications: Medication[];
  reminders: Reminder[];
  role: "manager" | "caregiver";
}

export default function ElderlyDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [caregiverRefreshKey, setCaregiverRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const refreshCaregivers = useCallback(() => {
    setCaregiverRefreshKey((k) => k + 1);
  }, []);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete ${profile?.name}'s profile? This will remove all their medications, reminders, and caregivers. This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/elderly/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete profile");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await apiFetch(`/api/elderly/${id}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const { avatarUrl } = await res.json();
      setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
        .then(setProfile)
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

  const languageLabel = profile.language === "ar" ? "Arabic" : "English";
  const allVerified = profile.phoneVerified && profile.emergencyPhoneVerified;

  return (
    <div className="space-y-8">
      {!allVerified && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Action required:</strong> Please verify both the elderly phone and emergency contact phone before managing medications, reminders, or caregivers.
        </div>
      )}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          &larr; Back
        </Link>
        <label className="relative cursor-pointer group shrink-0">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              className="h-12 w-12 rounded-full object-cover border-2 border-gray-200 group-hover:border-indigo-400 transition-colors"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg border-2 border-transparent group-hover:border-indigo-400 transition-colors">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          {uploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="sr-only"
          />
        </label>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{profile.name}</h1>
        {profile.role === "caregiver" && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Caregiver
          </span>
        )}
        {profile.role === "manager" && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete Profile"}
          </button>
        )}
      </div>
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
            {profile.emergencyContact && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Emergency Contact</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {profile.emergencyContact}
                </dd>
              </div>
            )}
            {profile.emergencyPhone && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Emergency Phone</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                  {profile.emergencyPhone}
                  <PhoneVerification
                    phone={profile.emergencyPhone}
                    verified={profile.emergencyPhoneVerified}
                    type="emergency"
                    entityId={profile.id}
                    onVerified={() =>
                      setProfile((prev) =>
                        prev ? { ...prev, emergencyPhoneVerified: true } : prev
                      )
                    }
                  />
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Caregivers */}
        <section className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${!allVerified ? "opacity-50 pointer-events-none" : ""}`}>
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
        <section className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${!allVerified ? "opacity-50 pointer-events-none" : ""}`}>
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
                className={`rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors ${allVerified ? "hover:bg-indigo-700" : "pointer-events-none opacity-50"}`}
                aria-disabled={!allVerified}
                tabIndex={!allVerified ? -1 : undefined}
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
        <section className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${!allVerified ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Reminders</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {profile.reminders.length} total
              </span>
              <Link
                href={`/elderly/${id}/logs`}
                className={`rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors ${allVerified ? "hover:bg-indigo-50" : "pointer-events-none opacity-50"}`}
                aria-disabled={!allVerified}
                tabIndex={!allVerified ? -1 : undefined}
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
    </div>
  );
}
