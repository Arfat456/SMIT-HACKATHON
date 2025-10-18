import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db, logout, saveAIResponse } from '../config/firebase';
import { generateResponse } from '../gemini';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

function PitchResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [pitchData, setPitchData] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [editablePitchData, setEditablePitchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    // Check for user authentication
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
    } else {
      navigate('/login');
      return;
    }

    // Check for pitch data from location state
    if (location.state?.pitchResult && location.state?.formData) {
      setPitchData(location.state.pitchResult);
      setOriginalFormData(location.state.formData);
      setEditablePitchData(location.state.pitchResult);
    } else {
      // No data found, redirect back to pitch form
      navigate('/pitch');
    }
  }, [navigate, location]);

  const handleInputChange = (field, value) => {
    setEditablePitchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegeneratePitch = async () => {
    if (!originalFormData) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Generate prompt for Gemini API
      const prompt = `Generate a startup pitch based on the following information:\n\n
        Startup Idea: ${originalFormData.startupIdea}\n
        Market Type: ${originalFormData.marketType}\n
        Region/Target Area: ${originalFormData.region}\n
        Category: ${originalFormData.category}\n
        Additional Notes: ${originalFormData.additionalNotes || 'None'}\n\n
        Please format your response with the following sections:\n
        1. Startup Name: [creative name related to the idea]\n
        2. Tagline: [catchy one-liner]\n
        3. Pitch: [2-3 paragraph pitch explaining the value proposition]\n
        4. Target Audience: [who would benefit most from this startup]\n
        5. Market Analysis: [brief analysis of the market potential]\n
        6. Competition: [overview of existing competitors]\n
        7. Improvement Tips: [suggestions to make the idea better]`;

      // Call Gemini API
      const response = await generateResponse(prompt);

      // Save the AI response to Firestore with user ID
      try {
        await saveAIResponse(prompt, response, user.uid);
      } catch (saveError) {
        console.error('Error saving AI response:', saveError);
        // Continue even if saving fails
      }

      // Parse the response
      const sections = parseGeminiResponse(response);
      setPitchData(sections);
      setEditablePitchData(sections);
      setSuccess('New pitch generated successfully!');
      
      // Show success message briefly
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'An error occurred while regenerating the pitch');
    } finally {
      setLoading(false);
    }
  };

  const parseGeminiResponse = (response) => {
    // Enhanced parsing logic to include all required sections
    const sections = {};
    
    // Extract startup name
    const nameMatch = response.match(/Startup Name:\s*([^\n]+)/);
    if (nameMatch) sections.name = nameMatch[1].trim();
    
    // Extract tagline
    const taglineMatch = response.match(/Tagline:\s*([^\n]+)/);
    if (taglineMatch) sections.tagline = taglineMatch[1].trim();
    
    // Extract pitch
    const pitchMatch = response.match(/Pitch:\s*([\s\S]*?)(?=Target Audience:|$)/);
    if (pitchMatch) sections.pitch = pitchMatch[1].trim();
    
    // Extract target audience
    const audienceMatch = response.match(/Target Audience:\s*([\s\S]*?)(?=Market Analysis:|Market Insights:|Competition:|$)/);
    if (audienceMatch) sections.targetAudience = audienceMatch[1].trim();
    
    // Extract market analysis
    const marketMatch = response.match(/Market Analysis:\s*([\s\S]*?)(?=Competition:|$)/);
    if (marketMatch) sections.marketAnalysis = marketMatch[1].trim();
    
    // Extract competition
    const competitionMatch = response.match(/Competition:\s*([\s\S]*?)(?=Improvement Tips:|$)/);
    if (competitionMatch) sections.competition = competitionMatch[1].trim();
    
    // Extract improvement tips
    const tipsMatch = response.match(/Improvement Tips:\s*([\s\S]*?)(?=$)/);
    if (tipsMatch) sections.improvementTips = tipsMatch[1].trim();
    
    // Fallbacks for older response formats
    if (!sections.marketAnalysis) {
      const marketInsightsMatch = response.match(/Market Insights:\s*([\s\S]*?)(?=Niche Advantage:|Competition:|$)/);
      if (marketInsightsMatch) sections.marketAnalysis = marketInsightsMatch[1].trim();
    }
    
    if (!sections.competition && !sections.improvementTips) {
      const nicheMatch = response.match(/Niche Advantage:\s*([\s\S]*?)(?=$)/);
      if (nicheMatch) sections.improvementTips = nicheMatch[1].trim();
    }
    
    return sections;
  };

  const handleSavePitch = async () => {
    if (!editablePitchData || !user) {
      setError('No pitch data or user found. Please try again.');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      // Save to user's pitches collection
      const docRef = await addDoc(collection(db, `users/${user.uid}/pitches`), {
        ...editablePitchData,
        originalIdea: originalFormData,
        createdAt: new Date(),
        isEdited: JSON.stringify(pitchData) !== JSON.stringify(editablePitchData),
        userId: user.uid,
        userEmail: user.email
      });
      
      console.log('Pitch saved with ID:', docRef.id);
      setSuccess('Pitch saved successfully!');
      
      // Show toast notification
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error saving pitch:', error);
      setError('Failed to save pitch: ' + (error.message || 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsPdf = () => {
    setGeneratingPdf(true);
    
    // Get the content to convert to PDF
    const element = document.getElementById('pitch-content');
    
    // Configure html2pdf options
    const opt = {
      margin: 10,
      filename: 'StartupPitch.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate PDF
    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        setSuccess('PDF generated successfully!');
        setTimeout(() => setSuccess(''), 3000);
        setGeneratingPdf(false);
      })
      .catch(err => {
        console.error('PDF generation error:', err);
        setError('Failed to generate PDF. Please try again.');
        setGeneratingPdf(false);
      });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleGoBack = () => {
    navigate('/pitch');
  };

  if (!editablePitchData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800">
      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-md shadow-lg z-50 animate-fade-in">
          ✅ Pitch saved successfully!
        </div>
      )}
      
      {/* Header with logout */}
      <header className="bg-white shadow-md p-4 bg-gradient-to-r from-blue-500 to-blue-600">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">PitchCraft</h1>
          {user && (
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
              >
                <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto py-8 px-4" id="pitch-content">
        <div className="max-w-5xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-10 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-blue-700">🎯 Your AI-Generated Startup Pitch</h1>
            <p className="text-lg text-slate-600">Here's what Gemini suggests for your idea. Feel free to edit any section.</p>
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

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-fade-in">
            {/* Startup Name Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-blue-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-blue-600 mb-2">🧩 Startup Name</h3>
              <textarea
                value={editablePitchData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl font-bold"
                rows="2"
              />
            </div>
            
            {/* Tagline Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-green-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-green-600 mb-2">💬 Idea Summary</h3>
              <textarea
                value={editablePitchData.tagline || ''}
                onChange={(e) => handleInputChange('tagline', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xl italic"
                rows="2"
              />
            </div>
            
            {/* Pitch Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow md:col-span-2 border-t-4 border-purple-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-purple-600 mb-2">📜 Pitch</h3>
              <textarea
                value={editablePitchData.pitch || ''}
                onChange={(e) => handleInputChange('pitch', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="6"
              />
            </div>
            
            {/* Target Audience Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-yellow-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-yellow-600 mb-2">🎯 Target Audience</h3>
              <textarea
                value={editablePitchData.targetAudience || ''}
                onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
              />
            </div>
            
            {/* Market Analysis Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-red-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-red-600 mb-2">📊 Market Analysis</h3>
              <textarea
                value={editablePitchData.marketAnalysis || ''}
                onChange={(e) => handleInputChange('marketAnalysis', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
                placeholder="Market analysis and potential..."
              />
            </div>
            
            {/* Competition Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-orange-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-orange-600 mb-2">🥊 Competition</h3>
              <textarea
                value={editablePitchData.competition || ''}
                onChange={(e) => handleInputChange('competition', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="4"
                placeholder="Overview of existing competitors..."
              />
            </div>
            
            {/* Improvement Tips Card */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow md:col-span-2 border-t-4 border-teal-500 animate-slide-up">
              <h3 className="text-lg font-semibold text-teal-600 mb-2">💡 Improvement Tips</h3>
              <textarea
                value={editablePitchData.improvementTips || ''}
                onChange={(e) => handleInputChange('improvementTips', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Suggestions to make the idea better..."
              />
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 animate-fade-in">
            <button
              onClick={handleGoBack}
              className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-medium flex items-center transition-colors"
            >
              <span className="mr-2">←</span> Go Back
            </button>
            
            <button
              onClick={handleRegeneratePitch}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Regenerating...
                </span>
              ) : (
                <>
                  <span className="mr-2">🌀</span> Regenerate Pitch
                </>
              )}
            </button>
            
            <button
              onClick={handleSaveAsPdf}
              disabled={generatingPdf}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-md font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPdf ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating PDF...
                </span>
              ) : (
                <>
                  <span className="mr-2">📄</span> Save as PDF
                </>
              )}
            </button>
            
            <button
              onClick={handleSavePitch}
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  <span className="mr-2">💾</span> Save Pitch
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        .animate-slide-up {
          animation: slideUp 0.5s ease-out;
          animation-fill-mode: both;
        }
        
        .animate-slide-up:nth-child(1) { animation-delay: 0.1s; }
        .animate-slide-up:nth-child(2) { animation-delay: 0.2s; }
        .animate-slide-up:nth-child(3) { animation-delay: 0.3s; }
        .animate-slide-up:nth-child(4) { animation-delay: 0.4s; }
        .animate-slide-up:nth-child(5) { animation-delay: 0.5s; }
        .animate-slide-up:nth-child(6) { animation-delay: 0.6s; }
        .animate-slide-up:nth-child(7) { animation-delay: 0.7s; }
      `}</style>
    </div>
  );
}

export default PitchResult;