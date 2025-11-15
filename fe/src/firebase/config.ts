import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyArwJdRgoFQPMAZTqhY8EVa0g2q-7UxHqo",
    authDomain: "expense-tracker-auth-c50cf.firebaseapp.com",
    projectId: "expense-tracker-auth-c50cf",
    storageBucket: "expense-tracker-auth-c50cf.firebasestorage.app",
    messagingSenderId: "502908893673",
    appId: "1:502908893673:web:8688b18d5f4b0c8b35f378",
    measurementId: "G-6XXB6C2YLE",
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Hàm đăng nhập bằng Google
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // Lấy ID token từ user
        const idToken = await result.user.getIdToken();
        console.log(
            "ID Token:",
            idToken ? `${idToken.substring(0, 20)}...` : "Không có token"
        );
        return idToken;
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        throw error;
    }
};
