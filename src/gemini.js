import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// ✅ Use correct model name
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function generateResponse(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Gemini Response:", text);
    return text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}
