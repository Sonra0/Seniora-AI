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
