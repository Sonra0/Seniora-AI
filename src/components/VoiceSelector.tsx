"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

const PRESET_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "Female", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=Rachel&backgroundColor=b6e3f4" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=Sarah&backgroundColor=ffd5dc" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=Lily&backgroundColor=d1d4f9" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Male", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=Brian&backgroundColor=c0aede" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male", avatar: "https://api.dicebear.com/9.x/lorelei/svg?seed=George&backgroundColor=ffdfbf" },
];

const PRESET_IDS = new Set(PRESET_VOICES.map((v) => v.id));

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  customVoiceName?: string | null;
  onClone?: (voiceId: string, name: string) => void;
}

export default function VoiceSelector({ value, onChange, customVoiceName, onClone }: VoiceSelectorProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Record<string, string>>({});

  // Clone panel state
  const [showClonePanel, setShowClonePanel] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedUrlRef = useRef<string | null>(null);

  const hasCustomVoice = !PRESET_IDS.has(value);

  async function handlePlay(voiceId: string) {
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = URL.createObjectURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordedBlob(null);
      setCloneError("");
    } catch {
      setCloneError("Microphone access denied. Please allow microphone access.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function playRecording() {
    if (!recordedUrlRef.current) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(recordedUrlRef.current);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId("recorded");
    audio.play();
  }

  async function handleClone() {
    if (!recordedBlob || !cloneName.trim()) return;
    setCloning(true);
    setCloneError("");

    try {
      const formData = new FormData();
      formData.append("audio", recordedBlob, "recording.webm");
      formData.append("name", cloneName.trim());

      const res = await apiFetch("/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Clone failed");
      }

      const { voiceId } = await res.json();
      onClone?.(voiceId, cloneName.trim());
      setShowClonePanel(false);
      setRecordedBlob(null);
      setCloneName("");
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  }

  function renderVoiceCard(
    voiceId: string,
    name: string,
    subtitle: string,
    avatarContent: React.ReactNode,
    isCustom = false
  ) {
    const isSelected = value === voiceId;
    const isPlaying = playingId === voiceId;
    const isLoading = loadingId === voiceId;

    return (
      <div
        key={voiceId}
        onClick={() => onChange(voiceId)}
        className={`flex items-center justify-between rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
          isSelected
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-200 hover:border-gray-300 bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          {avatarContent}
          <div>
            <p className={`text-sm font-medium ${isSelected ? "text-indigo-900" : "text-gray-900"}`}>
              {name}
            </p>
            <p className={`text-xs ${isSelected ? "text-indigo-600" : "text-gray-500"}`}>
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isCustom && !isSelected) {
              onChange(voiceId);
            }
            handlePlay(voiceId);
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
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Voice
      </label>
      <div className="grid grid-cols-1 gap-2">
        {PRESET_VOICES.map((voice) =>
          renderVoiceCard(
            voice.id,
            voice.name,
            voice.gender,
            <img
              src={voice.avatar}
              alt={voice.name}
              className={`h-10 w-10 rounded-full border-2 ${
                value === voice.id ? "border-indigo-400" : "border-gray-200"
              }`}
            />
          )
        )}

        {/* Custom cloned voice */}
        {hasCustomVoice &&
          renderVoiceCard(
            value,
            customVoiceName || "My Voice",
            "Cloned voice",
            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-emerald-50 border-emerald-400`}>
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>,
            true
          )
        }

        {/* Clone your voice button */}
        <div
          onClick={() => setShowClonePanel(!showClonePanel)}
          className={`flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 cursor-pointer transition-colors ${
            showClonePanel
              ? "border-emerald-400 bg-emerald-50"
              : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Clone Your Voice</p>
            <p className="text-xs text-gray-500">Record a sample to create a custom voice</p>
          </div>
        </div>

        {/* Clone recording panel */}
        {showClonePanel && (
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div>
              <label htmlFor="cloneName" className="block text-sm font-medium text-gray-700 mb-1">
                Voice Name
              </label>
              <input
                id="cloneName"
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="e.g. Mom, Dad, Nurse Sarah"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Voice Recording</p>
              <p className="text-xs text-gray-500 mb-2">
                Read aloud for at least 30 seconds in a quiet environment for best results.
              </p>

              <div className="flex items-center gap-2">
                {!recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="6" />
                    </svg>
                    Record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop
                  </button>
                )}

                {recording && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Recording...
                  </span>
                )}

                {recordedBlob && !recording && (
                  <button
                    type="button"
                    onClick={playRecording}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play Back
                  </button>
                )}
              </div>
            </div>

            {cloneError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {cloneError}
              </div>
            )}

            <button
              type="button"
              onClick={handleClone}
              disabled={!recordedBlob || !cloneName.trim() || cloning}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cloning ? "Cloning Voice..." : "Clone Voice"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
