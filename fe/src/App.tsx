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
// import "antd/dist/reset.css";
// import "./App.less";
// import "./assets/styles/main.css";
// import "./assets/styles/themeOverrides.css";
// import "./assets/styles/responsive.css";
// import "./assets/styles/ekash_new.css";

// Layouts
import MainLayout from "./layouts/MainLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Transactions from "./pages/Transactions";
import DishSuggestions from "./pages/DishSuggestions";
import Profile from "./pages/Profile";
import Login from "./components/Login";
import Analytics from "./pages/Analytics";

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

const ProtectedRoute = () => {
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

    if (currentUser.newUser && location.pathname !== "/wallets") {
        return <Navigate to="/wallets" replace />;
    }

    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};

// Debug component to check if routing works
const DebugRoute = () => {
    console.log("🔍 DebugRoute - Component rendered!");
    return (
        <div style={{ padding: 20, background: "red", color: "white" }}>
            DEBUG: Route matched!
        </div>
    );
};

// Login route wrapper - redirect if already authenticated
const LoginRoute = () => {
    console.log("🔍 LoginRoute - Component START rendering!");

    const { currentUser, loading } = useAuth();

    console.log("🔍 LoginRoute - Auth state:", {
        loading,
        currentUser: !!currentUser,
    });
    console.log("🔍 LoginRoute - currentUser:", currentUser);

    if (loading) {
        console.log("⏳ LoginRoute - Still loading auth state...");
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    flexDirection: "column",
                    gap: 20,
                }}
            >
                <Spin size="large" />
                <div>Loading auth state...</div>
            </div>
        );
    }

    if (currentUser) {
        console.log(
            "✅ LoginRoute - User authenticated, redirecting to dashboard...",
        );
        return <Navigate to="/dashboard" replace />;
    }

    console.log("❌ LoginRoute - User not authenticated, showing login form");
    return <Login />;
};

function App() {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <AntApp>
                        <ThemeWrapper>
                            <Routes>
                                <Route path="/login" element={<LoginRoute />} />

                                {/* Route redirect từ root về dashboard */}
                                <Route
                                    path="/"
                                    element={
                                        <Navigate to="/dashboard" replace />
                                    }
                                />

                                {/* Main routes */}
                                <Route element={<ProtectedRoute />}>
                                    <Route
                                        path="/dashboard"
                                        element={<Dashboard />}
                                    />
                                    <Route
                                        path="/transactions"
                                        element={<Transactions />}
                                    />
                                    <Route
                                        path="/budgets"
                                        element={<Budgets />}
                                    />
                                    <Route
                                        path="/goals"
                                        element={<Goals />}
                                    />
                                    <Route
                                        path="/analytics"
                                        element={<Analytics />}
                                    />
                                    <Route
                                        path="/wallets"
                                        element={<Wallets />}
                                    />
                                    <Route
                                        path="/dishes"
                                        element={<DishSuggestions />}
                                    />
                                    <Route
                                        path="/profile"
                                        element={<Profile />}
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
