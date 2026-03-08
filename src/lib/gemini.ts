import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateReminderScript(context: {
  elderlyName: string;
  medication?: { name: string; dosage?: string; instructions?: string };
  customTask?: string;
  language: string;
  timeOfDay: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a caring, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, clear, empathetic phone reminder in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
${context.medication ? `Medication: ${context.medication.name}, Dosage: ${context.medication.dosage || "as prescribed"}. Instructions: ${context.medication.instructions || "none"}.` : ""}
${context.customTask ? `Task: ${context.customTask}` : ""}
Keep it under 4 sentences. Be warm but concise. State their name and the specific action.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateAssessmentGreeting(context: {
  elderlyName: string;
  language: string;
  timeOfDay: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a caring, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, friendly greeting for a daily cognitive check-in call in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
Mention you'd like to ask a few simple questions to chat and check in on them.
Keep it under 3 sentences. Be warm and natural, not clinical.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateAssessmentQuestionAudio(context: {
  elderlyName: string;
  questionText: string;
  questionNumber: number;
  totalQuestions: number;
  language: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are having a warm phone conversation with ${context.elderlyName}.
Ask them this question naturally in ${context.language === "ar" ? "Arabic" : "English"}: "${context.questionText}"
This is question ${context.questionNumber} of ${context.totalQuestions}.
${context.questionNumber > 1 ? "Add a brief natural transition like 'Now...' or 'Next one...' or 'Okay...'" : ""}
Keep it to 1-2 sentences max. Be conversational, not like a test.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function evaluateAssessmentAnswer(context: {
  questionText: string;
  correctAnswer: string;
  elderAnswer: string;
  language: string;
}): Promise<{ result: "CORRECT" | "WRONG" | "UNCLEAR"; response: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are evaluating an elderly person's answer to a cognitive assessment question.

Question: "${context.questionText}"
Correct answer: "${context.correctAnswer}"
Elder's spoken answer (transcribed): "${context.elderAnswer}"

1. Determine if the answer is CORRECT, WRONG, or UNCLEAR (couldn't understand / no real answer).
   - Be lenient: partial matches, close approximations, or synonyms count as CORRECT.
   - For dates, accept different formats (e.g. "March 5" = "5th of March" = "3/5").
   - For names, accept nicknames or partial names.

2. Generate a short, warm response in ${context.language === "ar" ? "Arabic" : "English"}:
   - If CORRECT: Brief affirmation like "That's right!" or "Exactly!" (1 sentence)
   - If WRONG: Gently remind the correct answer, e.g. "Actually, it's [answer]. No worries!" (1-2 sentences)
   - If UNCLEAR: Say something like "I didn't quite catch that, but that's okay." (1 sentence)

Respond in this exact JSON format only, no markdown:
{"result": "CORRECT", "response": "That's right!"}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateAssessmentClosing(context: {
  elderlyName: string;
  score: number;
  totalQuestions: number;
  language: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are ending a cognitive check-in phone call with ${context.elderlyName}.
They answered ${context.score} out of ${context.totalQuestions} questions correctly.
Generate a warm, encouraging closing in ${context.language === "ar" ? "Arabic" : "English"}.
${context.score === context.totalQuestions ? "They did perfectly — celebrate!" : context.score >= context.totalQuestions * 0.75 ? "They did great — be positive." : "Be extra encouraging and supportive, never discouraging."}
Keep it under 3 sentences. End with a goodbye.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export interface VocalAnalysis {
  parkinsons: {
    currentProbability: number;
    futureRisk: number;
    details: string;
  };
  depression: {
    currentState: number;
    futurePropensity: number;
    details: string;
  };
  mood: {
    todayMood: string;
    wellnessScore: number;
    details: string;
  };
}

export async function analyzeVocalBiomarkers(
  audioBuffers: Buffer[],
  elderlyName: string
): Promise<VocalAnalysis> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const audioParts = audioBuffers.map((buf) => ({
    inlineData: { mimeType: "audio/mpeg" as const, data: buf.toString("base64") },
  }));

  const prompt = `You are a clinical vocal biomarker analysis system. Analyze the provided audio recordings of an elderly person named ${elderlyName} during a cognitive assessment call. Perform a multi-dimensional vocal and psychological assessment.

Analyze these specific criteria:

1. **Parkinson's Disease Risk Assessment:**
   - Analyze vocal tremors, speech fluidity, and micro-perturbations.
   - Current Probability: The likelihood (0-100%) that Parkinsonian symptoms are currently present.
   - Future Risk: The statistical probability (0-100%) of developing Parkinson's in the future based on current vocal biomarkers.
   - Provide a brief clinical note.

2. **Depression & Mental Health Analysis:**
   - Analyze pitch variance, speech rate, and acoustic energy (prosody).
   - Current State: The estimated percentage (0-100%) of clinical depression indicators present in the voice now.
   - Future Propensity: The likelihood (0-100%) of developing depressive episodes in the future based on vocal patterns.
   - Provide a brief clinical note.

3. **Mood and Sentiment Analysis:**
   - Analyze the overall tone, inflection, and emotional resonance of the speech.
   - Identify the user's specific Mood for today (e.g., Calm, Energetic, Reflective, Anxious, Content, Tired).
   - Assign a Wellness Score from 1 to 100. Use an optimistic bias — highlight positive nuances and avoid unnecessarily low ratings unless vocal distress is severe.
   - Provide a brief note on observed emotional patterns.

IMPORTANT: This is for caregiver awareness only, not clinical diagnosis. Be balanced and avoid alarming language.

Respond in this exact JSON format only, no markdown:
{"parkinsons":{"currentProbability":5,"futureRisk":8,"details":"..."},"depression":{"currentState":10,"futurePropensity":12,"details":"..."},"mood":{"todayMood":"Calm","wellnessScore":78,"details":"..."}}`;

  const result = await model.generateContent([{ text: prompt }, ...audioParts]);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateAssessmentSummary(context: {
  elderlyName: string;
  date: string;
  answers: { questionText: string; correctAnswer: string; elderAnswer: string | null; result: string }[];
  language: string;
}): Promise<{ summary: string; severity: "GREEN" | "YELLOW" | "RED" }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const correct = context.answers.filter((a) => a.result === "CORRECT").length;
  const total = context.answers.length;
  const score = total > 0 ? correct / total : 0;

  const prompt = `You are generating a caregiver report for ${context.elderlyName}'s daily cognitive assessment on ${context.date}.

Results:
${context.answers.map((a, i) => `${i + 1}. Q: "${a.questionText}" | Correct: "${a.correctAnswer}" | Answer: "${a.elderAnswer || "no response"}" | Result: ${a.result}`).join("\n")}

Score: ${correct}/${total} (${Math.round(score * 100)}%)

Write a brief 2-3 sentence summary for the caregiver in English. Be clinical but compassionate.
Note specific areas of strength or concern (e.g. "remembered all family names but struggled with dates").

Respond in this exact JSON format only, no markdown:
{"summary": "...", "severity": "${score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED"}"}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Care command parsing (used by WhatsApp & Telegram assistants)
// ---------------------------------------------------------------------------

export type CareCommandIntent = "REMINDER" | "MEDICATION" | "ASSESSMENT" | "VIEW" | "EDIT" | "DELETE" | "CANCEL" | "UNKNOWN";

// Alias for backward compat with WhatsApp
export type WhatsAppIntentParse = CareCommandIntent;

export interface ParsedCareCommand {
  intent: CareCommandIntent;
  elderlyName?: string | null;
  title?: string | null;
  description?: string | null;
  name?: string | null;
  dosage?: string | null;
  instructions?: string | null;
  scheduledTime?: string | null;
  scheduledDate?: string | null;
  recurrence?: string | null;
  daysOfWeek?: number[] | null;
  leadTimeMinutes?: number | null;
  viewTarget?: "reminders" | "medications" | "assessments" | "logs" | null;
  editTarget?: string | null;
  editFields?: Record<string, string> | null;
  deleteTarget?: string | null;
}

// Alias for backward compat with WhatsApp
export type WhatsAppParsedCommand = ParsedCareCommand;

export async function parseCareCommand(params: {
  message: string;
  pendingIntent?: string;
}): Promise<ParsedCareCommand> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are parsing a caregiver's message about managing an elderly person's care.

Message: "${params.message}"
${params.pendingIntent ? `Current pending task type: ${params.pendingIntent} (the user may be providing additional details for this task)` : ""}

Determine the intent and extract structured information.

Possible intents:
- REMINDER: Creating a custom reminder (e.g. "remind mom to drink water at 3pm")
- MEDICATION: Adding a medication with schedule (e.g. "add aspirin 100mg daily at 8am")
- ASSESSMENT: Scheduling cognitive assessment (e.g. "schedule assessment at 9am")
- VIEW: Viewing/checking existing items (e.g. "show reminders", "what medications", "last assessment results", "call history")
- EDIT: Modifying existing items (e.g. "change aspirin time to 9am", "pause morning reminder", "update dosage")
- DELETE: Removing items (e.g. "remove aspirin", "delete the morning reminder", "cancel assessment")
- CANCEL: User wants to cancel current conversation/task (e.g. "cancel", "stop", "never mind")
- UNKNOWN: Cannot determine intent

For VIEW intent, set viewTarget to one of: "reminders", "medications", "assessments", "logs"
For EDIT intent, set editTarget to a description of what to edit, and editFields to the changes
For DELETE intent, set deleteTarget to a description of what to delete

Extract any fields you can identify:
- elderlyName: the name of the elderly person mentioned
- title: reminder title
- description: reminder description
- name: medication name
- dosage: medication dosage
- instructions: medication instructions
- scheduledTime: time in HH:MM 24-hour format (convert from AM/PM if needed)
- scheduledDate: date in YYYY-MM-DD format
- recurrence: one of NONE, EVERY_1_HOUR, EVERY_4_HOURS, EVERY_6_HOURS, EVERY_8_HOURS, EVERY_12_HOURS, DAILY, EVERY_OTHER_DAY, WEEKLY, MONTHLY, SPECIFIC_DAYS
- daysOfWeek: array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
- leadTimeMinutes: how many minutes before the scheduled time to remind

Respond in JSON only, no markdown:
{"intent":"REMINDER","elderlyName":null,"title":"drink water","description":null,"name":null,"dosage":null,"instructions":null,"scheduledTime":"15:00","scheduledDate":null,"recurrence":"DAILY","daysOfWeek":null,"leadTimeMinutes":null,"viewTarget":null,"editTarget":null,"editFields":null,"deleteTarget":null}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

// Alias for backward compatibility with WhatsApp
export const parseWhatsAppCareCommand = parseCareCommand;

// ---------------------------------------------------------------------------
// Audio transcription via Gemini multimodal
// ---------------------------------------------------------------------------

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    { text: "Transcribe this audio message. Return ONLY the transcribed text, nothing else. If you cannot understand the audio, respond with just the word UNCLEAR." },
    {
      inlineData: {
        mimeType: mimeType as "audio/ogg" | "audio/mpeg" | "audio/wav" | "audio/webm",
        data: audioBuffer.toString("base64"),
      },
    },
  ]);

  return result.response.text().trim();
}
