import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { auth, signInWithGoogle } from "../firebase/config";
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signOut as firebaseSignOut,
} from "firebase/auth";

interface AppUser {
    uid: string;
    email: string | null;
    displayName: string;
    newUser: boolean;
}

type AuthContextType = {
    currentUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    updateUserStatus: (isNew: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

type AuthProviderProps = {
    children: ReactNode;
};

// const verifyTokenWithBackend = async (token: string): Promise<AppUser> => {
//     const response = await fetch("${process.env.REACT_APP_API_URL}/api/auth/verify", {
//         method: "GET",
//         headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//         },
//     });

const verifyTokenWithBackend = async (token: string): Promise<AppUser> => {
    // SỬA Ở ĐÂY: Dùng dấu backtick ` thay vì nháy kép "
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/verify`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        // Cố gắng đọc lỗi từ JSON nếu có
        try {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server responded with ${response.status}`);
        } catch (e) {
            // Nếu không đọc được JSON, ném lỗi chung
            throw new Error(`Server error on verification: ${response.status}`);
        }
    }

    return response.json();
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const isAuthenticated = !!currentUser;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                try {
                    const token = await firebaseUser.getIdToken(true); // Lấy token mới nhất
                    const appUserData = await verifyTokenWithBackend(token);
                    setCurrentUser(appUserData);
                } catch (error) {
                    console.error("Lỗi nghiêm trọng khi đồng bộ người dùng, đăng xuất:", error);
                    // Chỉ đăng xuất khi có lỗi nghiêm trọng không thể phục hồi
                    await firebaseSignOut(auth);
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleGoogleSignIn = async (): Promise<void> => {
        // Hàm này giờ chỉ cần kích hoạt popup. 
        // onAuthStateChanged sẽ tự động xử lý phần còn lại.
        try {
            setLoading(true);
            await signInWithGoogle();
            // Không cần làm gì thêm ở đây. `useEffect` ở trên sẽ lo tất cả.
        } catch (error) {
            console.error("Lỗi trong quá trình mở popup Google:", error);
            // Ném lỗi ra để component Login có thể xử lý (hiển thị alert)
            throw error; 
        } finally {
            // Không set loading về false ở đây, để `useEffect` kiểm soát
        }
    };

    // 5. Hàm đăng xuất không đổi
    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            setCurrentUser(null);
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            throw error;
        }
    };

    // 6. Hàm mới để cập nhật trạng thái newUser từ component con
    const updateUserStatus = (isNew: boolean) => {
        if (currentUser) {
            // Cập nhật lại state của context để UI thay đổi ngay lập tức
            setCurrentUser({ ...currentUser, newUser: isNew });
        }
    };

    const value = {
        currentUser,
        loading,
        signInWithGoogle: handleGoogleSignIn,
        logout,
        isAuthenticated,
        updateUserStatus, // <-- Cung cấp hàm này ra context
    };

    // Chỉ render children khi đã xác thực xong
    // Bạn có thể thêm một màn hình loading đẹp hơn ở đây
    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100vh",
                    }}
                >
                    Loading...
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
