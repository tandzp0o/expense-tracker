// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
// import { ConfigProvider, Spin } from 'antd';
// import viVN from 'antd/locale/vi_VN';
// import 'antd/dist/reset.css';
// import './App.less';

// // Layouts
// import MainLayout from './layouts/MainLayout';

// // Pages
// import Dashboard from './pages/Dashboard';
// import Transactions from './pages/Transactions';
// import Wallets from './pages/Wallets';
// import Login from './components/Login';

// // Auth context
// import { AuthProvider, useAuth } from './contexts/AuthContext';

// // Protected route component
// const ProtectedRoute = () => {
//   const { currentUser, loading } = useAuth();

//   if (loading) {
//     return (
//       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
//         <Spin size="large" />
//       </div>
//     );
//   }

//   if (!currentUser) {
//     return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
//   }

//   return (
//     <MainLayout>
//       <Outlet />
//     </MainLayout>
//   );
// };

// function App() {
//   return (
//     <Router>
//       <AuthProvider>
//         <ConfigProvider
//           locale={viVN}
//           theme={{
//             token: {
//               colorPrimary: '#1890ff',
//               borderRadius: 6,
//               colorBgContainer: '#ffffff',
//             },
//           }}
//         >
//           <Routes>
//             <Route path="/login" element={<Login />} />
//             <Route element={<ProtectedRoute />}>
//               <Route path="/" element={<Dashboard />} />
//               <Route path="/transactions" element={<Transactions />} />
//               <Route path="/wallets" element={<Wallets />} />
//             </Route>
//             <Route path="*" element={<Navigate to="/" replace />} />
//           </Routes>
//         </ConfigProvider>
//       </AuthProvider>
//     </Router>
//   );
// }

// export default App;

import React from "react";
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom"; // <-- Import useLocation
import { ConfigProvider, Spin, App as AntApp } from "antd";
import viVN from "antd/locale/vi_VN";
import "antd/dist/reset.css";
import "./App.less";
import "./assets/styles/main.css";
import "./assets/styles/themeOverrides.css";
import "./assets/styles/responsive.css";
import "./assets/styles/ekash_new.css";

// Layouts
import MainLayout from "./layouts/MainLayout";
import MainLayout_new from "./layouts/MainLayout_new";

// Pages
import Dashboard from "./pages/Dashboard";
import Dashboard_new from "./pages/Dashboard_new";
import Wallets_new from "./pages/Wallets_new";
import Budgets_new from "./pages/Budgets_new";
import Goals_new from "./pages/Goals_new";
import Transactions_new from "./pages/Transactions_new";
import Transactions from "./pages/Transactions";
import Wallets from "./pages/Wallets";
import DishSuggestions from "./pages/DishSuggestions";
import DishSuggestions_new from "./pages/DishSuggestions_new";
import Goals from "./pages/Goals";
import Profile from "./pages/Profile";
import Profile_new from "./pages/Profile_new";
import Login from "./components/Login";
import Analytics_new from "./pages/Analytics_new";

// Auth context
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Theme context
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

// Theme wrapper component
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { antdTheme } = useTheme();

    return (
        <ConfigProvider locale={viVN} theme={antdTheme}>
            {children}
        </ConfigProvider>
    );
};

// Protected route component
const ProtectedRoute = () => {
    const { currentUser, loading } = useAuth();
    const location = useLocation(); // <-- Lấy vị trí (location) hiện tại

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                }}
            >
                <Spin size="large" />
            </div>
        );
    }

    // Nếu người dùng chưa được xác thực, chuyển hướng họ về trang đăng nhập
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // *** LOGIC MỚI CHO LUỒNG ONBOARDING (CHÀO MỪNG NGƯỜI DÙNG MỚI) ***
    // Nếu là người dùng mới VÀ họ đang cố gắng truy cập một trang khác ngoài /wallets
    if (currentUser.newUser && location.pathname !== "/wallets") {
        // Buộc họ phải chuyển đến trang /wallets để tạo ví đầu tiên
        return <Navigate to="/wallets" replace />;
    }

    // Nếu mọi thứ đều ổn, hiển thị layout chính và nội dung của trang
    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};

const ProtectedRouteNew = () => {
    const { currentUser, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                }}
            >
                <Spin size="large" />
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (currentUser.newUser && location.pathname !== "/new/wallets") {
        return <Navigate to="/new/wallets" replace />;
    }

    return (
        <MainLayout_new>
            <Outlet />
        </MainLayout_new>
    );
};

function App() {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <AntApp>
                        <ThemeWrapper>
                            <Routes>
                                <Route path="/login" element={<Login />} />

                                {/* Route redirect từ root về new dashboard */}
                                <Route
                                    path="/"
                                    element={
                                        <Navigate to="/new/dashboard" replace />
                                    }
                                />

                                {/* Tất cả các route được bảo vệ giờ đây đều sử dụng logic đã được cập nhật */}
                                <Route element={<ProtectedRoute />}>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route
                                        path="/transactions"
                                        element={<Transactions />}
                                    />
                                    <Route
                                        path="/wallets"
                                        element={<Wallets />}
                                    />
                                    <Route
                                        path="/dishes"
                                        element={<DishSuggestions />}
                                    />
                                    <Route path="/goals" element={<Goals />} />
                                    <Route
                                        path="/profile"
                                        element={<Profile />}
                                    />
                                </Route>

                                <Route element={<ProtectedRouteNew />}>
                                    <Route
                                        path="/new/dashboard"
                                        element={<Dashboard_new />}
                                    />
                                    <Route
                                        path="/new/transactions"
                                        element={<Transactions_new />}
                                    />
                                    <Route
                                        path="/new/wallets"
                                        element={<Wallets_new />}
                                    />
                                    <Route
                                        path="/new/budgets"
                                        element={<Budgets_new />}
                                    />
                                    <Route
                                        path="/new/goals"
                                        element={<Goals_new />}
                                    />
                                    <Route
                                        path="/new/dishes"
                                        element={<DishSuggestions_new />}
                                    />
                                    <Route
                                        path="/new/profile"
                                        element={<Profile_new />}
                                    />
                                    <Route
                                        path="/new/analytics"
                                        element={<Analytics_new />}
                                    />
                                </Route>
                            </Routes>
                        </ThemeWrapper>
                    </AntApp>
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
}

export default App;
