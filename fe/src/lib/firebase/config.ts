import { initializeApp } from "firebase/app";
import {
    GoogleAuthProvider,
    UserCredential,
    createUserWithEmailAndPassword,
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyArwJdRgoFQPMAZTqhY8EVa0g2q-7UxHqo",
    authDomain: "expense-tracker-auth-c50cf.firebaseapp.com",
    projectId: "expense-tracker-auth-c50cf",
    storageBucket: "expense-tracker-auth-c50cf.firebasestorage.app",
    messagingSenderId: "502908893673",
    appId: "1:502908893673:web:8688b18d5f4b0c8b35f378",
    measurementId: "G-6XXB6C2YLE",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user.getIdToken();
};

export const signInWithEmailPassword = async (
    email: string,
    password: string,
) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user.getIdToken();
};

export const registerWithEmailPassword = async (
    email: string,
    password: string,
): Promise<UserCredential> => {
    return createUserWithEmailAndPassword(auth, email, password);
};
