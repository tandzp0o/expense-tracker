import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadProfile();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadProfile = async () => {
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
  };

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
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
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
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>
          Hồ sơ cá nhân
        </h1>
        <p style={{ margin: "8px 0 0 0", color: "#666" }}>
          Quản lý thông tin cá nhân của bạn
        </p>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "16px" }}>
              <Avatar
                size={120}
                src={profile.avatar}
                icon={<UserOutlined />}
                style={{ fontSize: "48px" }}
              />
            </div>

            <Upload
              showUploadList={false}
              onChange={handleAvatarChange}
              beforeUpload={beforeUpload}
              customRequest={customRequest}
              accept="image/*"
            >
              <Button
                icon={<UploadOutlined />}
                style={{ marginBottom: "16px" }}
              >
                Đổi ảnh đại diện
              </Button>
            </Upload>

            <h2 style={{ margin: "16px 0 8px 0", fontSize: "20px" }}>
              {profile.displayName}
            </h2>
            <p style={{ margin: 0, color: "#666" }}>{profile.email}</p>

            <Divider />

            <div style={{ textAlign: "left" }}>
              <div style={{ marginBottom: "12px" }}>
                <MailOutlined
                  style={{ marginRight: "8px", color: "#1890ff" }}
                />
                <span>{profile.email}</span>
              </div>
              {profile.phone && (
                <div>
                  <PhoneOutlined
                    style={{ marginRight: "8px", color: "#52c41a" }}
                  />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title="Thông tin cá nhân"
            extra={
              <Button
                type={isEditing ? "primary" : "default"}
                icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
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
                      { required: true, message: "Vui lòng nhập tên hiển thị" },
                    ]}
                  >
                    <Input placeholder="Nhập tên hiển thị" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: "Vui lòng nhập email" },
                      { type: "email", message: "Email không hợp lệ" },
                    ]}
                  >
                    <Input placeholder="Nhập email" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="phone" label="Số điện thoại">
                <Input placeholder="Nhập số điện thoại" />
              </Form.Item>

              <Form.Item name="bio" label="Giới thiệu bản thân">
                <TextArea
                  rows={4}
                  placeholder="Hãy viết gì đó về bản thân bạn..."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card title="Thống kê tài chính" style={{ marginTop: "24px" }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Tổng số dư"
                  value={profile.totalBalance}
                  formatter={(value) => formatCurrency(Number(value))}
                  valueStyle={{
                    color: profile.totalBalance >= 0 ? "#3f8600" : "#cf1322",
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Tổng thu nhập"
                  value={profile.totalIncome}
                  formatter={(value) => formatCurrency(Number(value))}
                  valueStyle={{ color: "#3f8600" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Tổng chi tiêu"
                  value={profile.totalExpense}
                  formatter={(value) => formatCurrency(Number(value))}
                  valueStyle={{ color: "#cf1322" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Mục tiêu hoàn thành"
                  value={profile.goalsCompleted}
                  suffix={`/ ${profile.goalsCompleted + profile.goalsActive}`}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Col>
            </Row>

            <Divider />

            <div style={{ marginTop: "16px" }}>
              <h4>Tiến độ mục tiêu</h4>
              <Progress
                percent={Math.round(
                  (profile.goalsCompleted /
                    (profile.goalsCompleted + profile.goalsActive)) *
                    100
                )}
                status="active"
                strokeColor="#52c41a"
              />
              <p style={{ marginTop: "8px", color: "#666", fontSize: "14px" }}>
                Đã hoàn thành {profile.goalsCompleted} trên tổng số{" "}
                {profile.goalsCompleted + profile.goalsActive} mục tiêu
              </p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;
