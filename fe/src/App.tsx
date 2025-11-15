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


import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'; // <-- Import useLocation
import { ConfigProvider, Spin } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'antd/dist/reset.css';
import './App.less';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Wallets from './pages/Wallets';
import Login from './components/Login';

// Auth context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected route component
const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation(); // <-- Lấy vị trí (location) hiện tại

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
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
  if (currentUser.newUser && location.pathname !== '/wallets') {
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

function App() {
  return (
    <Router>
      <AuthProvider>
        <ConfigProvider
          locale={viVN}
          theme={{
            token: {
              colorPrimary: '#1890ff',
              borderRadius: 6,
              colorBgContainer: '#ffffff',
            },
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Tất cả các route được bảo vệ giờ đây đều sử dụng logic đã được cập nhật */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/wallets" element={<Wallets />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConfigProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;