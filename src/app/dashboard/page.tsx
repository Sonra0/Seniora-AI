"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import ElderlyProfileCard from "@/components/ElderlyProfileCard";
import CreateElderlyForm from "@/components/CreateElderlyForm";

interface ElderlyProfile {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  language: string;
  caregivers: { id: string }[];
  _count: { reminders: number };
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [managedProfiles, setManagedProfiles] = useState<ElderlyProfile[]>([]);
  const [caregivingProfiles, setCaregivingProfiles] = useState<ElderlyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await apiFetch("/api/elderly");
      if (res.ok) {
        const data = await res.json();
        setManagedProfiles(data.managed);
        setCaregivingProfiles(data.caregiving);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchProfiles();
    }
  }, [user, authLoading, router, fetchProfiles]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const hasNoProfiles = managedProfiles.length === 0 && caregivingProfiles.length === 0;

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage elderly profiles and their care
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              + Add Profile
            </button>
          )}
        </div>

        {showForm && (
          <div className="mb-8 max-w-md">
            <CreateElderlyForm
              onSuccess={() => {
                setShowForm(false);
                fetchProfiles();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : hasNoProfiles ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No elderly profiles yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first elderly profile.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                + Add Profile
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Managed profiles */}
            {managedProfiles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">My Profiles</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {managedProfiles.map((profile) => (
                    <ElderlyProfileCard
                      key={profile.id}
                      id={profile.id}
                      name={profile.name}
                      phone={profile.phone}
                      phoneVerified={profile.phoneVerified}
                      caregiverCount={profile.caregivers.length}
                      reminderCount={profile._count.reminders}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Caregiving profiles */}
            {caregivingProfiles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Caregiving For</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {caregivingProfiles.map((profile) => (
                    <ElderlyProfileCard
                      key={profile.id}
                      id={profile.id}
                      name={profile.name}
                      phone={profile.phone}
                      phoneVerified={profile.phoneVerified}
                      caregiverCount={profile.caregivers.length}
                      reminderCount={profile._count.reminders}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </>
  );
}
