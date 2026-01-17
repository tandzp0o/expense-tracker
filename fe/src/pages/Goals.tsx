import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Modal,
  Select,
  DatePicker,
  Row,
  Col,
  Table,
  Progress,
  Tag,
  Space,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
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
  deadline?: string;
  status: "active" | "completed" | "expired";
  createdAt: string;
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
      Modal.error({
        title: "Xác thực thất bại",
        content: "Vui lòng tải lại trang.",
      });
      return;
    }
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await goalApi.getGoals(token);
      const formattedGoals = Array.isArray(response) ? response : [];
      setGoals(formattedGoals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      Modal.error({
        title: "Lỗi",
        content: "Không thể tải danh sách mục tiêu",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        Modal.error({ title: "Lỗi", content: "Xác thực người dùng thất bại" });
        return;
      }
      const token = await firebaseUser.getIdToken();
      const goalData = {
        title: values.title,
        description: values.description,
        targetAmount: values.targetAmount,
        currentAmount: values.currentAmount || 0,
        category: values.category,
        deadline: values.deadline ? values.deadline.toISOString() : null,
      };

      if (editingGoal) {
        await goalApi.updateGoal(editingGoal._id, goalData, token);
        Modal.success({
          title: "Thành công",
          content: "Cập nhật mục tiêu thành công",
        });
      } else {
        await goalApi.createGoal(goalData, token);
        Modal.success({
          title: "Thành công",
          content: "Tạo mục tiêu mới thành công",
        });
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingGoal(null);
      await fetchGoals();
    } catch (error: any) {
      Modal.error({ title: "Lỗi", content: error.message || "Có lỗi xảy ra" });
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    form.setFieldsValue({
      ...goal,
      deadline: goal.deadline ? dayjs(goal.deadline) : null,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mục tiêu này?")) return;

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      const token = await firebaseUser.getIdToken();
      await goalApi.deleteGoal(id, token);
      Modal.success({
        title: "Thành công",
        content: "Xóa mục tiêu thành công",
      });
      await fetchGoals();
    } catch (error) {
      Modal.error({ title: "Lỗi", content: "Không thể xóa mục tiêu" });
    }
  };

  const columns: ColumnsType<Goal> = [
    {
      title: "TÊN MỤC TIÊU",
      dataIndex: "title",
      key: "title",
      width: "20%",
    },
    {
      title: "DANH MỤC",
      dataIndex: "category",
      key: "category",
      render: (category: string) => {
        const cat = categoryOptions.find((c) => c.value === category);
        return cat?.label || category;
      },
    },
    {
      title: "TIẾN ĐỘ",
      dataIndex: "currentAmount",
      key: "progress",
      render: (_, record: Goal) => (
        <Progress
          percent={Math.min(
            Math.round((record.currentAmount / record.targetAmount) * 100),
            100
          )}
          size="small"
          status={record.status === "completed" ? "success" : "active"}
        />
      ),
    },
    {
      title: "SỐ TIỀN",
      key: "amount",
      render: (_, record: Goal) => (
        <span>
          {formatCurrency(record.currentAmount)} /{" "}
          {formatCurrency(record.targetAmount)}
        </span>
      ),
    },
    {
      title: "TRẠNG THÁI",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let color = "blue";
        let text = "Đang thực hiện";
        if (status === "completed") {
          color = "green";
          text = "Hoàn thành";
        } else if (status === "expired") {
          color = "red";
          text = "Hết hạn";
        }
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "HÀNH ĐỘNG",
      key: "action",
      render: (_, record: Goal) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          />
        </Space>
      ),
    },
  ];

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  return (
    <>
      {/* Statistics Section */}
      <Row gutter={[24, 0]} className="mb-24">
        <Col xs={24} md={6}>
          <Card bordered={false} className="widget-stat h-full">
            <Statistic
              title={<h6>Tổng mục tiêu</h6>}
              value={goals.length}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card bordered={false} className="widget-stat h-full">
            <Statistic
              title={<h6>Đang thực hiện</h6>}
              value={activeGoals.length}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card bordered={false} className="widget-stat h-full">
            <Statistic
              title={<h6>Hoàn thành</h6>}
              value={completedGoals.length}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card bordered={false} className="widget-stat h-full">
            <Statistic
              title={<h6>Tiến độ tổng</h6>}
              value={
                goals.length > 0
                  ? Math.round((totalCurrent / totalTarget) * 100)
                  : 0
              }
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Goals Table */}
      <Row gutter={[24, 0]}>
        <Col span={24}>
          <Card
            className="header-solid"
            bordered={false}
            title={<h6 className="font-semibold m-0">Danh sách mục tiêu</h6>}
            extra={[
              <Button
                key="add"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingGoal(null);
                  form.resetFields();
                  setIsModalVisible(true);
                }}
              >
                THÊM MỤC TIÊU
              </Button>,
            ]}
          >
            <Table
              columns={columns}
              dataSource={goals}
              rowKey="_id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
              }}
              scroll={{ x: "max-content" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal */}
      <Modal
        title={editingGoal ? "Chỉnh sửa mục tiêu" : "Thêm mục tiêu mới"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="title"
            label="Tên mục tiêu"
            rules={[{ required: true, message: "Vui lòng nhập tên mục tiêu" }]}
          >
            <Input placeholder="Ví dụ: Tiết kiệm cho kỳ nghỉ" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Danh mục"
            rules={[{ required: true, message: "Vui lòng chọn danh mục" }]}
          >
            <Select placeholder="Chọn danh mục">
              {categoryOptions.map((cat) => (
                <Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetAmount"
            label="Số tiền mục tiêu"
            rules={[
              { required: true, message: "Vui lòng nhập số tiền mục tiêu" },
            ]}
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                (value ? Number(value.replace(/[^0-9.-]+/g, "")) : 0) as 0
              }
            />
          </Form.Item>

          <Form.Item name="currentAmount" label="Số tiền hiện tại">
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) =>
                (value ? Number(value.replace(/[^0-9.-]+/g, "")) : 0) as 0
              }
            />
          </Form.Item>

          <Form.Item name="deadline" label="Hạn chót">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} placeholder="Nhập mô tả mục tiêu (nếu có)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              {editingGoal ? "Cập nhật" : "Thêm mới"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Goals;
