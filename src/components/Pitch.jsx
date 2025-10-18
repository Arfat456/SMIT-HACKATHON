import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, logout, saveAIResponse } from '../config/firebase';
import { generateResponse } from '../gemini';
import { collection, addDoc } from 'firebase/firestore';

function Pitch() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    startupIdea: '',
    marketType: 'Local',
    region: '',
    category: 'Tech',
    additionalNotes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pitchResult, setPitchResult] = useState(null);
  const [savingPitch, setSavingPitch] = useState(false);

  useEffect(() => {
    // Get current user
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPitchResult(null);

    // Validate inputs
    if (!formData.startupIdea || !formData.region) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Save idea to Firestore
      if (user) {
        await addDoc(collection(db, `users/${user.uid}/ideas`), {
          ...formData,
          createdAt: new Date()
        });
      }

      // Generate prompt for Gemini API
      const prompt = `Generate a startup pitch based on the following information:\n\n
        Startup Idea: ${formData.startupIdea}\n
        Market Type: ${formData.marketType}\n
        Region/Target Area: ${formData.region}\n
        Category: ${formData.category}\n
        Additional Notes: ${formData.additionalNotes || 'None'}\n\n
        Please format your response with the following sections:\n
        1. Startup Name: [creative name related to the idea]\n
        2. Tagline: [catchy one-liner]\n
        3. Pitch: [2-3 paragraph pitch explaining the value proposition]\n
        4. Target Audience: [who would benefit most from this startup]\n
        5. Landing Page Idea: [brief concept for a landing page]`;

      // Call Gemini API
      const response = await generateResponse(prompt);

      // Parse the response
      const sections = parseGeminiResponse(response);
      setPitchResult(sections);
      
      // Save the AI response to Firestore with user ID
      try {
        await saveAIResponse(prompt, response, user.uid);
      } catch (saveError) {
        console.error('Error saving AI response:', saveError);
        // Continue even if saving fails
      }
      
      setSuccess('Pitch generated successfully!');
      
      // Redirect to PitchResult page with the data
      navigate('/pitch-result', {
        state: {
          pitchResult: sections,
          formData: formData
        }
      });
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'An error occurred while generating the pitch');
    } finally {
      setLoading(false);
    }
  };

  const parseGeminiResponse = (response) => {
    // Simple parsing logic - can be enhanced for better accuracy
    const sections = {};
    
    // Extract startup name
    const nameMatch = response.match(/Startup Name:\s*([^\n]+)/);
    if (nameMatch) sections.name = nameMatch[1].trim();
    
    // Extract tagline
    const taglineMatch = response.match(/Tagline:\s*([^\n]+)/);
    if (taglineMatch) sections.tagline = taglineMatch[1].trim();
    
    // Extract pitch (more complex - get everything between Pitch: and Target Audience:)
    const pitchMatch = response.match(/Pitch:\s*([\s\S]*?)(?=Target Audience:|$)/);
    if (pitchMatch) sections.pitch = pitchMatch[1].trim();
    
    // Extract target audience
    const audienceMatch = response.match(/Target Audience:\s*([\s\S]*?)(?=Landing Page Idea:|$)/);
    if (audienceMatch) sections.targetAudience = audienceMatch[1].trim();
    
    // Extract landing page idea
    const landingPageMatch = response.match(/Landing Page Idea:\s*([\s\S]*?)(?=$)/);
    if (landingPageMatch) sections.landingPage = landingPageMatch[1].trim();
    
    return sections;
  };

  const handleSavePitch = async () => {
    if (!pitchResult) return;
    
    setSavingPitch(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/pitches`), {
        ...pitchResult,
        originalIdea: formData,
        createdAt: new Date()
      });
      setSuccess('Pitch saved to your account!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving pitch:', error);
      setError('Failed to save pitch. Please try again.');
    } finally {
      setSavingPitch(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header with logout */}
      <header className="bg-white shadow-sm p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">PitchCraft</h1>
          {user && (
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">🎯 PitchCraft – Your AI Startup Partner</h1>
            <p className="text-lg text-slate-600">Turn your startup idea into a real investor-ready pitch.</p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 animate-fade-in">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 animate-fade-in">
              {success}
            </div>
          )}

          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="startupIdea" className="block text-sm font-medium text-slate-700 mb-1">
                  Startup Idea *
                </label>
                <textarea
                  id="startupIdea"
                  name="startupIdea"
                  rows="4"
                  value={formData.startupIdea}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your startup idea in detail..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="marketType" className="block text-sm font-medium text-slate-700 mb-1">
                    Market Type *
                  </label>
                  <select
                    id="marketType"
                    name="marketType"
                    value={formData.marketType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="Local">Local</option>
                    <option value="National">National</option>
                    <option value="International">International</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="region" className="block text-sm font-medium text-slate-700 mb-1">
                    Region / Target Area *
                  </label>
                  <input
                    type="text"
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., North America, Europe, Asia"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="Tech">Tech</option>
                  <option value="Health">Health</option>
                  <option value="Education">Education</option>
                  <option value="Finance">Finance</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="additionalNotes" className="block text-sm font-medium text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="additionalNotes"
                  name="additionalNotes"
                  rows="3"
                  value={formData.additionalNotes}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional information that might help generate a better pitch..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Pitch...
                    </span>
                  ) : (
                    'Generate Pitch'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Results Section */}
          {pitchResult && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-center mb-6">Your AI-Generated Pitch</h2>
              
              {/* Startup Name Card */}
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Startup Name</h3>
                <p className="text-2xl font-bold">{pitchResult.name}</p>
              </div>
              
              {/* Tagline Card */}
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Tagline</h3>
                <p className="text-xl italic">{pitchResult.tagline}</p>
              </div>
              
              {/* Pitch Card */}
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Pitch</h3>
                <div className="whitespace-pre-line">{pitchResult.pitch}</div>
              </div>
              
              {/* Target Audience Card */}
              <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold text-blue-600 mb-2">Target Audience</h3>
                <div className="whitespace-pre-line">{pitchResult.targetAudience}</div>
              </div>
              
              {/* Landing Page Idea Card */}
              {pitchResult.landingPage && (
                <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-semibold text-blue-600 mb-2">Landing Page Idea</h3>
                  <div className="whitespace-pre-line">{pitchResult.landingPage}</div>
                </div>
              )}
              
              {/* Save Button */}
              <div className="mt-8 text-center">
                <button
                  onClick={handleSavePitch}
                  disabled={savingPitch}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-8 rounded-md shadow transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPitch ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Pitch to Firestore'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Pitch;