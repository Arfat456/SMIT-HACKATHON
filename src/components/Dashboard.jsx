import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    // Check for user authentication
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      fetchUserData(currentUser.uid);
      fetchUserPitches(currentUser.uid);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUserData = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user profile');
    }
  };

  const fetchUserPitches = async (userId) => {
    try {
      // Fetch user's ideas
      const ideasQuery = query(
        collection(db, `users/${userId}/ideas`),
        orderBy('createdAt', 'desc')
      );
      const ideasSnapshot = await getDocs(ideasQuery);
      
      // Fetch AI responses
      const responsesQuery = query(
        collection(db, `users/${userId}/ai_responses`),
        orderBy('timestamp', 'desc')
      );
      const responsesSnapshot = await getDocs(responsesQuery);
      
      // Process ideas data
      const ideasData = [];
      ideasSnapshot.forEach((doc) => {
        const data = doc.data();
        ideasData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      
      // Process AI responses data
      const responsesData = [];
      responsesSnapshot.forEach((doc) => {
        const data = doc.data();
        responsesData.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        });
      });
      
      // Combine ideas with their responses if available
      const combinedPitches = ideasData.map(idea => {
        // Find matching response based on prompt content (simplified matching)
        const matchingResponse = responsesData.find(response => 
          response.prompt && response.prompt.includes(idea.startupIdea)
        );
        
        return {
          ...idea,
          response: matchingResponse?.response || null,
          parsedResponse: matchingResponse?.response ? parseGeminiResponse(matchingResponse.response) : null
        };
      });
      
      setPitches(combinedPitches);
    } catch (error) {
      console.error('Error fetching pitches:', error);
      setError('Failed to load pitches');
    } finally {
      setLoading(false);
    }
  };

  const parseGeminiResponse = (text) => {
    // This function parses the AI response into structured sections
    const sections = {};
    
    // Extract startup name
    const startupNameMatch = text.match(/Startup Name:?\s*([^\n]+)/i);
    if (startupNameMatch) sections.startupName = startupNameMatch[1].trim();
    
    // Extract tagline
    const taglineMatch = text.match(/Tagline:?\s*([^\n]+)/i);
    if (taglineMatch) sections.tagline = taglineMatch[1].trim();
    
    // Extract pitch (more complex as it can be multiple paragraphs)
    const pitchMatch = text.match(/Pitch:?\s*([\s\S]*?)(?=\n\s*(?:Target Audience|Market Analysis|Competition|Landing Page|Improvement|$))/i);
    if (pitchMatch) sections.pitch = pitchMatch[1].trim();
    
    // Extract target audience
    const targetMatch = text.match(/Target Audience:?\s*([\s\S]*?)(?=\n\s*(?:Market Analysis|Competition|Landing Page|Improvement|$))/i);
    if (targetMatch) sections.targetAudience = targetMatch[1].trim();
    
    // Extract market analysis if available
    const marketMatch = text.match(/Market Analysis:?\s*([\s\S]*?)(?=\n\s*(?:Competition|Landing Page|Improvement|$))/i);
    if (marketMatch) sections.marketAnalysis = marketMatch[1].trim();
    
    // Extract competition if available
    const competitionMatch = text.match(/Competition:?\s*([\s\S]*?)(?=\n\s*(?:Landing Page|Improvement|$))/i);
    if (competitionMatch) sections.competition = competitionMatch[1].trim();
    
    // Extract landing page idea
    const landingPageMatch = text.match(/Landing Page Idea:?\s*([\s\S]*?)(?=\n\s*(?:Improvement|$))/i);
    if (landingPageMatch) sections.landingPage = landingPageMatch[1].trim();
    
    // Extract improvement tips if available
    const improvementMatch = text.match(/Improvement Tips:?\s*([\s\S]*?)(?=$)/i);
    if (improvementMatch) sections.improvementTips = improvementMatch[1].trim();
    
    return sections;
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handlePitchClick = (pitch) => {
    setSelectedPitch(pitch);
    setShowModal(true);
  };

  const handleGeneratePDF = async () => {
    if (!selectedPitch || !selectedPitch.parsedResponse) return;
    
    setGeneratingPdf(true);
    
    try {
      const element = document.getElementById('pitch-pdf-content');
      
      // Format startup name for filename
      const startupName = selectedPitch.parsedResponse.startupName || 'Startup';
      const safeFileName = `Pitch_${startupName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      
      // Use a more reliable approach with explicit worker and save method
      const opt = {
        margin: 10,
        filename: safeFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // Create worker and explicitly call save()
      await html2pdf()
        .from(element)
        .set(opt)
        .save();
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">Startup Pitch Dashboard</h1>
          <div className="flex items-center space-x-4">
            {user && (
              <span className="text-sm text-gray-300">
                {user.email}
              </span>
            )}
            <button
              onClick={() => navigate('/pitch')}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Create New Pitch
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* User Profile Section */}
        <section className="mb-10 bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-300">User Profile</h2>
          {userProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400">Email:</p>
                <p className="font-medium">{userProfile.email}</p>
              </div>
              <div>
                <p className="text-gray-400">Account Created:</p>
                <p className="font-medium">{userProfile.createdAt ? formatDate(userProfile.createdAt.toDate()) : 'Unknown'}</p>
              </div>
              {userProfile.displayName && (
                <div>
                  <p className="text-gray-400">Name:</p>
                  <p className="font-medium">{userProfile.displayName}</p>
                </div>
              )}
            </div>
          ) : loading ? (
            <p className="text-gray-400">Loading profile...</p>
          ) : (
            <p className="text-gray-400">No profile information available</p>
          )}
        </section>

        {/* Pitches Section */}
        <section className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6 text-blue-300">Your Pitches</h2>
          
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-500 text-red-300 p-4 rounded-md">
              {error}
            </div>
          ) : pitches.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 mb-4">You haven't created any pitches yet.</p>
              <button
                onClick={() => navigate('/pitch')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md transition duration-200"
              >
                Create Your First Pitch
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pitches.map((pitch) => (
                <div 
                  key={pitch.id} 
                  className="bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                  onClick={() => handlePitchClick(pitch)}
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-blue-500/20 text-blue-300 text-xs font-medium px-2.5 py-0.5 rounded">
                        {pitch.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(pitch.createdAt)}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                      {pitch.parsedResponse?.startupName || pitch.startupIdea}
                    </h3>
                    
                    {pitch.parsedResponse?.tagline && (
                      <p className="text-sm text-gray-300 italic mb-3 line-clamp-2">
                        "{pitch.parsedResponse.tagline}"
                      </p>
                    )}
                    
                    <div className="text-sm text-gray-400 line-clamp-3 mb-3">
                      {pitch.startupIdea}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                      <span>{pitch.marketType}</span>
                      <span>{pitch.region}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/live-preview/${pitch.id}`);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1 px-2 rounded transition duration-200 flex items-center space-x-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Live Preview</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePitchClick(pitch);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium transition duration-200"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal for Pitch Details */}
      {showModal && selectedPitch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-blue-400">
                    {selectedPitch.parsedResponse?.startupName || selectedPitch.startupIdea}
                  </h3>
                  {selectedPitch.parsedResponse?.tagline && (
                    <p className="text-gray-300 italic mt-1">
                      {selectedPitch.parsedResponse.tagline}
                    </p>
                  )}
                </div>
                
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <span className="bg-blue-500/20 text-blue-300 text-sm font-medium px-2.5 py-0.5 rounded">
                    {selectedPitch.category}
                  </span>
                  <span className="text-sm text-gray-400">
                    Created: {formatDate(selectedPitch.createdAt)}
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => navigate(`/live-preview/${selectedPitch.id}`)}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 flex items-center space-x-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Live Preview</span>
                  </button>
                  
                  <button
                    onClick={handleGeneratePDF}
                    disabled={generatingPdf}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {generatingPdf ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Save as PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div id="pitch-pdf-content" className="bg-white text-gray-900 rounded-lg p-8">
                {/* PDF Content */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-800">
                    {selectedPitch.parsedResponse?.startupName || selectedPitch.startupIdea}
                  </h1>
                  {selectedPitch.parsedResponse?.tagline && (
                    <p className="text-xl text-gray-600 italic mt-2">
                      {selectedPitch.parsedResponse.tagline}
                    </p>
                  )}
                </div>
                
                <div className="prose max-w-none">
                  {/* Original Idea */}
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Original Idea</h2>
                    <p>{selectedPitch.startupIdea}</p>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div>
                        <span className="font-medium">Category:</span> {selectedPitch.category}
                      </div>
                      <div>
                        <span className="font-medium">Market Type:</span> {selectedPitch.marketType}
                      </div>
                      <div>
                        <span className="font-medium">Region:</span> {selectedPitch.region}
                      </div>
                      {selectedPitch.additionalNotes && (
                        <div className="col-span-2">
                          <span className="font-medium">Additional Notes:</span> {selectedPitch.additionalNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* AI Generated Pitch */}
                  {selectedPitch.parsedResponse && (
                    <>
                      {/* Pitch */}
                      {selectedPitch.parsedResponse.pitch && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Pitch</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.pitch}</div>
                        </div>
                      )}
                      
                      {/* Target Audience */}
                      {selectedPitch.parsedResponse.targetAudience && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Target Audience</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.targetAudience}</div>
                        </div>
                      )}
                      
                      {/* Market Analysis */}
                      {selectedPitch.parsedResponse.marketAnalysis && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Market Analysis</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.marketAnalysis}</div>
                        </div>
                      )}
                      
                      {/* Competition */}
                      {selectedPitch.parsedResponse.competition && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Competition</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.competition}</div>
                        </div>
                      )}
                      
                      {/* Landing Page */}
                      {selectedPitch.parsedResponse.landingPage && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Landing Page Idea</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.landingPage}</div>
                        </div>
                      )}
                      
                      {/* Improvement Tips */}
                      {selectedPitch.parsedResponse.improvementTips && (
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 mb-2">Improvement Tips</h2>
                          <div className="whitespace-pre-line">{selectedPitch.parsedResponse.improvementTips}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;