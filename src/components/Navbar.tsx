"use client";

import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Navbar() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/user/avatar")
      .then((res) => res.json())
      .then((data) => setAvatarUrl(data.avatarUrl))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await apiFetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl + "?t=" + Date.now());
      }
    } finally {
      setUploading(false);
      setMenuOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initial = user?.displayName?.charAt(0) || user?.email?.charAt(0) || "?";

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
          Seniora
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="hidden text-sm text-gray-600 sm:inline">
                {user.displayName || user.email}
              </span>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-gray-200 hover:border-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-100 text-indigo-600 font-semibold text-sm">
                      {initial.toUpperCase()}
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Change profile picture
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut(auth);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
