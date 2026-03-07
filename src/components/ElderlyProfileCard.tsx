"use client";

import Link from "next/link";

interface ElderlyProfileCardProps {
  id: string;
  name: string;
  avatarUrl: string | null;
  phone: string;
  phoneVerified: boolean;
  caregiverCount: number;
  reminderCount: number;
}

export default function ElderlyProfileCard({
  id,
  name,
  avatarUrl,
  phone,
  phoneVerified,
  caregiverCount,
  reminderCount,
}: ElderlyProfileCardProps) {
  return (
    <Link href={`/elderly/${id}`}>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="h-11 w-11 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <span>{phone}</span>
                {phoneVerified && (
                  <span
                    className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    title="Phone verified"
                  >
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4 text-gray-400"
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
          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4 text-gray-400"
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
        </div>
      </div>
    </Link>
  );
}
