import React from "react";
import { Layout, Row, Col, Typography } from "antd";

const { Text } = Typography;

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-main">
      <Layout.Footer
        style={{ background: "transparent", border: "none", padding: "0" }}
      >
        <Row
          gutter={[40, 40]}
          justify="space-between"
          align="top"
          style={{ marginBottom: "30px" }}
        >
          <Col xs={24} sm={12} md={6}>
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontWeight: 600, marginBottom: "10px" }}>
                Expense Tracker
              </h4>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Ứng dụng quản lý chi tiêu cá nhân toàn diện
              </Text>
            </div>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <h4 style={{ fontWeight: 600, marginBottom: "15px" }}>Tính năng</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Quản lý ví
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Theo dõi giao dịch
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Đặt mục tiêu
                </button>
              </li>
            </ul>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <h4 style={{ fontWeight: 600, marginBottom: "15px" }}>Hỗ trợ</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Hướng dẫn sử dụng
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Liên hệ chúng tôi
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  FAQ
                </button>
              </li>
            </ul>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <h4 style={{ fontWeight: 600, marginBottom: "15px" }}>Pháp lý</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Điều khoản sử dụng
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Chính sách bảo mật
                </button>
              </li>
              <li style={{ marginBottom: "8px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: 0,
                    textDecoration: "none",
                  }}
                >
                  Chính sách cookie
                </button>
              </li>
            </ul>
          </Col>
        </Row>

        <Row
          justify="space-between"
          align="middle"
          style={{ paddingTop: "20px", borderTop: "1px solid #e8e8e8" }}
        >
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              © {currentYear} Expense Tracker. All rights reserved.
            </Text>
          </Col>
          <Col
            xs={24}
            md={12}
            style={{
              textAlign: "right" as any,
              marginTop: "10px",
            }}
          >
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Made with ❤️ by Expense Tracker Team
            </Text>
          </Col>
        </Row>
      </Layout.Footer>
    </footer>
  );
};

export default Footer;
