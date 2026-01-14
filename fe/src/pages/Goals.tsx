import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  List,
  Progress,
  Tag,
  message,
  Modal,
  Select,
  DatePicker,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Target } from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { auth } from "../firebase/config";
import { goalApi } from "../services/api";
import dayjs from "dayjs";

const { Option } = Select;
const { TextArea } = Input;

interface Goal {
  _id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  category: string;
  deadline?: Date;
  status: "active" | "completed" | "expired";
  createdAt: Date;
}

const categoryOptions = [
  { label: "Tiết kiệm", value: "saving" },
  { label: "Đầu tư", value: "investment" },
  { label: "Mua sắm", value: "shopping" },
  { label: "Du lịch", value: "travel" },
  { label: "Giáo dục", value: "education" },
  { label: "Sức khỏe", value: "health" },
  { label: "Khác", value: "other" },
];

const Goals: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form] = Form.useForm();

  const fetchGoals = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await goalApi.getGoals(token);
      console.log("Goals response:", response); // Debug log

      // Ensure proper data format
      const formattedGoals = Array.isArray(response) ? response.map(goal => ({
        ...goal,
        deadline: goal.deadline ? new Date(goal.deadline) : undefined,
        createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
      })) : [];

      setGoals(formattedGoals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      message.error("Lỗi khi tải danh sách mục tiêu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreateGoal = async (values: any) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        message.error("Xác thực người dùng thất bại.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      const goalData = {
        title: values.title,
        description: values.description,
        targetAmount: values.targetAmount,
        currentAmount: values.currentAmount || 0,
        category: values.category,
        deadline: values.deadline?.toDate(),
      };
      await goalApi.createGoal(goalData, token);
      message.success("Thêm mục tiêu thành công!");
      form.resetFields();
      setIsModalVisible(false);
      fetchGoals(); // Refresh the list
    } catch (error) {
      message.error("Lỗi khi thêm mục tiêu");
    }
  };

  const handleUpdateGoal = async (values: any) => {
    if (!editingGoal) return;
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        message.error("Xác thực người dùng thất bại.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      const goalData = {
        title: values.title,
        description: values.description,
        targetAmount: values.targetAmount,
        currentAmount: values.currentAmount || editingGoal.currentAmount,
        category: values.category,
        deadline: values.deadline?.toDate(),
      };
      await goalApi.updateGoal(editingGoal._id, goalData, token);
      message.success("Cập nhật mục tiêu thành công!");
      setIsModalVisible(false);
      setEditingGoal(null);
      fetchGoals(); // Refresh the list
    } catch (error) {
      message.error("Lỗi cập nhật mục tiêu");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        message.error("Xác thực người dùng thất bại.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      await goalApi.deleteGoal(goalId, token);
      message.success("Xóa mục tiêu thành công!");
      fetchGoals(); // Refresh the list
    } catch (error) {
      message.error("Lỗi xóa mục tiêu");
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "#52c41a";
    if (percentage >= 75) return "#1890ff";
    if (percentage >= 50) return "#faad14";
    return "#ff4d4f";
  };

  const getCategoryLabel = (category: string) => {
    return (
      categoryOptions.find((cat) => cat.value === category)?.label || category
    );
  };

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600 }}>
            Mục tiêu tài chính
          </h1>
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>
            Theo dõi và đạt được mục tiêu của bạn
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingGoal(null);
            form.resetFields();
            setIsModalVisible(true);
          }}
          size="large"
        >
          Thêm mục tiêu
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            Đang tải danh sách mục tiêu...
          </div>
        ) : goals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Target size={48} style={{ color: "#d9d9d9", marginBottom: "16px" }} />
            <p style={{ color: "#666", marginBottom: "16px" }}>
              Bạn chưa có mục tiêu nào
            </p>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingGoal(null);
                form.resetFields();
                setIsModalVisible(true);
              }}
            >
              Tạo mục tiêu đầu tiên
            </Button>
          </div>
        ) : (
          goals.map((goal) => {
            // console.log("Rendering goal:", goal); // Debug log
            const percentage = Math.min(
              (goal.currentAmount / goal.targetAmount) * 100,
              100
            );
            return (
              <Card
                key={goal._id}
                hoverable
                actions={[
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingGoal(goal);
                      form.setFieldsValue({
                        title: goal.title,
                        description: goal.description,
                        targetAmount: goal.targetAmount,
                        currentAmount: goal.currentAmount,
                        category: goal.category,
                        deadline: goal.deadline
                          ? dayjs(goal.deadline)
                          : undefined,
                      });
                      setIsModalVisible(true);
                    }}
                  >
                    Sửa
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteGoal(goal._id)}
                  >
                    Xóa
                  </Button>,
                ]}
              >
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                    {goal.title}
                  </h3>
                  <Tag color={goal.status === "completed" ? "green" : "blue"}>
                    {goal.status === "completed"
                      ? "Hoàn thành"
                      : "Đang thực hiện"}
                  </Tag>
                </div>
                <p style={{ margin: "4px 0", color: "#666" }}>
                  {goal.description}
                </p>
                <Tag color="purple">{getCategoryLabel(goal.category)}</Tag>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span style={{ fontSize: "14px", color: "#666" }}>
                    Tiến độ
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>
                    {formatCurrency(goal.currentAmount)} /{" "}
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <Progress
                  percent={percentage}
                  strokeColor={getProgressColor(percentage)}
                  showInfo={false}
                  size="small"
                />
                <div style={{ textAlign: "center", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    {percentage.toFixed(1)}% hoàn thành
                  </span>
                </div>
              </div>

              {goal.deadline && (
                <div style={{ fontSize: "12px", color: "#666" }}>
                  <Target
                    style={{
                      marginRight: "4px",
                      width: "12px",
                      height: "12px",
                    }}
                  />
                  Hạn: {dayjs(goal.deadline).format("DD/MM/YYYY")}
                </div>
              )}
            </Card>
          );
        })
        )}
      </div>

      <Modal
        title={editingGoal ? "Chỉnh sửa mục tiêu" : "Thêm mục tiêu mới"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingGoal(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingGoal ? handleUpdateGoal : handleCreateGoal}
        >
          <Form.Item
            name="title"
            label="Tên mục tiêu"
            rules={[{ required: true, message: "Vui lòng nhập tên mục tiêu" }]}
          >
            <Input placeholder="Ví dụ: Tiết kiệm mua xe" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Mô tả chi tiết về mục tiêu" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Danh mục"
            rules={[{ required: true, message: "Vui lòng chọn danh mục" }]}
          >
            <Select placeholder="Chọn danh mục">
              {categoryOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetAmount"
            label="Mục tiêu (VNĐ)"
            rules={[
              { required: true, message: "Vui lòng nhập số tiền mục tiêu" },
            ]}
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Nhập số tiền mục tiêu"
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
            />
          </Form.Item>

          <Form.Item name="currentAmount" label="Đã tiết kiệm (VNĐ)">
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Nhập số tiền đã có"
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
            />
          </Form.Item>

          <Form.Item name="deadline" label="Hạn chót">
            <DatePicker
              style={{ width: "100%" }}
              placeholder="Chọn ngày hết hạn"
              disabledDate={(current) =>
                current && current < dayjs().startOf("day")
              }
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingGoal ? "Cập nhật" : "Thêm"} mục tiêu
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Goals;
