import React, { useState, useEffect, useCallback } from "react";
import {
    Card,
    Form,
    Input,
    Button,
    Avatar,
    Upload,
    message,
    Divider,
    Statistic,
    Row,
    Col,
    Progress,
    Radio,
    Spin,
} from "antd";
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    EditOutlined,
    SaveOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import { auth } from "../firebase/config";
import { formatCurrency } from "../utils/formatters";
import { userApi } from "../services/api";

import BgProfile from "../assets/images/bg-profile.jpg";
import defaultAvatar from "../assets/images/face-1.jpg";

const { TextArea } = Input;

interface UserProfile {
    displayName: string;
    email: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    goalsCompleted: number;
    goalsActive: number;
}

const Profile_new: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const loadProfile = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return;

        setLoading(true);
        try {
            const token = await user.getIdToken();
            const profileData = await userApi.getProfile(token);

            const fullProfile: UserProfile = {
                displayName:
                    profileData.displayName ||
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "Người dùng",
                email: profileData.email || user.email || "",
                phone: profileData.phone || "",
                bio: profileData.bio || "",
                avatar: profileData.avatar || user.photoURL || undefined,
                totalBalance: profileData.totalBalance || 0,
                totalIncome: profileData.totalIncome || 0,
                totalExpense: profileData.totalExpense || 0,
                goalsCompleted: profileData.goalsCompleted || 0,
                goalsActive: profileData.goalsActive || 0,
            };

            setProfile(fullProfile);
            form.setFieldsValue(fullProfile);
        } catch (error) {
            message.error("Lỗi khi tải hồ sơ");
        } finally {
            setLoading(false);
        }
    }, [form]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                loadProfile();
            }
        });

        return () => unsubscribe();
    }, [loadProfile]);

    const handleUpdateProfile = async (values: any) => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                message.error("Xác thực người dùng thất bại.");
                return;
            }
            const token = await user.getIdToken();
            await userApi.updateProfile(values, token);
            message.success("Cập nhật hồ sơ thành công!");
            setIsEditing(false);
            loadProfile();
        } catch (error) {
            message.error("Lỗi cập nhật hồ sơ");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (info: any) => {
        if (info.file.status === "done") {
            message.success("Ảnh đại diện đã được tải lên thành công!");
            loadProfile();
        } else if (info.file.status === "error") {
            message.error(`${info.file.name} tải lên thất bại.`);
        }
    };

    const customRequest = async ({ file, onSuccess, onError }: any) => {
        const user = auth.currentUser;
        if (!user) {
            onError("Xác thực người dùng thất bại.");
            return;
        }
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append("avatar", file);

            const response = await userApi.uploadAvatar(formData, token);
            if (response.avatarUrl) {
                onSuccess(response, file);
            } else {
                onError("Không nhận được URL ảnh đại diện từ máy chủ.");
            }
        } catch (error: any) {
            onError(error.message || "Lỗi tải lên ảnh đại diện.");
        } finally {
            setLoading(false);
        }
    };

    const beforeUpload = (file: any) => {
        const isJpgOrPng =
            file.type === "image/jpeg" || file.type === "image/png";
        if (!isJpgOrPng) {
            message.error("Bạn chỉ có thể tải lên file JPG/PNG!");
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
            message.error("Kích thước ảnh phải nhỏ hơn 2MB!");
        }
        return isJpgOrPng && isLt2M;
    };

    if (loading && !profile) {
        return (
            <div style={{ textAlign: "center", padding: "50px" }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ textAlign: "center", padding: "50px" }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="ekash_page">
            <div className="ekash_page_header">
                <div>
                    <h2 className="ekash_title">Thông tin cá nhân</h2>
                    <p className="ekash_subtitle">
                        Quản lý thông tin tài khoản của bạn
                    </p>
                </div>
                <div className="ekash_breadcrumb">
                    Home <span className="sep">›</span> Thông tin cá nhân
                </div>
            </div>

            {/* Profile Header with Background */}
            <div className="ekash_profile_header">
                <div
                    className="ekash_profile_bg"
                    style={{ backgroundImage: `url(${BgProfile})` }}
                />
                <div className="ekash_profile_content">
                    <div className="ekash_profile_avatar">
                        <Avatar
                            size={120}
                            src={profile.avatar || defaultAvatar}
                            icon={<UserOutlined />}
                            className="ekash_avatar"
                        />
                        <Upload
                            name="avatar"
                            className="ekash_avatar_upload"
                            showUploadList={false}
                            beforeUpload={beforeUpload}
                            customRequest={customRequest}
                            onChange={handleAvatarChange}
                        >
                            <Button
                                icon={<UploadOutlined />}
                                className="ekash_btn ekash_btn_small"
                            >
                                Đổi ảnh
                            </Button>
                        </Upload>
                    </div>
                    <div className="ekash_profile_info">
                        <h1 className="ekash_profile_name">
                            {profile.displayName}
                        </h1>
                        <p className="ekash_profile_email">{profile.email}</p>
                        {profile.phone && (
                            <p className="ekash_profile_phone">
                                <PhoneOutlined /> {profile.phone}
                            </p>
                        )}
                        {profile.bio && (
                            <p className="ekash_profile_bio">{profile.bio}</p>
                        )}
                    </div>
                    <div className="ekash_profile_actions">
                        <Button
                            type="primary"
                            icon={
                                isEditing ? <SaveOutlined /> : <EditOutlined />
                            }
                            onClick={() => {
                                if (isEditing) {
                                    form.submit();
                                } else {
                                    setIsEditing(true);
                                }
                            }}
                            className="ekash_btn primary"
                        >
                            {isEditing ? "Lưu thay đổi" : "Chỉnh sửa thông tin"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="ekash_grid_main">
                {/* Statistics */}
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Thống kê tài chính</p>
                    </div>
                    <div className="ekash_stats_grid">
                        <div className="ekash_stat_item">
                            <div className="ekash_stat_value">
                                {formatCurrency(profile.totalBalance)}
                            </div>
                            <div className="ekash_stat_label">Tổng số dư</div>
                        </div>
                        <div className="ekash_stat_item">
                            <div className="ekash_stat_value">
                                {formatCurrency(profile.totalIncome)}
                            </div>
                            <div className="ekash_stat_label">
                                Tổng thu nhập
                            </div>
                        </div>
                        <div className="ekash_stat_item">
                            <div className="ekash_stat_value">
                                {formatCurrency(profile.totalExpense)}
                            </div>
                            <div className="ekash_stat_label">
                                Tổng chi tiêu
                            </div>
                        </div>
                        <div className="ekash_stat_item">
                            <div className="ekash_stat_value">
                                {profile.goalsCompleted}
                            </div>
                            <div className="ekash_stat_label">
                                Mục tiêu hoàn thành
                            </div>
                        </div>
                    </div>
                </div>

                {/* Goals Progress */}
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Tiến độ mục tiêu</p>
                    </div>
                    <div className="ekash_goals_section">
                        <div className="ekash_goal_item">
                            <div className="ekash_goal_info">
                                <span className="ekash_goal_label">
                                    Đang hoạt động
                                </span>
                                <span className="ekash_goal_count">
                                    {profile.goalsActive}
                                </span>
                            </div>
                            <div className="ekash_goal_info">
                                <span className="ekash_goal_label">
                                    Đã hoàn thành
                                </span>
                                <span className="ekash_goal_count">
                                    {profile.goalsCompleted}
                                </span>
                            </div>
                        </div>
                        {profile.goalsActive > 0 && (
                            <div className="ekash_progress_section">
                                <div className="ekash_progress_label">
                                    Tiến độ hoàn thành
                                </div>
                                <Progress
                                    percent={Math.round(
                                        (profile.goalsCompleted /
                                            (profile.goalsActive +
                                                profile.goalsCompleted)) *
                                            100,
                                    )}
                                    strokeColor={{
                                        "0%": "#108ee9",
                                        "100%": "#87d068",
                                    }}
                                    className="ekash_progress"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
                <div className="ekash_card">
                    <div className="ekash_card_header">
                        <p className="ekash_card_title">Chỉnh sửa thông tin</p>
                    </div>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdateProfile}
                        className="ekash_form"
                    >
                        <Row gutter={24}>
                            <Col span={12}>
                                <Form.Item
                                    name="displayName"
                                    label="Họ và tên"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Vui lòng nhập họ và tên",
                                        },
                                    ]}
                                >
                                    <Input placeholder="Nhập họ và tên" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="phone" label="Số điện thoại">
                                    <Input placeholder="Nhập số điện thoại" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item name="bio" label="Tiểu sử">
                            <TextArea
                                rows={4}
                                placeholder="Giới thiệu ngắn về bản thân..."
                                maxLength={200}
                                showCount
                            />
                        </Form.Item>
                        <Form.Item
                            style={{ marginBottom: 0, textAlign: "right" }}
                        >
                            <Button
                                onClick={() => {
                                    setIsEditing(false);
                                    form.setFieldsValue(profile);
                                }}
                                style={{ marginRight: 8 }}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                            >
                                Lưu thay đổi
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            )}
        </div>
    );
};

export default Profile_new;
