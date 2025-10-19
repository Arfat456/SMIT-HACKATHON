import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

function LivePreview() {
  const navigate = useNavigate();
  const { pitchId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pitch, setPitch] = useState(null);
  
  useEffect(() => {
    if (pitchId) {
      fetchPitchData(pitchId);
    } else {
      setError('No pitch ID provided');
      setLoading(false);
    }
  }, [pitchId]);
  
  const fetchPitchData = async (id) => {
    try {
      // Get the user ID from auth.currentUser
      const userId = auth.currentUser?.uid;
      
      if (!userId) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      
      // Fetch the pitch data
      const pitchDocRef = doc(db, `users/${userId}/ideas`, id);
      const pitchDoc = await getDoc(pitchDocRef);
      
      if (!pitchDoc.exists()) {
        setError('Pitch not found');
        setLoading(false);
        return;
      }
      
      const pitchData = pitchDoc.data();
      
      // Fetch the AI response if available
      const responsesRef = doc(db, `users/${userId}/ai_responses`, id);
      const responseDoc = await getDoc(responsesRef);
      
      let parsedResponse = null;
      if (responseDoc.exists()) {
        const responseData = responseDoc.data();
        if (responseData.response) {
          parsedResponse = parseGeminiResponse(responseData.response);
        }
      }
      
      setPitch({
        ...pitchData,
        id,
        parsedResponse
      });
    } catch (error) {
      console.error('Error fetching pitch data:', error);
      setError('Failed to load pitch data');
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
    
    // Extract pitch
    const pitchMatch = text.match(/Pitch:?\s*([\s\S]*?)(?=\n\s*(?:Target Audience|Market Analysis|Competition|Landing Page|Improvement|$))/i);
    if (pitchMatch) sections.pitch = pitchMatch[1].trim();
    
    // Extract landing page idea
    const landingPageMatch = text.match(/Landing Page Idea:?\s*([\s\S]*?)(?=\n\s*(?:Improvement|$))/i);
    if (landingPageMatch) sections.landingPage = landingPageMatch[1].trim();
    
    return sections;
  };
  
  const handleGoBack = () => {
    navigate('/dashboard', { replace: true });
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>{error}</p>
          <button
            onClick={handleGoBack}
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (!pitch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4">Pitch Not Found</h2>
          <p>The requested pitch could not be found.</p>
          <button
            onClick={handleGoBack}
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md transition duration-200"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Generate a unique business name based on user's idea details
  const generateBusinessName = (idea, category, marketType, region) => {
    // Extract key words from the idea
    const keywords = idea.split(' ')
      .filter(word => word.length > 3) // Filter out short words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter
      .filter(word => !['and', 'the', 'for', 'with', 'that', 'this', 'from'].includes(word.toLowerCase())); // Remove common words
    
    // Create name variations based on business category and market type
    const prefixes = {
      'Technology': ['Tech', 'Digi', 'Cyber', 'Smart', 'Inno', 'Quantum', 'Nexus'],
      'Food': ['Taste', 'Flavor', 'Savor', 'Culinary', 'Gourmet', 'Fresh'],
      'Health': ['Vital', 'Well', 'Health', 'Care', 'Life', 'Med', 'Cure'],
      'Education': ['Learn', 'Edu', 'Scholar', 'Wisdom', 'Mind', 'Bright'],
      'Finance': ['Fin', 'Wealth', 'Capital', 'Asset', 'Trust', 'Secure'],
      'Retail': ['Shop', 'Store', 'Mart', 'Emporium', 'Bazaar', 'Market'],
      'Entertainment': ['Fun', 'Joy', 'Play', 'Thrill', 'Amuse', 'Delight'],
      'Travel': ['Journey', 'Voyage', 'Wander', 'Trek', 'Explore', 'Tour'],
      'Real Estate': ['Home', 'Estate', 'Realty', 'Space', 'Habitat', 'Dwelling'],
      'Fashion': ['Style', 'Trend', 'Chic', 'Vogue', 'Mode', 'Design']
    };
    
    const suffixes = {
      'B2B': ['Pro', 'Biz', 'Corp', 'Enterprise', 'Solutions', 'Systems'],
      'B2C': ['Go', 'Now', 'Direct', 'Express', 'Connect', 'Link'],
      'C2C': ['Share', 'Peer', 'Together', 'Community', 'Circle', 'Hub'],
      'D2C': ['You', 'Direct', 'Personal', 'Custom', 'Unique', 'Select']
    };
    
    // Get relevant prefixes and suffixes based on category and market type
    const relevantPrefixes = prefixes[category] || ['Nova', 'Prime', 'Peak', 'Elite', 'Apex', 'Core'];
    const relevantSuffixes = suffixes[marketType] || ['Plus', 'Max', 'Ultra', 'One', 'Sync', 'Flex'];
    
    // Add region-specific elements if available
    const regionElements = region ? [region.split(' ')[0]] : [];
    
    // Generate name combinations
    let nameOptions = [];
    
    // Option 1: Prefix + Keyword
    if (keywords.length > 0) {
      const randomPrefix = relevantPrefixes[Math.floor(Math.random() * relevantPrefixes.length)];
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      nameOptions.push(randomPrefix + randomKeyword);
    }
    
    // Option 2: Keyword + Suffix
    if (keywords.length > 0) {
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      const randomSuffix = relevantSuffixes[Math.floor(Math.random() * relevantSuffixes.length)];
      nameOptions.push(randomKeyword + randomSuffix);
    }
    
    // Option 3: Region + Keyword
    if (regionElements.length > 0 && keywords.length > 0) {
      const regionElement = regionElements[0];
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      nameOptions.push(regionElement + randomKeyword);
    }
    
    // Option 4: Combine two keywords
    if (keywords.length >= 2) {
      const keyword1 = keywords[0];
      const keyword2 = keywords[1];
      nameOptions.push(keyword1.slice(0, Math.ceil(keyword1.length/2)) + keyword2.slice(Math.floor(keyword2.length/2)));
    }
    
    // Option 5: Acronym from keywords
    if (keywords.length >= 2) {
      const acronym = keywords.slice(0, 3).map(word => word[0]).join('');
      nameOptions.push(acronym + (relevantSuffixes[Math.floor(Math.random() * relevantSuffixes.length)]));
    }
    
    // Select a random name from the options, or use fallback
    return nameOptions.length > 0 
      ? nameOptions[Math.floor(Math.random() * nameOptions.length)]
      : pitch.parsedResponse?.startupName || 'Innovate' + Math.floor(Math.random() * 1000);
  };
  
  // Determine what to display based on available data
  const startupName = pitch.parsedResponse?.startupName || 
    generateBusinessName(pitch.startupIdea, pitch.category, pitch.marketType, pitch.region);
  const tagline = pitch.parsedResponse?.tagline || '';
  const description = pitch.parsedResponse?.pitch || pitch.startupIdea;
  const landingPageIdea = pitch.parsedResponse?.landingPage || '';
  
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xl">{startupName}</span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#features" className="hover:text-indigo-200 transition duration-200">Features</a>
            <a href="#about" className="hover:text-indigo-200 transition duration-200">About</a>
            <a href="#contact" className="hover:text-indigo-200 transition duration-200">Contact</a>
            <button 
              onClick={handleGoBack}
              className="bg-white text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-md font-medium transition duration-200"
            >
              Dashboard
            </button>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white py-20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <div className="inline-block bg-blue-600/30 backdrop-blur-sm px-6 py-2 rounded-full mb-4">
              <span className="text-sm font-medium uppercase tracking-wider">Uniquely Generated For You</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-300">{startupName}</h1>
            {tagline && <p className="text-xl md:text-2xl mb-6 text-indigo-200">{tagline}</p>}
            <p className="mb-8 text-indigo-100 max-w-lg">{description.substring(0, 200)}...</p>
            <div className="flex space-x-4">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-md transition duration-200 shadow-lg">
                Get Started
              </button>
              <button className="bg-transparent hover:bg-white/10 text-white font-bold py-3 px-6 rounded-md border-2 border-white transition duration-200">
                Learn More
              </button>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg aspect-video flex items-center justify-center p-6">
                <svg className="w-full h-32" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                  <path d="M40,40 C40,30 50,30 50,40 C50,50 60,50 60,40 C60,30 70,30 70,40 C70,50 80,50 80,40 C80,30 90,30 90,40 C90,50 100,50 100,40 C100,30 110,30 110,40 C110,50 120,50 120,40 C120,30 130,30 130,40 C130,50 140,50 140,40 C140,30 150,30 150,40 C150,50 160,50 160,40" stroke="white" strokeWidth="2" fill="none" />
                  <circle cx="100" cy="50" r="20" fill="rgba(255,255,255,0.2)" />
                  <path d="M100,30 L120,50 L100,70 L80,50 Z" fill="rgba(255,255,255,0.6)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition duration-200">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Lightning Fast</h3>
              <p className="text-gray-600">Experience unparalleled speed and efficiency with our cutting-edge technology.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition duration-200">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">Secure & Reliable</h3>
              <p className="text-gray-600">Your data is protected with enterprise-grade security and 99.9% uptime guarantee.</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition duration-200">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">24/7 Support</h3>
              <p className="text-gray-600">Our dedicated team is always available to help you with any questions or issues.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold mb-4">About Us</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">The Story Behind <span className="text-indigo-600">{startupName}</span></h2>
          </div>
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-2 shadow-xl">
                <div className="bg-white rounded-md aspect-video flex items-center justify-center p-6">
                  <svg className="w-full h-32" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                    <rect x="40" y="20" width="120" height="60" rx="10" fill="#4f46e5" />
                    <circle cx="70" cy="50" r="15" fill="#c7d2fe" />
                    <rect x="100" y="35" width="40" height="5" rx="2" fill="#c7d2fe" />
                    <rect x="100" y="45" width="50" height="5" rx="2" fill="#c7d2fe" />
                    <rect x="100" y="55" width="30" height="5" rx="2" fill="#c7d2fe" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 md:pl-12">
              <h2 className="text-3xl font-bold mb-6 text-gray-800">About {startupName}</h2>
              <p className="text-gray-600 mb-6">{description}</p>
              {landingPageIdea && (
                <p className="text-gray-600 mb-6">{landingPageIdea}</p>
              )}
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md transition duration-200">
                Learn More About Us
              </button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">What Our Customers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-indigo-600 font-bold">JD</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">John Doe</h4>
                  <p className="text-gray-500 text-sm">CEO, TechCorp</p>
                </div>
              </div>
              <p className="text-gray-600 italic">"This solution has transformed our business operations. We've seen a 40% increase in productivity since implementation."</p>
              <div className="flex mt-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-indigo-600 font-bold">JS</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">Jane Smith</h4>
                  <p className="text-gray-500 text-sm">CTO, InnovateCo</p>
                </div>
              </div>
              <p className="text-gray-600 italic">"The integration was seamless and the support team was exceptional. I highly recommend this to any growing business."</p>
              <div className="flex mt-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-indigo-600 font-bold">RJ</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">Robert Johnson</h4>
                  <p className="text-gray-500 text-sm">Founder, StartupX</p>
                </div>
              </div>
              <p className="text-gray-600 italic">"As a startup founder, I needed a solution that could scale with my business. This exceeded all my expectations."</p>
              <div className="flex mt-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">Get In Touch</h2>
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-600 p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Contact Information</h3>
                <p className="mb-6">Fill out the form and our team will get back to you within 24 hours.</p>
                <div className="flex items-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>contact@{startupName.toLowerCase().replace(/\s+/g, '')}.com</span>
                </div>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>123 Innovation Street, Tech City, TC 10101</span>
                </div>
              </div>
              <div className="md:w-1/2 p-8">
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="first-name">First Name</label>
                      <input type="text" id="first-name" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="last-name">Last Name</label>
                      <input type="text" id="last-name" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="email">Email</label>
                    <input type="email" id="email" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="message">Message</label>
                    <textarea id="message" rows="4" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition duration-200">
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-purple-300">{startupName}</h3>
              <div className="inline-block bg-indigo-900/50 backdrop-blur-sm px-3 py-1 rounded-md mb-4">
                <span className="text-xs font-medium text-indigo-300">Your Unique Business Identity</span>
              </div>
              <p className="text-gray-400 mb-4">{tagline}</p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition duration-200">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-200">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-200">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition duration-200">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Press</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">Cookie Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition duration-200">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} {startupName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LivePreview;