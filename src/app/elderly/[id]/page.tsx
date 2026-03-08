"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TabNav } from "@/components/profile/TabNav";
import { StatCard } from "@/components/profile/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";
import CaregiverList from "@/components/CaregiverList";
import AddCaregiverForm from "@/components/AddCaregiverForm";
import PhoneVerification from "@/components/PhoneVerification";
import VoiceSelector from "@/components/VoiceSelector";

interface Caregiver {
  id: string;
  name: string;
  phone: string;
  phoneVerified: boolean;
  telegramChatId?: string | null;
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
  voiceId: string | null;
  customVoiceName: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  emergencyPhoneVerified: boolean;
  timezone: string;
  createdAt: string;
  caregivers: Caregiver[];
  medications: Medication[];
  reminders: Reminder[];
  role: "manager" | "caregiver";
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "medications", label: "Medications" },
  { id: "reminders", label: "Reminders" },
  { id: "assessment", label: "Assessment" },
  { id: "calls", label: "Call Logs" },
];

export default function ElderlyDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<ElderlyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [caregiverRefreshKey, setCaregiverRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [telegramLink, setTelegramLink] = useState<{
    linkCode: string;
    botUsername: string;
    caregiverId: string;
  } | null>(null);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  const refreshCaregivers = useCallback(() => {
    setCaregiverRefreshKey((k) => k + 1);
  }, []);

  async function handleDelete() {
    if (
      !confirm(
        `Are you sure you want to delete ${profile?.name}'s profile? This will remove all their medications, reminders, and caregivers. This action cannot be undone.`
      )
    )
      return;
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

  async function handleVoiceChange(voiceId: string) {
    setSavingVoice(true);
    try {
      const res = await apiFetch(`/api/elderly/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) throw new Error("Failed to update voice");
      setProfile((prev) => (prev ? { ...prev, voiceId } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update voice");
    } finally {
      setSavingVoice(false);
    }
  }

  async function handleGenerateTelegramLink(caregiverId: string) {
    setGeneratingLink(caregiverId);
    try {
      const res = await apiFetch(`/api/elderly/${id}/telegram-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiverId }),
      });
      if (!res.ok) throw new Error("Failed to generate link");
      const data = await res.json();
      setTelegramLink({ ...data, caregiverId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate link"
      );
    } finally {
      setGeneratingLink(null);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-[var(--danger)]">{error || "Profile not found"}</p>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const allVerified = profile.phoneVerified && profile.emergencyPhoneVerified;

  return (
    <PageTransition>
      {/* Verification warning */}
      {!allVerified && (
        <div className="mx-6 mt-4 rounded-xl bg-[var(--warning-light)] border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Action required:</strong> Please verify both the elderly phone
          and emergency contact phone before managing medications, reminders, or
          caregivers.
        </div>
      )}

      {/* Header */}
      <ProfileHeader
        name={profile.name}
        phone={profile.phone}
        phoneVerified={profile.phoneVerified}
        language={profile.language}
        avatarUrl={profile.avatarUrl}
        role={profile.role}
        uploadingAvatar={uploadingAvatar}
        deleting={deleting}
        onAvatarUpload={handleAvatarUpload}
        onDelete={handleDelete}
      />

      {/* Tabs */}
      <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content with crossfade */}
      <div className="px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              <OverviewTab profile={profile} allVerified={allVerified} />
            )}
            {activeTab === "medications" && (
              <MedicationsTab
                profile={profile}
                allVerified={allVerified}
                id={id}
              />
            )}
            {activeTab === "reminders" && (
              <RemindersTab
                profile={profile}
                allVerified={allVerified}
                id={id}
              />
            )}
            {activeTab === "assessment" && (
              <AssessmentTab allVerified={allVerified} id={id} />
            )}
            {activeTab === "calls" && (
              <CallLogsTab allVerified={allVerified} id={id} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageTransition>
  );

  /* ─── Overview Tab ─── */
  function OverviewTab({
    profile,
    allVerified,
  }: {
    profile: ElderlyProfile;
    allVerified: boolean;
  }) {
    return (
      <div className="space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Medications"
            value={profile.medications.length}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236c.016.003.032.007.048.012a.5.5 0 0 0 .472-.01l.89-.445a1.5 1.5 0 0 0 .572-.523L14.5 5.5" />
              </svg>
            }
          />
          <StatCard
            label="Active Reminders"
            value={profile.reminders.filter((r) => r.active).length}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
            }
          />
          <StatCard
            label="Caregivers"
            value={profile.caregivers.length}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
          <StatCard
            label="Timezone"
            value={profile.timezone?.split("/").pop()?.replace(/_/g, " ") || "UTC"}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
        </div>

        {/* Profile info */}
        <Card>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
            Profile Information
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-[var(--text-muted)]">Phone</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm text-[var(--text-primary)]">
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
              <dt className="text-sm font-medium text-[var(--text-muted)]">Created</dt>
              <dd className="mt-1 text-sm text-[var(--text-primary)]">
                {new Date(profile.createdAt).toLocaleDateString()}
              </dd>
            </div>
            {profile.emergencyContact && (
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">
                  Emergency Contact
                </dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {profile.emergencyContact}
                </dd>
              </div>
            )}
            {profile.emergencyPhone && (
              <div>
                <dt className="text-sm font-medium text-[var(--text-muted)]">
                  Emergency Phone
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  {profile.emergencyPhone}
                  <PhoneVerification
                    phone={profile.emergencyPhone}
                    verified={profile.emergencyPhoneVerified}
                    type="emergency"
                    entityId={profile.id}
                    onVerified={() =>
                      setProfile((prev) =>
                        prev
                          ? { ...prev, emergencyPhoneVerified: true }
                          : prev
                      )
                    }
                  />
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Voice settings */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Call Voice
            </h3>
            {savingVoice && (
              <span className="text-xs text-[var(--text-muted)]">Saving...</span>
            )}
          </div>
          <VoiceSelector
            value={profile.voiceId || "21m00Tcm4TlvDq8ikWAM"}
            onChange={handleVoiceChange}
            customVoiceName={profile.customVoiceName}
            onClone={async (voiceId, name) => {
              setSavingVoice(true);
              try {
                const res = await apiFetch(`/api/elderly/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ voiceId, customVoiceName: name }),
                });
                if (!res.ok) throw new Error("Failed to save cloned voice");
                setProfile((prev) =>
                  prev ? { ...prev, voiceId, customVoiceName: name } : prev
                );
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to save"
                );
              } finally {
                setSavingVoice(false);
              }
            }}
          />
        </Card>

        {/* Caregivers */}
        <Card className={!allVerified ? "opacity-50 pointer-events-none" : ""}>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
            Caregivers
          </h3>
          <CaregiverList
            elderlyProfileId={profile.id}
            refreshKey={caregiverRefreshKey}
          />
          <div className="mt-4 border-t border-[var(--border-default)] pt-4">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Add a caregiver
            </h4>
            <AddCaregiverForm
              elderlyProfileId={profile.id}
              onSuccess={refreshCaregivers}
            />
          </div>
          {profile.caregivers.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-default)] pt-4">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Link Telegram Bot
              </h4>
              <div className="space-y-2">
                {profile.caregivers.map((cg) => (
                  <div
                    key={cg.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-[var(--text-primary)]">
                      {cg.name}
                      {cg.telegramChatId && (
                        <Badge variant="success" className="ml-2">
                          Telegram linked
                        </Badge>
                      )}
                    </span>
                    {!cg.telegramChatId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={generatingLink === cg.id}
                        onClick={() => handleGenerateTelegramLink(cg.id)}
                      >
                        Generate Link Code
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {telegramLink && (
                <div className="mt-3 rounded-lg bg-[var(--accent-light)] border border-[var(--accent)] p-3 text-sm">
                  <p className="font-medium text-[var(--text-primary)] mb-1">
                    Send this to the Telegram bot:
                  </p>
                  <code className="block bg-[var(--bg-primary)] rounded px-2 py-1 text-[var(--accent)] font-mono text-xs">
                    /start {telegramLink.linkCode}
                  </code>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Bot: @{telegramLink.botUsername} &middot; Expires in 15
                    minutes
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* ─── Medications Tab ─── */
  function MedicationsTab({
    profile,
    allVerified,
    id,
  }: {
    profile: ElderlyProfile;
    allVerified: boolean;
    id: string;
  }) {
    return (
      <div
        className={`space-y-4 ${!allVerified ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Medications ({profile.medications.length})
          </h3>
          <Link href={`/elderly/${id}/reminders`}>
            <Button size="sm">Manage Medications</Button>
          </Link>
        </div>
        {profile.medications.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              No medications added yet.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-[var(--border-default)]">
              {profile.medications.map((med) => (
                <li key={med.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)] shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m20.893 13.393-1.135-1.135a2.252 2.252 0 0 1-.421-.585l-1.08-2.16a.414.414 0 0 0-.663-.107.827.827 0 0 1-.812.21l-1.273-.363a.89.89 0 0 0-.738 1.595l.587.39c.59.395.674 1.23.172 1.732l-.2.2c-.212.212-.33.498-.33.796v.41c0 .409-.11.809-.32 1.158l-1.315 2.191a2.11 2.11 0 0 1-1.81 1.025 1.055 1.055 0 0 1-1.055-1.055v-1.172c0-.92-.56-1.747-1.414-2.089l-.655-.261a2.25 2.25 0 0 1-1.383-2.46l.007-.042a2.25 2.25 0 0 1 .29-.787l.09-.15a2.25 2.25 0 0 1 2.37-1.048l1.178.236c.016.003.032.007.048.012a.5.5 0 0 0 .472-.01l.89-.445a1.5 1.5 0 0 0 .572-.523L14.5 5.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {med.name}
                      </p>
                      {med.dosage && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          {med.dosage}
                        </p>
                      )}
                      {med.instructions && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {med.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  /* ─── Reminders Tab ─── */
  function RemindersTab({
    profile,
    allVerified,
    id,
  }: {
    profile: ElderlyProfile;
    allVerified: boolean;
    id: string;
  }) {
    return (
      <div
        className={`space-y-4 ${!allVerified ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Reminders ({profile.reminders.length})
          </h3>
          <Link href={`/elderly/${id}/reminders`}>
            <Button size="sm">Manage Reminders</Button>
          </Link>
        </div>
        {profile.reminders.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              No reminders set up yet.
            </p>
          </Card>
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-[var(--border-default)]">
              {profile.reminders.map((rem) => (
                <li
                  key={rem.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {rem.title}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {rem.type} &middot; {rem.scheduledTime}
                    </p>
                  </div>
                  <Badge variant={rem.active ? "success" : "default"}>
                    {rem.active ? "Active" : "Inactive"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  /* ─── Assessment Tab ─── */
  function AssessmentTab({
    allVerified,
    id,
  }: {
    allVerified: boolean;
    id: string;
  }) {
    return (
      <div
        className={`${!allVerified ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Cognitive Assessment
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Daily automated check-in calls with cognitive questions
              </p>
            </div>
            <Link href={`/elderly/${id}/assessment`}>
              <Button>Manage Assessment</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  /* ─── Call Logs Tab ─── */
  function CallLogsTab({
    allVerified,
    id,
  }: {
    allVerified: boolean;
    id: string;
  }) {
    return (
      <div
        className={`${!allVerified ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Call History
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                View all past reminder and assessment calls
              </p>
            </div>
            <Link href={`/elderly/${id}/logs`}>
              <Button variant="secondary">View Full History</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }
}
