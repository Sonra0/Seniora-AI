import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateReminderScript(context: {
  elderlyName: string;
  medication?: { name: string; dosage?: string; instructions?: string };
  customTask?: string;
  language: string;
  timeOfDay: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a caring, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, clear, empathetic phone reminder in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
${context.medication ? `Medication: ${context.medication.name}, Dosage: ${context.medication.dosage || "as prescribed"}. Instructions: ${context.medication.instructions || "none"}.` : ""}
${context.customTask ? `Task: ${context.customTask}` : ""}
Keep it under 4 sentences. Be warm but concise. State their name and the specific action.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
