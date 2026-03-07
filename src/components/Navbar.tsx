"use client";

import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function Navbar() {
  const { user } = useAuth();

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
                {user.displayName || user.email}
              </span>
              <button
                onClick={() => signOut(auth)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
