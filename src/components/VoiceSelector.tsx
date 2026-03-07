"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "Female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male" },
] as const;

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
}

export default function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({});

  async function handlePlay(voiceId: string) {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === voiceId) {
      setPlayingId(null);
      return;
    }

    setLoadingId(voiceId);

    try {
      let blobUrl = cacheRef.current[voiceId];

      if (!blobUrl) {
        const res = await apiFetch("/api/voices/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId }),
        });

        if (!res.ok) throw new Error("Failed to load preview");

        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        cacheRef.current[voiceId] = blobUrl;
      }

      const audio = new Audio(blobUrl);
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      await audio.play();
      setPlayingId(voiceId);
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Voice
      </label>
      <div className="grid grid-cols-1 gap-2">
        {VOICES.map((voice) => {
          const isSelected = value === voice.id;
          const isPlaying = playingId === voice.id;
          const isLoading = loadingId === voice.id;

          return (
            <div
              key={voice.id}
              onClick={() => onChange(voice.id)}
              className={`flex items-center justify-between rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                    isSelected
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {voice.gender === "Female" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isSelected ? "text-indigo-900" : "text-gray-900"}`}>
                    {voice.name}
                  </p>
                  <p className={`text-xs ${isSelected ? "text-indigo-600" : "text-gray-500"}`}>
                    {voice.gender}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay(voice.id);
                }}
                disabled={isLoading}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  isPlaying
                    ? "bg-indigo-600 text-white"
                    : isSelected
                    ? "bg-indigo-200 text-indigo-700 hover:bg-indigo-300"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } disabled:opacity-50`}
                title={isPlaying ? "Stop" : "Preview voice"}
              >
                {isLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isPlaying ? (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
