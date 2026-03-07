"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

export default function Navbar() {
  const { user } = useUser();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
          Seniora
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="hidden text-sm text-gray-600 sm:inline">
                {user.name || user.email}
              </span>
              <a
                href="/api/auth/logout"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Log out
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
