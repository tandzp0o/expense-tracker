import React, { useState } from "react";
import { Form, Button, Typography, message } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import googleLogo from "../assets/images/Google__G__Logo.svg.png";

const { Title } = Typography;

const Login: React.FC = () => {
    const { currentUser, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || "/";
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            await signInWithGoogle();
            navigate(from, { replace: true });
        } catch (error) {
            console.error("Lỗi chi tiết khi đăng nhập:", error);
            message.error("Đăng nhập thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    if (currentUser) {
        return null;
    }

    return (
        <>
            <div className="layout-default layout-signin">
                <div style={{ padding: "0 24px" }}>
                    <div className="header-col header-brand">
                        <h5
                            style={{ margin: 0, fontSize: 24, fontWeight: 600 }}
                        >
                            Quản lý tài chính
                        </h5>
                    </div>
                </div>
                <div className="signin">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: "calc(100vh - 200px)",
                        }}
                    >
                        <div
                            style={{
                                width: "100%",
                                maxWidth: 400,
                                margin: "0 auto",
                            }}
                        >
                            <Title
                                className="mb-15"
                                level={2}
                                style={{ textAlign: "center" }}
                            >
                                Đăng nhập
                            </Title>
                            <Title
                                className="font-regular text-muted"
                                level={5}
                                style={{
                                    textAlign: "center",
                                    marginBottom: 32,
                                }}
                            >
                                Quản lý tài chính cá nhân của bạn
                            </Title>

                            <Form layout="vertical">
                                <Form.Item>
                                    <Button
                                        type="primary"
                                        size="large"
                                        block
                                        onClick={handleGoogleSignIn}
                                        loading={loading}
                                        icon={
                                            <img
                                                src={googleLogo}
                                                alt="Google"
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    marginRight: 8,
                                                }}
                                            />
                                        }
                                    >
                                        {loading
                                            ? "Đang xử lý..."
                                            : "Đăng nhập với Google"}
                                    </Button>
                                </Form.Item>

                                <Form.Item style={{ textAlign: "center" }}>
                                    <p
                                        style={{
                                            marginBottom: 0,
                                            color: "#999",
                                        }}
                                    >
                                        Bằng cách đăng nhập, bạn đồng ý với{" "}
                                        <button
                                            type="button"
                                            style={{
                                                color: "#1890ff",
                                                background: "transparent",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Điều khoản sử dụng
                                        </button>{" "}
                                        và{" "}
                                        <button
                                            type="button"
                                            style={{
                                                color: "#1890ff",
                                                background: "transparent",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                            }}
                                        >
                                            Chính sách bảo mật
                                        </button>
                                    </p>
                                </Form.Item>
                            </Form>
                        </div>
                    </div>
                </div>
                <div
                    style={{
                        textAlign: "center",
                        padding: "24px",
                        color: "#999",
                    }}
                >
                    <p style={{ marginBottom: 0 }}>
                        Copyright © 2024 Quản lý tài chính. All Rights Reserved.
                    </p>
                </div>
            </div>
        </>
    );
};

export default Login;
