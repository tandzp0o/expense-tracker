import React from "react";
import { Layout, Menu, theme, Typography } from "antd";
import {
  HomeOutlined,
  WalletOutlined,
  TransactionOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RestOutlined,
  TrophyOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useWindowSize } from "../hooks/useWindowSize"; // <-- IMPORT HOOK MỚI
import ThemeSwitcher from "../components/ThemeSwitcher";
import { BottomNavigation } from "../components/BottomNavigation";

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const { width } = useWindowSize(); // <-- SỬ DỤNG HOOK
  const isMobile = width < 768; // <-- Đặt breakpoint cho mobile (ví dụ: 768px)

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Định nghĩa menu items (không thay đổi)
  const menuItems = [
    {
      key: "/", // <-- Sửa key để khớp với location.pathname
      icon: <HomeOutlined />,
      label: "Trang chủ",
      onClick: () => navigate("/"),
    },
    {
      key: "/wallets", // <-- Sửa key
      icon: <WalletOutlined />,
      label: "Quản lý ví",
      onClick: () => navigate("/wallets"),
    },
    {
      key: "/transactions", // <-- Sửa key
      icon: <TransactionOutlined />,
      label: "Giao dịch",
      onClick: () => navigate("/transactions"),
    },
    {
      key: "/dishes", // <-- Thêm menu item cho dishes
      icon: <RestOutlined />,
      label: "Gợi ý món ăn",
      onClick: () => navigate("/dishes"),
    },
    {
      key: "/goals", // <-- Thêm menu item cho goals
      icon: <TrophyOutlined />,
      label: "Mục tiêu",
      onClick: () => navigate("/goals"),
    },
    {
      key: "/profile", // <-- Thêm menu item cho profile
      icon: <ProfileOutlined />,
      label: "Hồ sơ",
      onClick: () => navigate("/profile"),
    },
  ];

  // Xác định selected key dựa trên đường dẫn hiện tại (cải tiến một chút)
  const selectedKey = location.pathname;

  // User menu items (không thay đổi)
  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Hồ sơ cá nhân",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: logout,
    },
  ];

  // Giao diện cho Desktop
  const DesktopLayout = (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={200}
        style={{
          background: colorBgContainer,
          boxShadow: "2px 0 8px 0 rgba(29, 35, 41, 0.05)",
          overflow: "auto",
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <h2
            style={{
              color: "#1890ff",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {collapsed ? "Expense" : "Quản lý chi tiêu"}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderRight: 0, padding: "8px 0" }}
          items={menuItems}
        />
      </Sider>
      <Layout
        style={{ marginLeft: collapsed ? 80 : 200, transition: "all 0.2s" }}
      >
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 1,
            boxShadow: "0 1px 4px 0 rgba(0, 21, 41, 0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {React.createElement(
              collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
              {
                className: "trigger",
                onClick: () => setCollapsed(!collapsed),
                style: { fontSize: 18 },
              }
            )}
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {menuItems.find((item) => item.key === selectedKey)?.label ||
                "Trang chủ"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ThemeSwitcher />
            <Menu
              mode="horizontal"
              selectable={false}
              style={{ lineHeight: "64px", borderBottom: "none" }}
              items={[
                {
                  key: "user",
                  label: (
                    <span>
                      <UserOutlined style={{ marginRight: 8 }} />
                      {currentUser?.email?.split("@")[0] || "Tài khoản"}
                    </span>
                  ),
                  children: userMenuItems,
                },
              ]}
            />
          </div>
        </Header>
        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
          }}
        >
          {children}
        </Content>
      </Layout>
      {isMobile && <BottomNavigation collapsed={collapsed} />}
    </Layout>
  );

  // Giao diện cho Mobile
  const MobileLayout = (
    <Layout>
      <Header
        style={{
          background: colorBgContainer,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 1,
          boxShadow: "0 1px 4px 0 rgba(0, 21, 41, 0.12)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          {menuItems.find((item) => item.key === selectedKey)?.label ||
            "Trang chủ"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeSwitcher />
          <Menu
            mode="horizontal"
            selectable={false}
            style={{
              lineHeight: "64px",
              borderBottom: "none",
              background: "transparent",
            }}
            items={[
              {
                key: "user",
                label: <UserOutlined style={{ fontSize: 18 }} />, // Chỉ hiển thị icon trên mobile
                children: userMenuItems,
              },
            ]}
          />
        </div>
      </Header>
      <Content
        style={{
          margin: "16px",
          paddingBottom: "80px" /* Thêm padding để nội dung không bị che */,
        }}
      >
        {children}
      </Content>
      <BottomNavigation />
    </Layout>
  );

  // Render layout tương ứng
  return isMobile ? MobileLayout : DesktopLayout;
};

export default MainLayout;
