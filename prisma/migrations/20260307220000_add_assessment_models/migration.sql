-- CreateEnum
CREATE TYPE "AssessmentCategory" AS ENUM ('PERSONAL', 'ORIENTATION', 'PEOPLE', 'GENERAL');
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "AssessmentSeverity" AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE "AnswerResult" AS ENUM ('CORRECT', 'WRONG', 'UNCLEAR');

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "category" "AssessmentCategory" NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentConfig" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "questionsPerCall" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "severity" "AssessmentSeverity",
    "twilioCallSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "elderAnswer" TEXT,
    "result" "AnswerResult",
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentConfig_elderlyProfileId_key" ON "AssessmentConfig"("elderlyProfileId");

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfig" ADD CONSTRAINT "AssessmentConfig_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AssessmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
