import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sessions = await prisma.assessmentSession.findMany({
    where: {
      elderlyProfileId: id,
      status: "COMPLETED",
      createdAt: { gte: thirtyDaysAgo },
    },
    include: { answers: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  // Build trend arrays
  const dates: string[] = [];
  const scores: (number | null)[] = [];
  const severities: (string | null)[] = [];
  const wellnessScores: (number | null)[] = [];
  const depressionIndices: (number | null)[] = [];
  const moodScores: (number | null)[] = [];

  // Vocal biomarker radar data (from latest session with vocalAnalysis)
  let latestVocal: Record<string, number> | null = null;

  // Heatmap: weekly mood data
  const heatmapData: { day: string; week: number; value: number }[] = [];

  for (const session of sessions) {
    const dateStr = new Date(session.createdAt).toISOString().split("T")[0];
    dates.push(dateStr);
    scores.push(session.overallScore);
    severities.push(session.severity);

    // Extract vocal analysis data if present
    const vocal = session.vocalAnalysis as Record<string, unknown> | null;
    if (vocal) {
      wellnessScores.push(
        typeof vocal.wellnessScore === "number" ? vocal.wellnessScore : null
      );
      depressionIndices.push(
        typeof vocal.depressionIndex === "number"
          ? vocal.depressionIndex
          : null
      );
      moodScores.push(
        typeof vocal.moodScore === "number" ? vocal.moodScore : null
      );

      // Keep track of latest vocal data for radar chart
      const radarData: Record<string, number> = {};
      if (typeof vocal.parkinsonsRisk === "number")
        radarData.parkinsons = vocal.parkinsonsRisk;
      if (typeof vocal.depressionIndex === "number")
        radarData.depression = vocal.depressionIndex;
      if (typeof vocal.wellnessScore === "number")
        radarData.wellness = vocal.wellnessScore;
      if (typeof vocal.moodScore === "number")
        radarData.mood = vocal.moodScore;
      if (typeof vocal.speechFluency === "number")
        radarData.speechFluency = vocal.speechFluency;
      latestVocal = radarData;
    } else {
      wellnessScores.push(null);
      depressionIndices.push(null);
      moodScores.push(null);
    }

    // Heatmap data
    const d = new Date(session.createdAt);
    const weekNum = Math.floor(
      (d.getTime() - thirtyDaysAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      d.getDay()
    ];
    const wellnessVal =
      typeof (vocal as Record<string, unknown> | null)?.wellnessScore ===
      "number"
        ? ((vocal as Record<string, unknown>).wellnessScore as number)
        : session.overallScore ?? 0;
    heatmapData.push({ day: dayName, week: weekNum, value: wellnessVal });
  }

  // Compute trend direction from last 7 scores
  let trend: "improving" | "declining" | "stable" = "stable";
  const recentScores = scores.filter((s) => s !== null).slice(-7);
  if (recentScores.length >= 3) {
    const first = recentScores.slice(0, Math.ceil(recentScores.length / 2));
    const second = recentScores.slice(Math.ceil(recentScores.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
    const diff = avgSecond - avgFirst;
    if (diff > 5) trend = "improving";
    else if (diff < -5) trend = "declining";
  }

  // Latest session for detail view
  const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  return NextResponse.json({
    trend,
    trends: {
      dates,
      scores,
      severities,
      wellnessScores,
      depressionIndices,
      moodScores,
    },
    vocalRadar: latestVocal,
    heatmap: heatmapData,
    latestSession: latestSession
      ? {
          id: latestSession.id,
          date: latestSession.date,
          overallScore: latestSession.overallScore,
          severity: latestSession.severity,
          summary: latestSession.summary,
          emotionalResponse: latestSession.emotionalResponse,
          vocalAnalysis: latestSession.vocalAnalysis,
          answers: latestSession.answers,
        }
      : null,
    sessionCount: sessions.length,
  });
}
