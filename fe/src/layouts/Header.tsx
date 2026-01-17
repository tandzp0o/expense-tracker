import React from "react";
import {
    Row,
    Col,
    Breadcrumb,
    Badge,
    Button,
    Dropdown,
    Avatar,
    Input,
} from "antd";
import {
    SearchOutlined,
    MenuOutlined,
    LogoutOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";

interface HeaderProps {
    onMenuClick?: () => void;
}

const bellIcon = (
    <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            d="M10 2C6.68632 2 4.00003 4.68629 4.00003 8V11.5858L3.29292 12.2929C3.00692 12.5789 2.92137 13.009 3.07615 13.3827C3.23093 13.7564 3.59557 14 4.00003 14H16C16.4045 14 16.7691 13.7564 16.9239 13.3827C17.0787 13.009 16.9931 12.5789 16.7071 12.2929L16 11.5858V8C16 4.68629 13.3137 2 10 2Z"
            fill="#111827"
        ></path>
        <path
            d="M10 18C8.34315 18 7 16.6569 7 15H13C13 16.6569 11.6569 18 10 18Z"
            fill="#111827"
        ></path>
    </svg>
);

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();

    // Generate breadcrumb items based on current route
    const getBreadcrumbs = () => {
        const pathnames = location.pathname.split("/").filter((x) => x);
        const breadcrumbs = [
            { title: "Trang chủ", onClick: () => navigate("/") },
        ];

        const breadcrumbMap: { [key: string]: string } = {
            wallets: "Quản lý ví",
            transactions: "Giao dịch",
            goals: "Mục tiêu",
            profile: "Hồ sơ cá nhân",
            dishes: "Gợi ý ăn uống",
        };

        pathnames.forEach((name) => {
            const label = breadcrumbMap[name] || name;
            breadcrumbs.push({
                title: label,
                onClick: () => {},
            });
        });

        return breadcrumbs;
    };

    const userMenuItems = [
        {
            key: "profile",
            icon: <UserOutlined />,
            label: "Hồ sơ cá nhân",
            onClick: () => navigate("/profile"),
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "Đăng xuất",
            onClick: logout,
        },
    ];

    return (
        <div className="header-with-breadcrumb">
            <Row
                justify="space-between"
                align="middle"
                className="header-row"
                style={{
                    width: "100%",
                    padding: "0 24px",
                    height: "100%",
                }}
            >
                <Col>
                    <Button
                        type="text"
                        className="sidebar-toggler"
                        icon={<MenuOutlined />}
                        onClick={onMenuClick}
                        style={{ color: "inherit" }}
                    />
                    <Breadcrumb items={getBreadcrumbs()} />
                </Col>
                <Col>
                    <Row gutter={16} align="middle" className="header-actions">
                        <Col>
                            <Input
                                className="header-search-input"
                                placeholder="Tìm kiếm..."
                                prefix={<SearchOutlined />}
                                style={{ width: "200px" }}
                                allowClear
                            />
                        </Col>
                        <Col>
                            <Badge count={3} offset={[-5, 5]}>
                                <Button
                                    type="text"
                                    style={{ border: "none", padding: 0 }}
                                    icon={bellIcon}
                                />
                            </Badge>
                        </Col>
                        <Col>
                            <ThemeSwitcher />
                        </Col>
                        <Col>
                            <Dropdown
                                menu={{ items: userMenuItems }}
                                trigger={["click"]}
                            >
                                <Avatar
                                    size={32}
                                    icon={<UserOutlined />}
                                    style={{
                                        cursor: "pointer",
                                        backgroundColor: "#1890ff",
                                    }}
                                />
                            </Dropdown>
                        </Col>
                    </Row>
                </Col>
            </Row>
        </div>
    );
};

export default Header;
