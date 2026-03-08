"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { Button } from "@/components/ui/Button";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/PageTransition";
import CreateElderlyForm from "@/components/CreateElderlyForm";

interface ElderlyProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  phone: string;
  phoneVerified: boolean;
  language: string;
  caregivers: { id: string }[];
  _count: { reminders: number };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [managedProfiles, setManagedProfiles] = useState<ElderlyProfile[]>([]);
  const [caregivingProfiles, setCaregivingProfiles] = useState<
    ElderlyProfile[]
  >([]);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  const hasNoProfiles =
    managedProfiles.length === 0 && caregivingProfiles.length === 0;

  return (
    <PageTransition>
      <TopBar title="Dashboard">
        {!showForm && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            + Add Profile
          </Button>
        )}
      </TopBar>

      <div className="px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {getGreeting()}, {user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there"}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage elderly profiles and their care
          </p>
        </div>

        {/* Create form */}
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : hasNoProfiles ? (
          /* Empty state */
          <div className="rounded-2xl border-2 border-dashed border-[var(--border-default)] py-16 text-center">
            <svg
              className="mx-auto h-16 w-16 text-[var(--text-tertiary)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={0.75}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
              No elderly profiles yet
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Get started by adding your first elderly profile to begin
              managing their care.
            </p>
            {!showForm && (
              <Button
                variant="primary"
                className="mt-6"
                onClick={() => setShowForm(true)}
              >
                + Add Profile
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Managed profiles */}
            {managedProfiles.length > 0 && (
              <section>
                <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                  My Profiles
                </h3>
                <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {managedProfiles.map((profile) => (
                    <StaggerItem key={profile.id}>
                      <ProfileCard
                        id={profile.id}
                        name={profile.name}
                        avatarUrl={profile.avatarUrl}
                        phone={profile.phone}
                        phoneVerified={profile.phoneVerified}
                        language={profile.language}
                        caregiverCount={profile.caregivers.length}
                        reminderCount={profile._count.reminders}
                      />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </section>
            )}

            {/* Caregiving profiles */}
            {caregivingProfiles.length > 0 && (
              <section>
                <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                  Caregiving For
                </h3>
                <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {caregivingProfiles.map((profile) => (
                    <StaggerItem key={profile.id}>
                      <ProfileCard
                        id={profile.id}
                        name={profile.name}
                        avatarUrl={profile.avatarUrl}
                        phone={profile.phone}
                        phoneVerified={profile.phoneVerified}
                        language={profile.language}
                        caregiverCount={profile.caregivers.length}
                        reminderCount={profile._count.reminders}
                      />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </section>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
