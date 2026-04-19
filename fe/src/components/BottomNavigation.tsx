import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  HomeOutlined,
  WalletOutlined,
  TransactionOutlined,
  RestOutlined,
  TrophyOutlined,
  ProfileOutlined,
} from "@ant-design/icons";

interface BottomNavigationProps {
  collapsed?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  collapsed = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    {
      key: "/",
      icon: <HomeOutlined />,
      label: "Trang chủ",
      path: "/",
    },
    {
      key: "/wallets",
      icon: <WalletOutlined />,
      label: "Ví",
      path: "/wallets",
    },
    {
      key: "/transactions",
      icon: <TransactionOutlined />,
      label: "Giao dịch",
      path: "/transactions",
    },
    {
      key: "/dishes",
      icon: <RestOutlined />,
      label: "Món ăn",
      path: "/dishes",
    },
    {
      key: "/goals",
      icon: <TrophyOutlined />,
      label: "Mục tiêu",
      path: "/goals",
    },
    {
      key: "/profile",
      icon: <ProfileOutlined />,
      label: "Hồ sơ",
      path: "/profile",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: collapsed ? 80 : 200,
        right: 0,
        background: "#fff",
        borderTop: "1px solid #e8e8e8",
        padding: "8px 0",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 1000,
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.1)",
        transition: "left 0.2s",
      }}
    >
      {navigationItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <div
            key={item.key}
            onClick={() => navigate(item.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "4px 8px",
              cursor: "pointer",
              color: isActive ? "#1890ff" : "#666",
              transition: "color 0.2s",
            }}
          >
            <div style={{ fontSize: "20px", marginBottom: "2px" }}>
              {item.icon}
            </div>
            <span style={{ fontSize: "10px", textAlign: "center" }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
