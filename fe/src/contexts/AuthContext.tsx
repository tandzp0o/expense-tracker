import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { auth, signInWithGoogle } from "../firebase/config"; // Giả sử firebase/config export hàm signInWithGoogle
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signOut as firebaseSignOut,
} from "firebase/auth";

// 1. Định nghĩa interface cho người dùng của bạn từ backend
interface AppUser {
    uid: string;
    email: string | null;
    displayName: string;
    newUser: boolean;
    // Thêm các thuộc tính khác nếu backend có trả về
}

// 2. Cập nhật AuthContextType để sử dụng AppUser và thêm hàm mới
type AuthContextType = {
    currentUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    updateUserStatus: (isNew: boolean) => void; // <-- Hàm mới để cập nhật client state
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

// Hàm helper để gọi API xác thực
const verifyTokenWithBackend = async (token: string): Promise<AppUser> => {
    const response = await fetch(
        "http://localhost:5000/api/auth/verify",
        {
            // Đảm bảo URL chính xác
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Xác thực với backend thất bại");
    }

    return response.json();
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null); // <-- Sử dụng AppUser
    const [loading, setLoading] = useState(true);
    const isAuthenticated = !!currentUser;

    // 3. Theo dõi trạng thái đăng nhập và đồng bộ với backend
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser: FirebaseUser | null) => {
                if (firebaseUser) {
                    try {
                        // Mỗi khi auth state thay đổi (tải lại trang, đăng nhập), lấy token và gọi backend
                        const token = await firebaseUser.getIdToken();
                        const appUserData = await verifyTokenWithBackend(token);
                        setCurrentUser(appUserData); // <-- Lưu thông tin người dùng từ backend vào state
                    } catch (error) {
                        console.error(
                            "Lỗi đồng bộ người dùng với backend:",
                            error
                        );
                        // Nếu có lỗi, đăng xuất để tránh trạng thái không nhất quán
                        await firebaseSignOut(auth);
                        setCurrentUser(null);
                    }
                } else {
                    // Người dùng đã đăng xuất
                    setCurrentUser(null);
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // 4. Cập nhật hàm đăng nhập Google để set state ngay lập tức
    const handleGoogleSignIn = async (): Promise<void> => {
        try {
            setLoading(true);
            const idToken = await signInWithGoogle();
            if (!idToken) throw new Error("Không thể lấy token đăng nhập");

            const userData = await verifyTokenWithBackend(idToken);
            setCurrentUser(userData); // <-- Set currentUser ngay sau khi đăng nhập thành công
        } catch (error) {
            console.error("Lỗi đăng nhập bằng Google:", error);
            await firebaseSignOut(auth);
            setCurrentUser(null);
            throw error; // Ném lỗi ra để component có thể xử lý (ví dụ: hiển thị thông báo)
        } finally {
            setLoading(false);
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
