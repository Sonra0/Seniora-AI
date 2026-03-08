"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";
import { ScoreGauge } from "@/components/assessment/ScoreGauge";
import { TrendChart } from "@/components/assessment/TrendChart";
import { VocalRadarChart } from "@/components/assessment/RadarChart";
import { HeatmapChart } from "@/components/assessment/HeatmapChart";
import { RiskCard } from "@/components/assessment/RiskCard";
import { QuestionList } from "@/components/assessment/QuestionList";
import { HistoryTimeline } from "@/components/assessment/HistoryTimeline";

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
  audioUrl?: string | null;
  orderIndex: number;
}

interface VocalAnalysis {
  parkinsons: { currentProbability: number; futureRisk: number; details: string };
  depression: { currentState: number; futurePropensity: number; details: string };
  mood: { todayMood: string; wellnessScore: number; details: string };
  parkinsonsRisk?: number;
  depressionIndex?: number;
  wellnessScore?: number;
  moodScore?: number;
  speechFluency?: number;
}

interface Session {
  id: string;
  date: string;
  overallScore: number | null;
  status: string;
  summary: string | null;
  severity: "GREEN" | "YELLOW" | "RED" | null;
  vocalAnalysis: VocalAnalysis | null;
  emotionalResponse?: string | null;
  answers: Answer[];
  createdAt: string;
}

interface Config {
  id: string;
  scheduledTime: string;
  questionsPerCall: number;
  active: boolean;
}

interface TrendsData {
  trend: "improving" | "declining" | "stable";
  trends: {
    dates: string[];
    scores: (number | null)[];
    severities: (string | null)[];
    wellnessScores: (number | null)[];
    depressionIndices: (number | null)[];
    moodScores: (number | null)[];
  };
  vocalRadar: Record<string, number> | null;
  heatmap: { day: string; week: number; value: number }[];
  latestSession: Session | null;
  sessionCount: number;
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
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"analytics" | "setup">("analytics");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [assessRes, trendsRes] = await Promise.all([
        apiFetch(`/api/elderly/${id}/assessment`),
        apiFetch(`/api/elderly/${id}/assessment/trends`),
      ]);

      if (assessRes.ok) {
        const data = await assessRes.json();
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
      }

      if (trendsRes.ok) {
        const trends = await trendsRes.json();
        setTrendsData(trends);
        if (trends.latestSession) {
          setSelectedSessionId(trends.latestSession.id);
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
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to save"); }
      setSuccess("Questions saved successfully");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function updateConfig(updates: Partial<Config>) {
    setSaving(true); setError("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to update"); }
      setConfig(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally { setSaving(false); }
  }

  async function triggerTestCall() {
    setTriggering(true); setError(""); setSuccess("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger");
      setSuccess("Assessment call triggered! You should receive a call shortly.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger call");
    } finally { setTriggering(false); }
  }

  const filledCount = questions.filter((q) => q.correctAnswer.trim()).length;

  // Find selected session data
  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId) || trendsData?.latestSession
    : trendsData?.latestSession;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border-default)]">
        <Link
          href={`/elderly/${id}`}
          className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex-1">
          Cognitive Assessment
        </h1>
        {/* Tab toggle */}
        <div className="flex gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "analytics"
                ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab("setup")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "setup"
                ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Setup
          </button>
        </div>
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4 space-y-2">
        {error && (
          <div className="rounded-xl bg-[var(--danger-light)] px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-xl bg-[var(--success-light)] px-4 py-3 text-sm text-emerald-700">{success}</div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "analytics" ? (
          <motion.div
            key="analytics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Dark theme analytics dashboard */}
            <div className="theme-dark bg-[var(--bg-primary)] min-h-screen mt-4 rounded-t-3xl px-6 py-8 transition-colors duration-300">
              {!trendsData || trendsData.sessionCount === 0 ? (
                <div className="text-center py-16">
                  <svg className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={0.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-semibold text-gray-400">
                    No assessment data yet
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Complete your first assessment to see analytics here.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Row 1: Score gauges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center">
                      <ScoreGauge
                        score={(selectedSession?.overallScore ?? 0) * 100}
                        label="Cognitive Score"
                        severity={selectedSession?.severity}
                        size="lg"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <ScoreGauge
                        score={selectedSession?.vocalAnalysis?.mood?.wellnessScore ?? 0}
                        label="Wellness Score"
                        size="sm"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <ScoreGauge
                        score={selectedSession?.vocalAnalysis?.moodScore ?? selectedSession?.vocalAnalysis?.mood?.wellnessScore ?? 0}
                        label="Mood"
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Trend badge */}
                  {trendsData.trend && (
                    <div className="flex justify-center">
                      <Badge
                        variant={
                          trendsData.trend === "improving"
                            ? "success"
                            : trendsData.trend === "declining"
                            ? "danger"
                            : "default"
                        }
                        size="md"
                        pulse={trendsData.trend === "declining"}
                      >
                        {trendsData.trend === "improving" ? "↑ Improving" : trendsData.trend === "declining" ? "↓ Declining" : "→ Stable"}
                      </Badge>
                    </div>
                  )}

                  {/* Row 2: 30-day trend chart */}
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-4">30-Day Trend Analysis</h3>
                    <TrendChart
                      dates={trendsData.trends.dates}
                      scores={trendsData.trends.scores.map((s) => s !== null ? s * 100 : null)}
                      wellnessScores={trendsData.trends.wellnessScores}
                      depressionIndices={trendsData.trends.depressionIndices}
                    />
                  </div>

                  {/* Row 3: Vocal biomarkers */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                      <h3 className="text-sm font-medium text-gray-400 mb-4">Vocal Biomarkers</h3>
                      <VocalRadarChart data={trendsData.vocalRadar} />
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                      <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Mood Patterns</h3>
                      <HeatmapChart data={trendsData.heatmap} />
                    </div>
                  </div>

                  {/* Row 4: Risk assessment */}
                  {selectedSession?.vocalAnalysis && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <RiskCard
                        title="Parkinson's Risk"
                        riskPercent={selectedSession.vocalAnalysis.parkinsons?.currentProbability ?? selectedSession.vocalAnalysis.parkinsonsRisk ?? 0}
                        note={selectedSession.vocalAnalysis.parkinsons?.details}
                      />
                      <RiskCard
                        title="Depression Risk"
                        riskPercent={selectedSession.vocalAnalysis.depression?.currentState ?? selectedSession.vocalAnalysis.depressionIndex ?? 0}
                        note={selectedSession.vocalAnalysis.depression?.details}
                      />
                    </div>
                  )}

                  {/* Row 5: Question breakdown */}
                  {selectedSession && selectedSession.answers.length > 0 && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                      <h3 className="text-sm font-medium text-gray-400 mb-4">Question Breakdown</h3>
                      <QuestionList
                        answers={selectedSession.answers.map((a) => ({
                          ...a,
                          audioUrl: a.recordingUrl
                            ? `/api/recording?url=${encodeURIComponent(a.recordingUrl)}`
                            : null,
                        }))}
                      />
                    </div>
                  )}

                  {/* Bottom: History timeline */}
                  {sessions.length > 0 && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                      <h3 className="text-sm font-medium text-gray-400 mb-4">Session History</h3>
                      <HistoryTimeline
                        sessions={sessions.filter((s) => s.status === "COMPLETED").map((s) => ({
                          id: s.id,
                          date: s.date,
                          overallScore: s.overallScore !== null ? Math.round(s.overallScore * 100) : null,
                          severity: s.severity,
                        }))}
                        activeSessionId={selectedSessionId}
                        onSelect={setSelectedSessionId}
                      />
                    </div>
                  )}

                  <p className="text-xs text-gray-600 text-center italic">
                    This analysis is for caregiver awareness only and does not constitute a clinical diagnosis.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-6 py-6 space-y-6"
          >
            {/* Schedule Config */}
            <Card>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Schedule</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Daily Call Time</label>
                  <input
                    type="time"
                    value={config?.scheduledTime || "09:00"}
                    onChange={(e) => updateConfig({ scheduledTime: e.target.value })}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Questions Per Call</label>
                  <select
                    value={config?.questionsPerCall || 4}
                    onChange={(e) => updateConfig({ questionsPerCall: parseInt(e.target.value) })}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
                <Button
                  variant={config?.active ? "danger" : "primary"}
                  loading={saving}
                  disabled={!config?.active && filledCount < 10}
                  onClick={() => updateConfig({ active: !config?.active })}
                >
                  {config?.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  variant="secondary"
                  loading={triggering}
                  disabled={filledCount < 10}
                  onClick={triggerTestCall}
                >
                  Test Call Now
                </Button>
              </div>
              {!config?.active && filledCount < 10 && (
                <p className="mt-2 text-xs text-amber-600">
                  Fill in at least 10 correct answers to activate ({filledCount}/10 filled)
                </p>
              )}
              {config?.active && (
                <p className="mt-2 text-xs text-emerald-600">
                  Assessment calls active daily at {config.scheduledTime}
                </p>
              )}
            </Card>

            {/* Questions */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Questions ({filledCount}/30 answered)
                </h2>
                <Button loading={saving} onClick={saveQuestions}>
                  Save Questions
                </Button>
              </div>

              {CATEGORIES.map((cat) => (
                <div key={cat} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
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
                            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                            placeholder="Question"
                          />
                          <input
                            value={q.correctAnswer}
                            onChange={(e) => updateQuestion(i, "correctAnswer", e.target.value)}
                            className={`rounded-lg border px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
                              q.correctAnswer.trim()
                                ? "border-emerald-300 bg-[var(--success-light)]"
                                : "border-[var(--border-default)] bg-[var(--bg-primary)]"
                            }`}
                            placeholder="Correct answer"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
