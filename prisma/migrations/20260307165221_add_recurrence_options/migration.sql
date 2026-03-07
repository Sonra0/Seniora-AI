-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Recurrence" ADD VALUE 'EVERY_1_HOUR';
ALTER TYPE "Recurrence" ADD VALUE 'EVERY_4_HOURS';
ALTER TYPE "Recurrence" ADD VALUE 'EVERY_6_HOURS';
ALTER TYPE "Recurrence" ADD VALUE 'EVERY_8_HOURS';
ALTER TYPE "Recurrence" ADD VALUE 'EVERY_12_HOURS';
ALTER TYPE "Recurrence" ADD VALUE 'EVERY_OTHER_DAY';
ALTER TYPE "Recurrence" ADD VALUE 'WEEKLY';
ALTER TYPE "Recurrence" ADD VALUE 'MONTHLY';
