# Alzheimer's Cognitive Assessment — Design

## Overview

Daily automated phone calls to elderly individuals with personalized cognitive questions. Caregivers set up a question bank with correct answers, pick a daily call time, and the system calls the elder, asks 3-4 questions conversationally, corrects wrong answers gently, and generates a daily report with trend tracking.

## Database Models

### AssessmentQuestion
- id, elderlyProfileId
- category: PERSONAL | ORIENTATION | PEOPLE | GENERAL
- questionText, correctAnswer
- Linked to ElderlyProfile

### AssessmentConfig
- id, elderlyProfileId (unique)
- scheduledTime (HH:MM string)
- active (boolean, default false)
- questionsPerCall (int, default 4)

### AssessmentSession
- id, elderlyProfileId, configId
- date, overallScore (float)
- status: PENDING | IN_PROGRESS | COMPLETED | FAILED
- summary (Gemini-generated text)
- severity: GREEN | YELLOW | RED
- createdAt

### AssessmentAnswer
- id, sessionId, questionId
- questionText, correctAnswer, elderAnswer (transcribed)
- result: CORRECT | WRONG | UNCLEAR
- recordingUrl
- createdAt

## Call Flow

1. Cron detects due assessment -> creates session with status PENDING
2. Picks 3-4 random questions from the elder's question bank
3. Generates greeting via Gemini, converts to ElevenLabs audio
4. Creates Twilio call to elder

Per-question loop (webhook-driven):
1. Play question audio (ElevenLabs)
2. `<Record>` elder's answer (max 15s, silence detection)
3. Webhook receives recording -> immediately play random filler audio ("Hmm, okay...")
4. Background processing: transcribe answer -> Gemini evaluates correctness
5. Generate response audio:
   - Correct: warm affirmation ("That's right!") + next question
   - Wrong: gentle correction ("Actually, [answer]. No worries!") + next question
6. Redirect call to play response + next question

After last question:
1. Play warm closing message
2. Gemini generates summary + assigns severity (GREEN/YELLOW/RED)
3. Save all results to database

## Filler Phrases

5 pre-generated phrases per voice (created on assessment setup):
- "Hmm, let me think..."
- "Okay..."
- "Alright..."
- "I see..."
- "Mm-hmm..."

Stored as audio files in public/audio/fillers/, played randomly while processing.

## Scoring

- Per question: CORRECT / WRONG / UNCLEAR
- Overall: percentage (e.g. 3/4 = 75%)
- Severity thresholds: GREEN >= 75%, YELLOW >= 50%, RED < 50%
- Gemini generates natural-language summary per session

## UI

Single page at `/elderly/[id]/assessment`:

### Setup Section
- Questionnaire form with 30 questions (min 10 required to activate)
- Each question: category label, question text, correct answer input
- 30 default questions pre-filled (caregiver edits answers)
- Time picker for daily call schedule
- Activate/deactivate toggle

### Latest Report
- Today's score with color-coded severity badge
- Gemini summary paragraph
- Per-question breakdown: question, elder's answer, correct answer, result badge

### History
- Score trend chart (last 30 days)
- Past sessions list with date, score, severity badge
- Click to expand full session details

## Default Questions (30)

### Personal (8)
1. What is your date of birth?
2. What is your full name?
3. What is your home address?
4. What year were you born?
5. What is your phone number?
6. Where were you born?
7. What is your wedding anniversary?
8. What is your spouse's name?

### Orientation (8)
9. What day of the week is it today?
10. What month are we in?
11. What year is it?
12. What season are we in?
13. What did you have for breakfast today?
14. What time of day is it - morning, afternoon, or evening?
15. What city do you live in?
16. What is today's date?

### People (7)
17. What is your caregiver's name?
18. What is your doctor's name?
19. How many children do you have?
20. What are your children's names?
21. What is your son/daughter's birthday?
22. Who visited you last?
23. What is your best friend's name?

### General (7)
24. What country do you live in?
25. What is 5 plus 3?
26. What color is the sky?
27. How many days are in a week?
28. What do you use to brush your teeth?
29. What is the opposite of hot?
30. Name any three animals.
