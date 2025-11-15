import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
    children: React.ReactElement;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
    const { currentUser } = useAuth();
    const location = useLocation();

    // Nếu không có user, chuyển hướng về trang đăng nhập
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // **Logic quan trọng:** Nếu là user mới và đang cố truy cập trang khác ngoài /wallets
    if (currentUser.newUser && location.pathname !== '/wallets') {
        // Chuyển hướng họ đến trang /wallets
        return <Navigate to="/wallets" replace />;
    }

    // Nếu mọi thứ đều ổn, cho phép truy cập
    return children;
};

export default PrivateRoute;