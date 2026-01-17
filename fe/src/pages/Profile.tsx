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

const Profile: React.FC = () => {
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
            loadProfile(); // Refresh profile data
        } catch (error) {
            message.error("Lỗi cập nhật hồ sơ");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (info: any) => {
        if (info.file.status === "done") {
            message.success("Ảnh đại diện đã được tải lên thành công!");
            loadProfile(); // Tải lại hồ sơ để hiển thị ảnh mới
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

    if (!profile) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <div
                className="profile-nav-bg"
                style={{ backgroundImage: "url(" + BgProfile + ")" }}
            ></div>

            <Card
                className="card-profile-head"
                bodyStyle={{ display: "none" }}
                title={
                    <Row
                        justify="space-between"
                        align="middle"
                        gutter={[24, 0]}
                    >
                        <Col span={24} md={12} className="col-info">
                            <Avatar.Group>
                                <Avatar
                                    size={74}
                                    shape="square"
                                    src={profile.avatar || defaultAvatar}
                                    icon={<UserOutlined />}
                                />
                                <div className="avatar-info">
                                    <h4 className="font-semibold m-0">
                                        {profile.displayName}
                                    </h4>
                                    <p>{profile.email}</p>
                                </div>
                            </Avatar.Group>
                        </Col>
                        <Col
                            span={24}
                            md={12}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 12,
                            }}
                        >
                            <Radio.Group defaultValue="overview">
                                <Radio.Button value="overview">
                                    OVERVIEW
                                </Radio.Button>
                                <Radio.Button value="edit">EDIT</Radio.Button>
                            </Radio.Group>
                            <Upload
                                showUploadList={false}
                                onChange={handleAvatarChange}
                                beforeUpload={beforeUpload}
                                customRequest={customRequest}
                                accept="image/*"
                            >
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    loading={loading}
                                >
                                    Đổi ảnh
                                </Button>
                            </Upload>
                        </Col>
                    </Row>
                }
            ></Card>

            <Row gutter={[24, 0]}>
                <Col span={24} md={8} className="mb-24">
                    <Card
                        bordered={false}
                        className="header-solid h-full"
                        title={<h6 className="font-semibold m-0">Thống kê</h6>}
                    >
                        <Row gutter={[16, 16]}>
                            <Col span={24}>
                                <Statistic
                                    title="Tổng số dư"
                                    value={profile.totalBalance}
                                    formatter={(value) =>
                                        formatCurrency(Number(value))
                                    }
                                />
                            </Col>
                            <Col span={24}>
                                <Statistic
                                    title="Tổng thu nhập"
                                    value={profile.totalIncome}
                                    formatter={(value) =>
                                        formatCurrency(Number(value))
                                    }
                                    valueStyle={{ color: "#52c41a" }}
                                />
                            </Col>
                            <Col span={24}>
                                <Statistic
                                    title="Tổng chi tiêu"
                                    value={profile.totalExpense}
                                    formatter={(value) =>
                                        formatCurrency(Number(value))
                                    }
                                    valueStyle={{ color: "#f5222d" }}
                                />
                            </Col>
                            <Col span={24}>
                                <Divider style={{ margin: "12px 0" }} />
                                <div style={{ marginBottom: 12 }}>
                                    <h6 className="font-semibold m-0">
                                        Mục tiêu hoàn thành
                                    </h6>
                                    <Progress
                                        percent={
                                            profile.goalsActive +
                                                profile.goalsCompleted >
                                            0
                                                ? Math.round(
                                                      (profile.goalsCompleted /
                                                          (profile.goalsActive +
                                                              profile.goalsCompleted)) *
                                                          100,
                                                  )
                                                : 0
                                        }
                                        status="active"
                                    />
                                </div>
                                <div>
                                    <h6 className="font-semibold m-0">
                                        Mục tiêu đang thực hiện
                                    </h6>
                                    <Progress
                                        percent={
                                            profile.goalsActive +
                                                profile.goalsCompleted >
                                            0
                                                ? Math.round(
                                                      (profile.goalsActive /
                                                          (profile.goalsActive +
                                                              profile.goalsCompleted)) *
                                                          100,
                                                  )
                                                : 0
                                        }
                                        status="active"
                                        strokeColor="#1890ff"
                                    />
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col span={24} md={16} className="mb-24">
                    <Card
                        bordered={false}
                        title={
                            <h6 className="font-semibold m-0">
                                Profile Information
                            </h6>
                        }
                        className="header-solid h-full card-profile-information"
                        extra={
                            <Button
                                type={isEditing ? "primary" : "default"}
                                icon={
                                    isEditing ? (
                                        <SaveOutlined />
                                    ) : (
                                        <EditOutlined />
                                    )
                                }
                                onClick={() => {
                                    if (isEditing) {
                                        form.submit();
                                    } else {
                                        setIsEditing(true);
                                    }
                                }}
                                loading={loading}
                            >
                                {isEditing ? "Lưu" : "Chỉnh sửa"}
                            </Button>
                        }
                        bodyStyle={{ paddingTop: 0, paddingBottom: 16 }}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleUpdateProfile}
                            disabled={!isEditing}
                        >
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        name="displayName"
                                        label="Tên hiển thị"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Vui lòng nhập tên hiển thị",
                                            },
                                        ]}
                                    >
                                        <Input
                                            prefix={<UserOutlined />}
                                            placeholder="Nhập tên"
                                        />
                                    </Form.Item>
                                </Col>

                                <Col span={12}>
                                    <Form.Item
                                        name="phone"
                                        label="Số điện thoại"
                                    >
                                        <Input
                                            prefix={<PhoneOutlined />}
                                            placeholder="Nhập số điện thoại"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="email" label="Email">
                                <Input prefix={<MailOutlined />} disabled />
                            </Form.Item>

                            <Form.Item name="bio" label="Giới thiệu">
                                <TextArea
                                    rows={4}
                                    placeholder="Giới thiệu về bạn"
                                />
                            </Form.Item>

                            <Divider style={{ margin: "12px 0" }} />

                            {isEditing && (
                                <div style={{ textAlign: "right" }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                    >
                                        Lưu thay đổi
                                    </Button>
                                </div>
                            )}
                        </Form>
                    </Card>
                </Col>
            </Row>
        </>
    );
};

export default Profile;
