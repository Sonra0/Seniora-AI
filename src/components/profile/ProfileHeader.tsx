"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ProfileHeaderProps {
  name: string;
  phone: string;
  phoneVerified: boolean;
  language: string;
  avatarUrl: string | null;
  role: "manager" | "caregiver";
  uploadingAvatar: boolean;
  deleting: boolean;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

export function ProfileHeader({
  name,
  phone,
  phoneVerified,
  language,
  avatarUrl,
  role,
  uploadingAvatar,
  deleting,
  onAvatarUpload,
  onDelete,
}: ProfileHeaderProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-4 px-6 py-6 border-b border-[var(--border-default)]">
      <Link
        href="/dashboard"
        className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        &larr; Back
      </Link>

      {/* Avatar with upload */}
      <label className="relative cursor-pointer group shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--accent-light)]"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)] ring-2 ring-[var(--accent)]">
            <span className="text-sm font-bold text-[var(--accent)]">{initials}</span>
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
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatarUpload} className="sr-only" />
      </label>

      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)] truncate">{name}</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm text-[var(--text-secondary)]">{phone}</span>
          {phoneVerified && <Badge variant="success">Verified</Badge>}
          <Badge variant="accent">{language === "ar" ? "Arabic" : "English"}</Badge>
          {role === "caregiver" && <Badge variant="default">Caregiver</Badge>}
        </div>
      </div>

      {role === "manager" && (
        <Button variant="danger" size="sm" loading={deleting} onClick={onDelete}>
          Delete
        </Button>
      )}
    </div>
  );
}
