"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface PhoneVerificationProps {
  phone: string;
  verified: boolean;
  type: "elderly" | "caregiver";
  entityId: string;
  onVerified: () => void;
}

export default function PhoneVerification({
  phone,
  verified,
  type,
  entityId,
  onVerified,
}: PhoneVerificationProps) {
  const [step, setStep] = useState<"idle" | "otp" | "verifying">("idle");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (verified) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Verified
      </span>
    );
  }

  const handleSendCode = async () => {
    setSending(true);
    setError("");
    try {
      const res = await apiFetch("/api/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, type, entityId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send code");
      }
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const handleCheckCode = async () => {
    if (!code.trim()) return;
    setStep("verifying");
    setError("");
    try {
      const res = await apiFetch("/api/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: code.trim(), type, entityId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStep("otp");
    }
  };

  if (step === "idle") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
          Unverified
        </span>
        <button
          onClick={handleSendCode}
          disabled={sending}
          className="rounded-lg border border-indigo-200 px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          {sending ? "Sending..." : "Verify"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter code"
        maxLength={6}
        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
      />
      <button
        onClick={handleCheckCode}
        disabled={step === "verifying" || !code.trim()}
        className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {step === "verifying" ? "Checking..." : "Submit"}
      </button>
      <button
        onClick={() => {
          setStep("idle");
          setCode("");
          setError("");
        }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
