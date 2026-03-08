-- AlterTable: Add Telegram fields to Caregiver
ALTER TABLE "Caregiver" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Caregiver" ADD COLUMN "linkCode" TEXT;
ALTER TABLE "Caregiver" ADD COLUMN "linkCodeExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Caregiver_telegramChatId_key" ON "Caregiver"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Caregiver_linkCode_key" ON "Caregiver"("linkCode");

-- CreateTable
CREATE TABLE "TelegramConversation" (
    "id" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "caregiverId" TEXT,
    "elderlyProfileId" TEXT,
    "intent" TEXT NOT NULL DEFAULT 'NONE',
    "state" JSONB,
    "lastUserMessage" TEXT,
    "lastAssistantMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConversation_telegramChatId_key" ON "TelegramConversation"("telegramChatId");

-- AddForeignKey
ALTER TABLE "TelegramConversation" ADD CONSTRAINT "TelegramConversation_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramConversation" ADD CONSTRAINT "TelegramConversation_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
