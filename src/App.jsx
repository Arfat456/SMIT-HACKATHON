import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Components
import Login from "./components/Login";
import Signup from "./components/Signup";
import Home from "./components/Home";
import Pitch from "./components/Pitch";
import PitchResult from "./components/PitchResult";
import Dashboard from "./components/Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if user exists in Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          // If user doesn't exist in Firestore, create a record
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              createdAt: new Date()
            });
            console.log('User profile created in Firestore');
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
        }
      }
      
      setUser(currentUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>;
    
    if (!user) {
      return <Navigate to="/login" />;
    }
    
    return children;
  };

  // Public route - redirects to home if already logged in
  const PublicRoute = ({ children }) => {
    if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>;
    
    if (user) {
      return <Navigate to="/" />;
    }
    
    return children;
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Navigate to="/pitch" />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/pitch" 
          element={
            <ProtectedRoute>
              <Pitch />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/pitch-result" 
          element={
            <ProtectedRoute>
              <PitchResult />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;