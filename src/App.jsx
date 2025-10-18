import { useState } from "react";
import { generateResponse } from "./gemini";
import { saveAIResponse } from "./config/firebase";


function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Please enter a prompt first!");
    setLoading(true);
    const aiResponse = await generateResponse(prompt);
    setResult(aiResponse);
    await saveAIResponse(prompt, aiResponse);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">⚡ Gemini AI Pitch Generator</h1>

      <textarea
        className="w-full max-w-lg p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none mb-4"
        rows="4"
        placeholder="Enter your startup idea prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={handleGenerate}
        className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Pitch"}
      </button>

      {result && (
        <div className="mt-6 w-full max-w-lg p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-lg font-semibold text-green-400 mb-2">Gemini Response:</h2>
          <p className="whitespace-pre-line">{result}</p>
        </div>
      )}
    </div>
  );
}

export default App;
