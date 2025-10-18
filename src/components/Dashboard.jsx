import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, logout } from '../config/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for user authentication
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      fetchUserPitches(currentUser.uid);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUserPitches = async (userId) => {
    setLoading(true);
    try {
      const pitchesRef = collection(db, `users/${userId}/geminiResponses`);
      const q = query(pitchesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const pitchesData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Parse the response to extract startup name and summary
        const parsedResponse = parseGeminiResponse(data.response);
        
        pitchesData.push({
          id: doc.id,
          startupName: parsedResponse.startupName || 'Unnamed Startup',
          summary: getSummary(parsedResponse.pitch || data.response),
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
          fullResponse: data.response,
          prompt: data.prompt
        });
      });
      
      setPitches(pitchesData);
    } catch (err) {
      console.error('Error fetching pitches:', err);
      setError('Failed to load your pitches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const parseGeminiResponse = (response) => {
    // Initialize an object to store the parsed sections
    const sections = {};
    
    // Try to extract the startup name
    const startupNameMatch = response.match(/Startup Name:\s*([^\n]+)/);
    if (startupNameMatch) sections.startupName = startupNameMatch[1].trim();
    
    // Try to extract the pitch
    const pitchMatch = response.match(/Pitch:\s*([\s\S]*?)(?=\d\.\s*[A-Za-z]|$)/);
    if (pitchMatch) sections.pitch = pitchMatch[1].trim();
    
    return sections;
  };

  const getSummary = (text) => {
    // Get first 150 characters as summary
    return text.length > 150 ? `${text.substring(0, 150)}...` : text;
  };

  const handleDeletePitch = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pitch?')) return;
    
    try {
      await deleteDoc(doc(db, `users/${user.uid}/geminiResponses`, id));
      setPitches(pitches.filter(pitch => pitch.id !== id));
    } catch (err) {
      console.error('Error deleting pitch:', err);
      setError('Failed to delete the pitch. Please try again.');
    }
  };

  const handleViewPitch = (pitch) => {
    setSelectedPitch(pitch);
    setShowModal(true);
  };
  
  const handleSaveAsPdf = async (pitch) => {
    setIsGeneratingPdf(true);
    try {
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 10px;">${pitch.startupName}</h1>
          <div style="white-space: pre-line; font-size: 14px;">${pitch.fullResponse}</div>
        </div>
      `;
      
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${pitch.startupName.replace(/\s+/g, '-').toLowerCase()}-pitch.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().from(content).set(opt).save();
      
      setSuccess('PDF saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setError('Failed to log out. Please try again.');
    }
  };
  
  const handleRegeneratePitch = async () => {
    if (!selectedPitch) return;
    navigate('/pitch', { state: { prompt: selectedPitch.prompt } });
  };
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };
  
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  const filteredPitches = pitches.filter(pitch => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      pitch.startupName.toLowerCase().includes(term) ||
      pitch.summary.toLowerCase().includes(term) ||
      pitch.fullResponse.toLowerCase().includes(term)
    );
  });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">PitchDeck</span>
          </div>
          <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="mt-5 px-4 space-y-2">
          <a href="#" className={`flex items-center px-4 py-3 rounded-lg ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-blue-50 text-blue-700'} transition-colors duration-200`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Pitch
          </a>
          <a onClick={() => navigate('/pitch')} className={`flex items-center px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} cursor-pointer transition-colors duration-200`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </a>
          <a onClick={handleLogout} className={`flex items-center px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} cursor-pointer transition-colors duration-200`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </a>
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Theme</span>
            <button 
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className={`${isSidebarOpen ? 'md:ml-64' : ''} transition-all duration-300 ease-in-out`}>
        {/* Top Bar */}
        <header className={`sticky top-0 z-20 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm backdrop-blur-lg bg-opacity-80`}>
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <button onClick={toggleSidebar} className="p-2 rounded-md mr-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent hidden md:block">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search pitches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full md:w-64 pl-10 pr-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-white placeholder-gray-400 border-gray-600' : 'bg-gray-100 text-gray-900 placeholder-gray-500 border-gray-300'} border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200`}
                />
                <div className="absolute left-3 top-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => navigate('/pitch')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ease-in-out"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New Pitch
              </button>
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="hidden md:block text-right">
                    <div className="text-sm font-medium">{user.displayName || 'User'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${isDarkMode ? 'bg-blue-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

      {/* Main content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ease-in-out">
        {/* Welcome Section */}
        <div className={`mb-8 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          <h2 className="text-3xl font-bold">Welcome back, {user?.displayName || 'User'} 👋</h2>
          <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">{user?.email}</p>
          <div className="mt-4 flex items-center">
            <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white/70 backdrop-blur-lg'} shadow-sm flex items-center`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">Total Pitches: {pitches.length}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className={`mb-6 p-4 ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-100 text-red-700'} border ${isDarkMode ? 'border-red-800' : 'border-red-400'} rounded-lg shadow-sm`}>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className={`mb-6 p-4 ${isDarkMode ? 'bg-green-900/50 text-green-200' : 'bg-green-100 text-green-700'} border ${isDarkMode ? 'border-green-800' : 'border-green-400'} rounded-lg shadow-sm animate-fade-in`}>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading your pitches...</p>
          </div>
        ) : filteredPitches.length === 0 ? (
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white/70 backdrop-blur-lg'} rounded-2xl shadow-xl p-8 text-center transition-all duration-300 ease-in-out`}>
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 mb-4">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className={`mt-2 text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {searchTerm ? 'No matching pitches found' : 'No pitches found yet'}
            </h3>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchTerm 
                ? 'Try adjusting your search term or clear the search to see all pitches.'
                : 'Get started by creating your first startup pitch.'}
            </p>
            {!searchTerm && (
              <div className="mt-6">
                <button
                  onClick={() => navigate('/pitch')}
                  className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ease-in-out"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create New Pitch
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPitches.map((pitch) => (
              <div 
                key={pitch.id} 
                className={`${isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white/70 backdrop-blur-lg hover:bg-white/90'} rounded-2xl shadow-xl p-6 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-2xl group`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1 truncate`}>{pitch.startupName}</h2>
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDate(pitch.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleSaveAsPdf(pitch)}
                      disabled={isGeneratingPdf}
                      className={`p-1.5 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'} transition-colors duration-200 focus:outline-none`}
                      title="Download PDF"
                    >
                      {isGeneratingPdf ? (
                        <div className="animate-spin h-5 w-5 border-2 border-gray-500 rounded-full border-t-transparent"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeletePitch(pitch.id)}
                      className={`p-1.5 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-red-900/50' : 'text-gray-500 hover:bg-red-100'} transition-colors duration-200 focus:outline-none`}
                      title="Delete Pitch"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="mb-3 px-2 py-1 text-xs inline-block rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  {pitch.category || 'Startup'}
                </div>
                
                <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-6 h-24 overflow-hidden relative`}>
                  {pitch.summary}
                  <div className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t ${isDarkMode ? 'from-gray-800' : 'from-white/70'} to-transparent`}></div>
                </div>
                
                <button
                  onClick={() => handleViewPitch(pitch)}
                  className={`w-full py-2.5 px-4 rounded-lg ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-blue-50 hover:bg-blue-100'} ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} font-medium text-sm flex items-center justify-center transition-colors duration-300 ease-in-out group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-indigo-600 group-hover:text-white`}
                >
                  View Full Pitch
                  <svg className="ml-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal for viewing full pitch */}
      {showModal && selectedPitch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out`}>
            <div className="sticky top-0 z-10 px-6 py-4 border-b border-gray-200 dark:border-gray-700 backdrop-blur-lg bg-white/80 dark:bg-gray-800/80 flex justify-between items-center">
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{selectedPitch.startupName}</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRegeneratePitch}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 ease-in-out flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
                <button
                  onClick={() => handleSaveAsPdf(selectedPitch)}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300 ease-in-out flex items-center"
                >
                  {isGeneratingPdf ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-gray-500 rounded-full border-t-transparent mr-1"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Save as PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-full ${isDarkMode ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'} transition-colors duration-200`}
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]" id="pitch-content-for-pdf">
              <div className="mb-4 flex items-center">
                <div className="px-3 py-1 text-xs rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  {selectedPitch.category || 'Startup'}
                </div>
                <div className="ml-3 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(selectedPitch.createdAt)}
                </div>
              </div>
              <div className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''}`}>
                <div className="whitespace-pre-line">{selectedPitch.fullResponse}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;