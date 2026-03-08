"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  category: string;
  questionText: string;
  correctAnswer: string;
}

interface Answer {
  id: string;
  questionText: string;
  correctAnswer: string;
  elderAnswer: string | null;
  result: string | null;
  recordingUrl: string | null;
}

interface VocalAnalysis {
  parkinsons: { currentProbability: number; futureRisk: number; details: string };
  depression: { currentState: number; futurePropensity: number; details: string };
  mood: { todayMood: string; wellnessScore: number; details: string };
}

interface Session {
  id: string;
  date: string;
  overallScore: number | null;
  status: string;
  summary: string | null;
  severity: string | null;
  vocalAnalysis: VocalAnalysis | null;
  answers: Answer[];
  createdAt: string;
}

interface Config {
  id: string;
  scheduledTime: string;
  questionsPerCall: number;
  active: boolean;
}

const CATEGORIES = ["PERSONAL", "ORIENTATION", "PEOPLE", "GENERAL"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  ORIENTATION: "Daily Orientation",
  PEOPLE: "People Recognition",
  GENERAL: "General Knowledge",
};

export default function AssessmentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"setup" | "reports">("reports");

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment`);
      if (!res.ok) throw new Error("Failed to load assessment data");
      const data = await res.json();
      setConfig(data.config);
      setSessions(data.sessions || []);

      if (data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        const qRes = await apiFetch(`/api/elderly/${id}/assessment/questions`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setQuestions(qData.questions);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user && id) fetchData();
  }, [user, authLoading, router, id, fetchData]);

  function updateQuestion(index: number, field: "questionText" | "correctAnswer", value: string) {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function saveQuestions() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSuccess("Questions saved successfully");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function updateConfig(updates: Partial<Config>) {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      const updated = await res.json();
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const [triggering, setTriggering] = useState(false);

  async function triggerTestCall() {
    setTriggering(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger");
      setSuccess("Assessment call triggered! You should receive a call shortly.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger call");
    } finally {
      setTriggering(false);
    }
  }

  const filledCount = questions.filter((q) => q.correctAnswer.trim()).length;
  const latestSession = sessions[0];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/elderly/${id}`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Cognitive Assessment</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "reports" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab("setup")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "setup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Setup
        </button>
      </div>

      {activeTab === "setup" && (
        <>
          {/* Schedule Config */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Call Time</label>
                <input
                  type="time"
                  value={config?.scheduledTime || "09:00"}
                  onChange={(e) => updateConfig({ scheduledTime: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Questions Per Call</label>
                <select
                  value={config?.questionsPerCall || 4}
                  onChange={(e) => updateConfig({ questionsPerCall: parseInt(e.target.value) })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <button
                onClick={() => updateConfig({ active: !config?.active })}
                disabled={saving || (!config?.active && filledCount < 10)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  config?.active
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {config?.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={triggerTestCall}
                disabled={triggering || filledCount < 10}
                className="rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering ? "Calling..." : "Test Call Now"}
              </button>
            </div>
            {!config?.active && filledCount < 10 && (
              <p className="mt-2 text-xs text-amber-600">
                Fill in at least 10 correct answers to activate ({filledCount}/10 filled)
              </p>
            )}
            {config?.active && (
              <p className="mt-2 text-xs text-green-600">
                Assessment calls active daily at {config.scheduledTime}
              </p>
            )}
          </section>

          {/* Questions */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Questions ({filledCount}/30 answered)</h2>
              <button
                onClick={saveQuestions}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Questions"}
              </button>
            </div>

            {CATEGORIES.map((cat) => (
              <div key={cat} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-3">
                  {questions
                    .map((q, i) => ({ q, i }))
                    .filter(({ q }) => q.category === cat)
                    .map(({ q, i }) => (
                      <div key={q.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={q.questionText}
                          onChange={(e) => updateQuestion(i, "questionText", e.target.value)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Question"
                        />
                        <input
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(i, "correctAnswer", e.target.value)}
                          className={`rounded-lg border px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            q.correctAnswer.trim() ? "border-green-300 bg-green-50" : "border-gray-300"
                          }`}
                          placeholder="Correct answer"
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {activeTab === "reports" && (
        <>
          {/* Latest Report */}
          {latestSession && latestSession.status === "COMPLETED" ? (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Latest Assessment</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{latestSession.date}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      latestSession.severity === "GREEN"
                        ? "bg-green-100 text-green-700"
                        : latestSession.severity === "YELLOW"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {Math.round((latestSession.overallScore || 0) * 100)}%
                  </span>
                </div>
              </div>
              {latestSession.summary && (
                <p className="text-sm text-gray-700 mb-4">{latestSession.summary}</p>
              )}
              <div className="space-y-3">
                {latestSession.answers.map((a, i) => (
                  <div key={a.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          a.result === "CORRECT"
                            ? "bg-green-100 text-green-700"
                            : a.result === "WRONG"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{a.questionText}</p>
                        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-400 uppercase w-16 shrink-0">Answer:</span>
                            <span className={`text-sm ${a.result === "CORRECT" ? "text-green-700 font-medium" : a.result === "WRONG" ? "text-red-600" : "text-gray-400 italic"}`}>
                              {a.elderAnswer || "No answer"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-gray-400 uppercase w-16 shrink-0">Correct:</span>
                            <span className="text-sm text-gray-700">{a.correctAnswer}</span>
                          </div>
                        </div>
                        {a.recordingUrl && (
                          <div className="mt-2">
                            <audio controls preload="none" className="h-8 w-full max-w-xs">
                              <source src={`/api/recording?url=${encodeURIComponent(a.recordingUrl)}`} type="audio/mpeg" />
                            </audio>
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.result === "CORRECT" ? "bg-green-100 text-green-700" : a.result === "WRONG" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {a.result || "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Vocal Analysis Report */}
          {latestSession?.vocalAnalysis && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vocal & Wellness Analysis</h2>

              {/* Mood & Wellness - prominent card */}
              <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Today&apos;s Mood</p>
                    <p className="text-xl font-bold text-gray-900">{latestSession.vocalAnalysis.mood.todayMood}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Wellness Score</p>
                    <p className={`text-3xl font-bold ${
                      latestSession.vocalAnalysis.mood.wellnessScore >= 70 ? "text-green-600" :
                      latestSession.vocalAnalysis.mood.wellnessScore >= 40 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {latestSession.vocalAnalysis.mood.wellnessScore}<span className="text-sm text-gray-400">/100</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{latestSession.vocalAnalysis.mood.details}</p>
              </div>

              {/* Risk Assessments Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Parkinson's */}
                <div className="rounded-lg border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Parkinson&apos;s Risk Assessment</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Current Probability</span>
                        <span className="font-medium">{latestSession.vocalAnalysis.parkinsons.currentProbability}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            latestSession.vocalAnalysis.parkinsons.currentProbability <= 20 ? "bg-green-400" :
                            latestSession.vocalAnalysis.parkinsons.currentProbability <= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${latestSession.vocalAnalysis.parkinsons.currentProbability}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Future Risk</span>
                        <span className="font-medium">{latestSession.vocalAnalysis.parkinsons.futureRisk}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            latestSession.vocalAnalysis.parkinsons.futureRisk <= 20 ? "bg-green-400" :
                            latestSession.vocalAnalysis.parkinsons.futureRisk <= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${latestSession.vocalAnalysis.parkinsons.futureRisk}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{latestSession.vocalAnalysis.parkinsons.details}</p>
                  </div>
                </div>

                {/* Depression */}
                <div className="rounded-lg border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Depression & Mental Health</h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Current State</span>
                        <span className="font-medium">{latestSession.vocalAnalysis.depression.currentState}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            latestSession.vocalAnalysis.depression.currentState <= 20 ? "bg-green-400" :
                            latestSession.vocalAnalysis.depression.currentState <= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${latestSession.vocalAnalysis.depression.currentState}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Future Propensity</span>
                        <span className="font-medium">{latestSession.vocalAnalysis.depression.futurePropensity}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            latestSession.vocalAnalysis.depression.futurePropensity <= 20 ? "bg-green-400" :
                            latestSession.vocalAnalysis.depression.futurePropensity <= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${latestSession.vocalAnalysis.depression.futurePropensity}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{latestSession.vocalAnalysis.depression.details}</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4 italic">
                This analysis is for caregiver awareness only and does not constitute a clinical diagnosis.
              </p>
            </section>
          )}

          {/* No sessions fallback */}
          {(!latestSession || (latestSession.status !== "COMPLETED" && !latestSession.vocalAnalysis)) && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500 text-center py-4">
                {sessions.length === 0
                  ? "No assessments yet. Set up questions and activate to start."
                  : latestSession?.status === "IN_PROGRESS"
                  ? "Assessment call in progress..."
                  : latestSession?.status === "PENDING"
                  ? "Assessment call pending..."
                  : "Latest assessment failed."}
              </p>
            </section>
          )}

          {/* History */}
          {sessions.length > 1 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>

              {/* Score trend bar chart */}
              <div className="flex items-end gap-1 h-20 mb-6">
                {[...sessions].reverse().map((s) => {
                  const pct = Math.round((s.overallScore || 0) * 100);
                  return (
                    <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${
                          s.severity === "GREEN"
                            ? "bg-green-400"
                            : s.severity === "YELLOW"
                            ? "bg-yellow-400"
                            : s.severity === "RED"
                            ? "bg-red-400"
                            : "bg-gray-200"
                        }`}
                        style={{ height: `${Math.max(pct, 5)}%` }}
                        title={`${s.date}: ${pct}%`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Session list */}
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id}>
                    <button
                      onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                      className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-sm text-gray-900">{s.date}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.severity === "GREEN"
                              ? "bg-green-100 text-green-700"
                              : s.severity === "YELLOW"
                              ? "bg-yellow-100 text-yellow-700"
                              : s.severity === "RED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.status === "COMPLETED" ? `${Math.round((s.overallScore || 0) * 100)}%` : s.status}
                        </span>
                        <svg
                          className={`h-4 w-4 text-gray-400 transition-transform ${expandedSession === s.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>
                    {expandedSession === s.id && (
                      <div className="px-3 pb-3 space-y-2">
                        {s.summary && <p className="text-sm text-gray-600 mb-2">{s.summary}</p>}
                        {s.answers.map((a) => (
                          <div key={a.id} className="rounded border border-gray-100 p-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span className={`font-bold ${a.result === "CORRECT" ? "text-green-600" : a.result === "WRONG" ? "text-red-600" : "text-gray-400"}`}>
                                {a.result === "CORRECT" ? "\u2713" : a.result === "WRONG" ? "\u2717" : "?"}
                              </span>
                              <span className="font-medium text-gray-800">{a.questionText}</span>
                            </div>
                            <div className="ml-5 mt-1 text-xs text-gray-500">
                              <span>Answer: <span className={a.result === "CORRECT" ? "text-green-600" : "text-red-500"}>{a.elderAnswer || "—"}</span></span>
                              <span className="mx-1">&middot;</span>
                              <span>Correct: {a.correctAnswer}</span>
                            </div>
                            {a.recordingUrl && (
                              <div className="ml-5 mt-1">
                                <audio controls preload="none" className="h-7 w-full max-w-xs">
                                  <source src={`/api/recording?url=${encodeURIComponent(a.recordingUrl)}`} type="audio/mpeg" />
                                </audio>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
