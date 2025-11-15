import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, signInWithGoogle } from '../firebase/config';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

type AuthContextType = {
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<string | undefined>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = !!currentUser;

  // Đăng nhập bằng Google
  const handleGoogleSignIn = async (): Promise<string | undefined> => {
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) throw new Error('Không thể lấy token đăng nhập');
      
      // Gọi API xác thực token với backend
      const response = await fetch('http://localhost:5000/api/auth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Xác thực thất bại');
      }

      const userData = await response.json();
      console.log('Thông tin người dùng:', userData);
      return idToken;
    } catch (error) {
      console.error('Lỗi đăng nhập bằng Google:', error);
      // Đăng xuất nếu có lỗi
      await firebaseSignOut(auth);
      throw error;
    }
  };

  // Đăng xuất
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      throw error;
    }
  };

  // Theo dõi trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Lấy token mới khi user thay đổi
        try {
          const token = await user.getIdToken();
          // Lưu token vào localStorage hoặc state nếu cần
          localStorage.setItem('token', token);
        } catch (error) {
          console.error('Lỗi khi lấy token:', error);
        }
      } else {
        localStorage.removeItem('token');
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    loading,
    signInWithGoogle: handleGoogleSignIn,
    logout,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
