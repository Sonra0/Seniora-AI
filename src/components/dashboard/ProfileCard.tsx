"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ProfileCardProps {
  id: string;
  name: string;
  avatarUrl: string | null;
  phone: string;
  phoneVerified: boolean;
  language: string;
  caregiverCount: number;
  reminderCount: number;
}

export function ProfileCard({
  id,
  name,
  avatarUrl,
  phone,
  phoneVerified,
  language,
  caregiverCount,
  reminderCount,
}: ProfileCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link href={`/elderly/${id}`} className="block">
      <Card hover padding="md">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--accent-light)]"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)] ring-2 ring-[var(--accent)]">
              <span className="text-sm font-bold text-[var(--accent)]">
                {initials}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
              {name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="truncate text-sm text-[var(--text-secondary)]">
                {phone}
              </span>
              {phoneVerified && <Badge variant="success">Verified</Badge>}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 border-t border-[var(--border-default)] pt-3">
          {/* Caregivers */}
          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
            <span>
              {caregiverCount} caregiver{caregiverCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Reminders */}
          <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
              />
            </svg>
            <span>
              {reminderCount} reminder{reminderCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Language badge */}
          <div className="ml-auto">
            <Badge variant="accent">{language}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
