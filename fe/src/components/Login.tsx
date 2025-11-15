import React, { useEffect, useState } from "react";
import { Button, Typography, Box, Container, Paper, CircularProgress } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const Login: React.FC = () => {
    const { currentUser, signInWithGoogle } = useAuth(); // <-- Lấy hàm signInWithGoogle từ context
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';
    const [loading, setLoading] = useState(false);

    // Tự động chuyển hướng nếu người dùng đã được xác thực
    useEffect(() => {
        if (currentUser) {
            navigate(from, { replace: true });
        }
    }, [currentUser, from, navigate]);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            // Chỉ cần gọi hàm từ context, không cần xử lý token hay fetch ở đây
            await signInWithGoogle();
            
            // AuthContext sẽ tự động cập nhật currentUser
            // và useEffect ở trên sẽ xử lý việc chuyển hướng.
            // Chúng ta không cần gọi navigate ở đây nữa.
            
        } catch (error) {
            console.error("Lỗi chi tiết khi đăng nhập:", error);
            // Có thể thêm thông báo lỗi cho người dùng ở đây nếu muốn
            alert("Đăng nhập thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };
    
    // Nếu currentUser đã có giá trị, không render gì cả để useEffect thực hiện chuyển hướng
    if (currentUser) {
        return null; 
    }

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
                        Đăng nhập
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={handleGoogleSignIn}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
                        disabled={loading}
                        sx={{ mb: 2 }}
                    >
                        {loading ? "Đang xử lý..." : "Đăng nhập với Google"}
                    </Button>
                </Paper>
            </Box>
        </Container>
    );
};

export default Login;