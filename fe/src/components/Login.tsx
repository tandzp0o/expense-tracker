import React, { useEffect } from "react";
import { signInWithGoogle } from "../firebase/config";
import { Button, Typography, Box, Container, Paper } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const Login: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/';

    // Tự động chuyển hướng nếu đã đăng nhập
    useEffect(() => {
        if (currentUser) {
            navigate(from, { replace: true });
        }
    }, [currentUser, from, navigate]);

    const handleGoogleSignIn = async () => {
        try {
            const token = await signInWithGoogle();
            if (!token) {
                throw new Error('Không nhận được token từ Google');
            }

            // console.log("Token nhận được (first 20 chars):", token.substring(0, 200) + "...");
            console.log("Token nhận được (first 20 chars):", token);

            const response = await fetch("http://localhost:5000/api/auth/verify", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            console.log("Status code:", response.status);
            const data = await response.json();
            console.log("Phản hồi từ server:", data);

            if (!response.ok) {
                throw new Error(data.message || "Lỗi không xác định từ server");
            }

            // Chuyển hướng sau khi đăng nhập thành công
            navigate(from, { replace: true });
        } catch (error) {
            console.error("Lỗi chi tiết:", error);
            // Không cần hiển thị alert ở đây vì AuthContext đã xử lý
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <Paper elevation={3} sx={{ p: 4, width: "100%" }}>
                    <Typography
                        component="h1"
                        variant="h5"
                        align="center"
                        mb={3}
                    >
                        Đăng nhập vào Expense Tracker
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handleGoogleSignIn}
                        startIcon={<GoogleIcon />}
                        sx={{ mb: 2 }}
                    >
                        Đăng nhập với Google
                    </Button>
                </Paper>
            </Box>
        </Container>
    );
};

export default Login;




// import React, { useState } from 'react';
// import { Button, Card, Typography, Divider, message, Row, Col } from 'antd';
// import { GoogleOutlined } from '@ant-design/icons';
// import { useAuth } from '../contexts/AuthContext';
// import { useNavigate } from 'react-router-dom';

// const { Title, Text } = Typography;

// const Login: React.FC = () => {
//   const { signInWithGoogle } = useAuth();
//   const [loading, setLoading] = useState(false);
//   const navigate = useNavigate();

//   const handleGoogleSignIn = async () => {
//     try {
//       setLoading(true);
//       await signInWithGoogle();
//       message.success('Đăng nhập thành công');
//       navigate('/');
//     } catch (error) {
//       console.error('Lỗi đăng nhập:', error);
//       message.error('Đăng nhập thất bại. Vui lòng thử lại.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{
//       minHeight: '100vh',
//       display: 'flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//       background: '#f0f2f5',
//       padding: '24px'
//     }}>
//       <Card 
//         style={{ 
//           width: '100%',
//           maxWidth: 480,
//           borderRadius: 8,
//           boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
//         }}
//         bodyStyle={{ padding: '40px' }}
//       >
//         <Row justify="center" gutter={[24, 24]}>
//           <Col span={24} style={{ textAlign: 'center' }}>
//             <Title level={2} style={{ marginBottom: 8 }}>Chào mừng trở lại</Title>
//             <Text type="secondary">Đăng nhập để tiếp tục sử dụng ứng dụng</Text>
//           </Col>
          
//           <Col span={24}>
//             <Button
//               type="primary"
//               icon={<GoogleOutlined />}
//               size="large"
//               block
//               onClick={handleGoogleSignIn}
//               loading={loading}
//               style={{
//                 height: 48,
//                 fontSize: 16,
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 gap: 8,
//                 borderRadius: 6
//               }}
//             >
//               Đăng nhập với Google
//             </Button>
//           </Col>
          
//           <Col span={24}>
//             <Divider>hoặc</Divider>
//           </Col>
          
//           <Col span={24} style={{ textAlign: 'center' }}>
//             <Text type="secondary">
//               Bằng cách đăng nhập, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi
//             </Text>
//           </Col>
//         </Row>
//       </Card>
//     </div>
//   );
// };

// export default Login;
