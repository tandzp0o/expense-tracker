import React from "react";
import { Menu, Button } from "antd";
import { NavLink, useLocation } from "react-router-dom";
import logo from "../assets/images/logo.png";

interface SidenavProps {
  color?: string;
}

const dashboardIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 4C3 3.44772 3.44772 3 4 3H16C16.5523 3 17 3.44772 17 4V6C17 6.55228 16.5523 7 16 7H4C3.44772 7 3 6.55228 3 6V4Z"
      fill="currentColor"
    ></path>
    <path
      d="M3 10C3 9.44771 3.44772 9 4 9H10C10.5523 9 11 9.44771 11 10V16C11 16.5523 10.5523 17 10 17H4C3.44772 17 3 16.5523 3 16V10Z"
      fill="currentColor"
    ></path>
    <path
      d="M14 9C13.4477 9 13 9.44771 13 10V16C13 16.5523 13.4477 17 14 17H16C16.5523 17 17 16.5523 17 16V10C17 9.44771 16.5523 9 16 9H14Z"
      fill="currentColor"
    ></path>
  </svg>
);

const walletsIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 4C2.89543 4 2 4.89543 2 6V14C2 15.1046 2.89543 16 4 16H16C17.1046 16 18 15.1046 18 14V6C18 4.89543 17.1046 4 16 4H4Z"
      fill="currentColor"
    ></path>
    <path
      d="M14 8C13.4477 8 13 8.44772 13 9C13 9.55228 13.4477 10 14 10H16C16.5523 10 17 9.55228 17 9C17 8.44772 16.5523 8 16 8H14Z"
      fill="currentColor"
    ></path>
  </svg>
);

const transactionIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 6C3 4.34315 4.34315 3 6 3H16C16.3788 3 16.725 3.214 16.8944 3.55279C17.0638 3.89157 17.0273 4.29698 16.8 4.6L14.25 8L16.8 11.4C17.0273 11.703 17.0638 12.1084 16.8944 12.4472C16.725 12.786 16.3788 13 16 13H6C5.44772 13 5 13.4477 5 14V17C5 17.5523 4.55228 18 4 18C3.44772 18 3 17.5523 3 17V6Z"
      fill="currentColor"
    ></path>
  </svg>
);

const goalsIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.5 1.5C10.5 1.08579 10.1642 0.75 9.75 0.75C9.33579 0.75 9 1.08579 9 1.5V2.08816C7.35353 2.3113 5.91619 3.0942 4.93414 4.20235C3.95209 5.31049 3.5 6.70879 3.5 8.25C3.5 11.564 5.47236 14.5232 8.25 15.9034V18.5C8.25 18.9142 8.58579 19.25 9 19.25C9.41421 19.25 9.75 18.9142 9.75 18.5V15.9034C12.5276 14.5232 14.5 11.564 14.5 8.25C14.5 6.70879 14.0479 5.31049 13.0659 4.20235C12.0838 3.0942 10.6465 2.3113 9 2.08816V1.5ZM10 8.25C10 7.42157 9.32843 6.75 8.5 6.75C7.67157 6.75 7 7.42157 7 8.25C7 9.07843 7.67157 9.75 8.5 9.75C9.32843 9.75 10 9.07843 10 8.25Z"
      fill="currentColor"
    ></path>
  </svg>
);

const dishesIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 4C1 2.34315 2.34315 1 4 1H16C17.6569 1 19 2.34315 19 4V14C19 15.6569 17.6569 17 16 17H4C2.34315 17 1 15.6569 1 14V4Z"
      fill="currentColor"
    ></path>
    <path
      d="M8 19C7.44772 19 7 19.4477 7 20C7 20.5523 7.44772 21 8 21H12C12.5523 21 13 20.5523 13 20C13 19.4477 12.5523 19 12 19H8Z"
      fill="currentColor"
    ></path>
  </svg>
);

const profileIcon = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2C14.4183 2 18 5.58172 18 10ZM12 7C12 8.10457 11.1046 9 10 9C8.89543 9 8 8.10457 8 7C8 5.89543 8.89543 5 10 5C11.1046 5 12 5.89543 12 7ZM9.99993 11C7.98239 11 6.24394 12.195 5.45374 13.9157C6.55403 15.192 8.18265 16 9.99998 16C11.8173 16 13.4459 15.1921 14.5462 13.9158C13.756 12.195 12.0175 11 9.99993 11Z"
      fill="currentColor"
    ></path>
  </svg>
);

const Sidenav: React.FC<SidenavProps> = ({ color = "#1890ff" }) => {
  const { pathname } = useLocation();
  const page = pathname.replace("/", "");

  return (
    <>
      <div className="brand">
        <img src={logo} alt="logo" />
        <span>Expense Tracker</span>
      </div>
      <hr />
      <Menu theme="light" mode="inline">
        <Menu.Item key="1">
          <NavLink to="/">
            <span
              className="icon"
              style={{
                background: page === "" ? color : "",
              }}
            >
              {dashboardIcon}
            </span>
            <span className="label">Trang chủ</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item key="2">
          <NavLink to="/wallets">
            <span
              className="icon"
              style={{
                background: page === "wallets" ? color : "",
              }}
            >
              {walletsIcon}
            </span>
            <span className="label">Quản lý ví</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item key="3">
          <NavLink to="/transactions">
            <span
              className="icon"
              style={{
                background: page === "transactions" ? color : "",
              }}
            >
              {transactionIcon}
            </span>
            <span className="label">Giao dịch</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item key="4">
          <NavLink to="/goals">
            <span
              className="icon"
              style={{
                background: page === "goals" ? color : "",
              }}
            >
              {goalsIcon}
            </span>
            <span className="label">Mục tiêu</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item key="5">
          <NavLink to="/dishes">
            <span
              className="icon"
              style={{
                background: page === "dishes" ? color : "",
              }}
            >
              {dishesIcon}
            </span>
            <span className="label">Gợi ý ăn uống</span>
          </NavLink>
        </Menu.Item>
        <Menu.Item className="menu-item-header" key="6">
          Tài khoản
        </Menu.Item>
        <Menu.Item key="7">
          <NavLink to="/profile">
            <span
              className="icon"
              style={{
                background: page === "profile" ? color : "",
              }}
            >
              {profileIcon}
            </span>
            <span className="label">Hồ sơ cá nhân</span>
          </NavLink>
        </Menu.Item>
      </Menu>
      <div className="aside-footer">
        <div
          className="footer-box"
          style={{
            background: color,
          }}
        >
          <span className="icon" style={{ color }}>
            {dashboardIcon}
          </span>
          <h6>Cần trợ giúp?</h6>
          <p>Kiểm tra tài liệu hướng dẫn</p>
          <Button type="primary" className="ant-btn-sm ant-btn-block">
            TÀI LIỆU
          </Button>
        </div>
      </div>
    </>
  );
};

export default Sidenav;
