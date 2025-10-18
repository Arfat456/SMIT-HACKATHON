// Import Firebase SDKs
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

// ========== Your Firebase Config ==========
const firebaseConfig = {
  apiKey: "AIzaSyDXIwoQTBd4l5mB7YTBEHny0w7NSx8NPfA",
  authDomain: "mini-hackathon-65fd4.firebaseapp.com",
  projectId: "mini-hackathon-65fd4",
  storageBucket: "mini-hackathon-65fd4.firebasestorage.app",
  messagingSenderId: "927117419561",
  appId: "1:927117419561:web:4c02d79ca85fa29714e838",
  measurementId: "G-ZF0K6J375L",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ========== AUTH FUNCTIONS ==========

// Signup User
export async function signUp(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create a user document in Firestore
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        createdAt: new Date()
      });
      console.log("User document created in Firestore");
    } catch (firestoreError) {
      console.error("Error creating user document:", firestoreError);
      // Continue with signup even if Firestore fails
    }
    
    console.log("User signed up:", user);
    return user;
  } catch (error) {
    console.error("Signup Error:", error.message);
    throw error;
  }
}

// Login User
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("User logged in:", userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error("Login Error:", error.message);
    throw error;
  }
}

// Logout User
export async function logout() {
  try {
    await signOut(auth);
    console.log("User logged out");
  } catch (error) {
    console.error("Logout Error:", error.message);
  }
}

// ========== FIRESTORE FUNCTIONS ==========

// Add Data
export async function addData(collectionName, data) {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);
    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding document: ", error);
  }
}

// Get Data
export async function getData(collectionName) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });
    return data;
  } catch (error) {
    console.error("Error getting documents: ", error);
  }
}

// Update Data
export async function updateData(collectionName, id, newData) {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, newData);
    console.log("Document updated successfully");
  } catch (error) {
    console.error("Error updating document: ", error);
  }
}

// Delete Data
export async function deleteData(collectionName, id) {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    console.log("Document deleted successfully");
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
}

// Save AI Response to Firestore
export const saveAIResponse = async (prompt, response, userId = null) => {
  try {
    // If user is logged in, save to their collection
    if (userId) {
      await addDoc(collection(db, `users/${userId}/geminiResponses`), {
        prompt: prompt,
        response: response,
        createdAt: new Date(),
      });
    } else {
      // Save to general collection if no user ID
      await addDoc(collection(db, "geminiResponses"), {
        prompt: prompt,
        response: response,
        createdAt: new Date(),
      });
    }
    console.log("✅ Data saved to Firestore!");
    return true;
  } catch (error) {
    console.error("Firestore Error:", error);
    throw error;
  }
};

// Export Auth & Firestore
export { auth, db };
