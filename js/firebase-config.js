// Firebase Configuration
// Using the same Firebase project as the original app
const firebaseConfig = {
    apiKey: "AIzaSyDC2EPqMAo-laYO59IvHFwbqA65eqst0Jw",
    authDomain: "budgetmanager-21858.firebaseapp.com",
    projectId: "budgetmanager-21858",
    storageBucket: "budgetmanager-21858.firebasestorage.app",
    messagingSenderId: "817688844370",
    appId: "1:817688844370:web:00354b2f8a1a7c1de7e78b",
    measurementId: "G-45NDMNN1LN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other files
window.auth = auth;
window.db = db;
