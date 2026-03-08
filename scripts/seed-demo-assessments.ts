/**
 * Seed 30 days of assessment history for demo purposes.
 *
 * Usage: npx tsx scripts/seed-demo-assessments.ts <elderlyProfileId>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickSeverity(score: number): "GREEN" | "YELLOW" | "RED" {
  if (score >= 0.7) return "GREEN";
  if (score >= 0.4) return "YELLOW";
  return "RED";
}

const SUMMARIES = [
  "Good cognitive performance today. Memory recall was strong across all categories.",
  "Slightly below average performance. Struggled with orientation questions.",
  "Excellent session. Quick and confident responses throughout.",
  "Mixed results. Personal memory strong but general knowledge weaker.",
  "Below average today. May indicate fatigue or distraction.",
  "Very strong performance. Improvement noted compared to recent sessions.",
  "Average session. Consistent with recent trend.",
  "Some difficulty with people recognition questions today.",
  "Strong start but performance declined toward the end.",
  "Notable improvement in orientation questions compared to last week.",
];

const MOODS = ["Happy", "Content", "Calm", "Neutral", "Tired", "Slightly anxious", "Good spirits", "Relaxed"];

async function main() {
  const profileId = process.argv[2];
  if (!profileId) {
    console.error("Usage: npx tsx scripts/seed-demo-assessments.ts <elderlyProfileId>");
    process.exit(1);
  }

  // Verify profile exists
  const profile = await prisma.elderlyProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    console.error(`Profile ${profileId} not found`);
    process.exit(1);
  }

  // Get or create config
  let config = await prisma.assessmentConfig.findUnique({
    where: { elderlyProfileId: profileId },
  });
  if (!config) {
    config = await prisma.assessmentConfig.create({
      data: {
        elderlyProfileId: profileId,
        scheduledTime: "09:00",
        questionsPerCall: 4,
        active: true,
      },
    });
  }

  // Get questions
  const questions = await prisma.assessmentQuestion.findMany({
    where: { elderlyProfileId: profileId },
  });
  if (questions.length < 4) {
    console.error(`Profile needs at least 4 questions, has ${questions.length}. Set up questions first.`);
    process.exit(1);
  }

  console.log(`Seeding 30 days of assessments for "${profile.name}" (${profileId})...`);

  // Create a slight upward trend with some variance
  const baseScore = 0.55; // start around 55%
  const dailyImprovement = 0.008; // ~0.8% improvement per day

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(9, 0, 0, 0);
    const dateStr = date.toISOString().split("T")[0];

    // Skip ~20% of days randomly (weekends, missed calls)
    if (Math.random() < 0.15 && daysAgo > 2) continue;

    const dayIndex = 30 - daysAgo;
    const trendScore = Math.min(0.95, baseScore + dailyImprovement * dayIndex);
    const noise = randomBetween(-0.12, 0.12);
    const overallScore = Math.max(0.15, Math.min(1.0, trendScore + noise));
    const severity = pickSeverity(overallScore);

    // Vocal analysis with correlated values
    const wellnessScore = Math.round(Math.max(10, Math.min(100, overallScore * 100 + randomBetween(-15, 15))));
    const moodScore = Math.round(Math.max(10, Math.min(100, wellnessScore + randomBetween(-10, 10))));
    const depressionIndex = Math.round(Math.max(5, Math.min(80, 100 - wellnessScore + randomBetween(-10, 15))));
    const parkinsonsRisk = Math.round(Math.max(3, Math.min(50, 20 + randomBetween(-10, 15))));
    const speechFluency = Math.round(Math.max(30, Math.min(100, overallScore * 100 + randomBetween(-8, 12))));

    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];

    const vocalAnalysis = {
      parkinsons: {
        currentProbability: parkinsonsRisk,
        futureRisk: Math.round(parkinsonsRisk + randomBetween(2, 10)),
        details: parkinsonsRisk > 30
          ? "Slight vocal tremor detected in sustained vowels."
          : "Voice patterns within normal range.",
      },
      depression: {
        currentState: depressionIndex,
        futurePropensity: Math.round(depressionIndex + randomBetween(-5, 10)),
        details: depressionIndex > 40
          ? "Reduced vocal energy and slower speech rate noted."
          : "Vocal markers suggest stable emotional state.",
      },
      mood: {
        todayMood: mood,
        wellnessScore,
        details: `Overall ${mood.toLowerCase()} demeanor during the call.`,
      },
      // Flat keys for radar chart
      parkinsonsRisk,
      depressionIndex,
      wellnessScore,
      moodScore,
      speechFluency,
    };

    const summary = SUMMARIES[Math.floor(Math.random() * SUMMARIES.length)];

    // Pick 4 random questions for this session
    const sessionQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, 4);

    const session = await prisma.assessmentSession.create({
      data: {
        elderlyProfileId: profileId,
        configId: config.id,
        date: dateStr,
        overallScore,
        status: "COMPLETED",
        summary,
        severity,
        vocalAnalysis,
        emotionalResponse: overallScore > 0.6 ? "Positive and engaged" : "Somewhat subdued",
        createdAt: date,
        answers: {
          create: sessionQuestions.map((q, i) => {
            const isCorrect = Math.random() < overallScore;
            return {
              questionId: q.id,
              questionText: q.questionText,
              correctAnswer: q.correctAnswer,
              elderAnswer: isCorrect ? q.correctAnswer : (Math.random() < 0.3 ? null : "I'm not sure"),
              result: isCorrect ? "CORRECT" : (Math.random() < 0.2 ? "UNCLEAR" : "WRONG"),
              orderIndex: i,
              createdAt: date,
            };
          }),
        },
      },
    });

    console.log(`  ${dateStr}: ${Math.round(overallScore * 100)}% (${severity}) - ${session.id}`);
  }

  console.log("\nDone! Assessment history seeded.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
