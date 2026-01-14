import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Upload,
  Select,
  List,
  Tag,
  message,
  Spin,
  Row,
  Col,
  Modal,
  Image,
  Space,
} from "antd";
import {
  PlusOutlined,
  ReadOutlined,
  EditOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { dishApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { auth } from "../firebase/config";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const { Option } = Select;
const { TextArea } = Input;

interface Dish {
  _id: string;
  name: string;
  price?: number | null;
  description?: string;
  imageUrls: string[]; // Changed to array
  preferences: string[];
  address?: string;
}

const preferenceOptions = [
  { label: "Ngọt", value: "ngọt" },
  { label: "Chua", value: "chua" },
  { label: "Cay", value: "cay" },
  { label: "Mặn", value: "mặn" },
  { label: "Hanh", value: "hanh" },
  { label: "Giòn", value: "giòn" },
  { label: "Mềm", value: "mềm" },
  { label: "Nóng", value: "nóng" },
  { label: "Lạnh", value: "lạnh" },
];

// Map click handler component
const MapClickHandler = ({
  onPositionChange,
}: {
  onPositionChange: (pos: [number, number]) => void;
}) => {
  useMapEvents({
    click: (e) => {
      onPositionChange([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const DishSuggestions: React.FC = () => {
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [randomDish, setRandomDish] = useState<Dish | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>([
    21.0285, 105.8542,
  ]); // Hanoi coordinates
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);

  const fetchDishes = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await dishApi.getDishes(undefined, token);
      setDishes(data);
    } catch (error) {
      message.error("Lỗi khi tải danh sách món ăn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  useEffect(() => {
    if (editingDish) {
      editForm.setFieldsValue({
        name: editingDish.name,
        price: editingDish.price,
        description: editingDish.description,
        preferences: editingDish.preferences,
        address: editingDish.address,
      });
    }
  }, [editingDish, editForm]);

  const handleCreateDish = async (values: any) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append(
        "price",
        values.price !== undefined ? values.price.toString() : "null"
      );
      formData.append("description", values.description || "");
      formData.append("preferences", values.preferences.join(","));
      formData.append("address", values.address || "");

      if (values.image && values.image.length > 0) {
        values.image.forEach((file: any) => {
          formData.append("images", file.originFileObj);
        });
      }

      const token = await firebaseUser.getIdToken();
      await dishApi.createDish(formData, token);
      message.success("Thêm món ăn thành công!");
      form.resetFields();
      fetchDishes();
    } catch (error) {
      message.error("Lỗi khi thêm món ăn");
    } finally {
      setUploading(false);
    }
  };

  const handleFilterDishes = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await dishApi.getDishes(
        selectedPreferences.join(","),
        token
      );
      setDishes(data);
    } catch (error) {
      message.error("Lỗi khi lọc món ăn");
    } finally {
      setLoading(false);
    }
  };

  const handleRandomDish = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const dish = await dishApi.getRandomDish(
        selectedPreferences.join(","),
        token
      );
      setRandomDish(dish);
      setIsModalVisible(true);
    } catch (error) {
      message.error("Không có món ăn phù hợp");
    }
  };

  const handlePreviewDish = (dish: Dish) => {
    setPreviewDish(dish);
    setIsPreviewModalVisible(true);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIsEditModalVisible(true);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapPosition([latitude, longitude]);
          message.success("Đã lấy vị trí hiện tại");
        },
        (error) => {
          message.error("Không thể lấy vị trí hiện tại");
        }
      );
    } else {
      message.error("Trình duyệt không hỗ trợ định vị");
    }
  };

  const handleOpenMap = () => {
    setIsMapModalVisible(true);
  };

  const handleDeleteDish = async (dishId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      await dishApi.deleteDish(dishId, token);
      message.success("Xóa món ăn thành công!");
      fetchDishes();
    } catch (error) {
      message.error("Lỗi xóa món ăn");
    }
  };

  const handleUpdateDish = async (values: any) => {
    if (!editingDish) return;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      message.error("Xác thực người dùng thất bại. Vui lòng tải lại trang.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append(
        "price",
        values.price !== undefined ? values.price.toString() : "null"
      );
      formData.append("description", values.description || "");
      formData.append("preferences", values.preferences.join(","));
      formData.append("address", values.address || "");
      formData.append(
        "existingImages",
        JSON.stringify(editingDish.imageUrls || [])
      );

      if (values.image && values.image.length > 0) {
        values.image.forEach((file: any) => {
          formData.append("images", file.originFileObj);
        });
      }

      const token = await firebaseUser.getIdToken();
      await dishApi.updateDish(editingDish._id, formData, token);
      message.success("Cập nhật món ăn thành công!");
      setIsEditModalVisible(false);
      setEditingDish(null);
      editForm.resetFields();
      fetchDishes();
    } catch (error) {
      message.error("Lỗi cập nhật món ăn");
    } finally {
      setUploading(false);
    }
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Thêm món ăn mới" style={{ marginBottom: "16px" }}>
            <Form form={form} layout="vertical" onFinish={handleCreateDish}>
              <Form.Item
                name="name"
                label="Tên món ăn"
                rules={[{ required: true, message: "Vui lòng nhập tên món" }]}
              >
                <Input placeholder="Nhập tên món ăn" />
              </Form.Item>

              <Form.Item
                name="price"
                label="Giá (VNĐ)"
                rules={[{ required: false, message: "Vui lòng nhập giá" }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="Nhập giá"
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                />
              </Form.Item>

              <Form.Item name="description" label="Mô tả">
                <TextArea rows={3} placeholder="Mô tả món ăn" />
              </Form.Item>

              <Form.Item name="address" label="Địa chỉ">
                <Input.Group compact>
                  <Input
                    style={{ width: "calc(100% - 100px)" }}
                    placeholder="Nhập địa chỉ"
                  />
                  <Button
                    type="default"
                    icon={<EnvironmentOutlined />}
                    onClick={handleOpenMap}
                  >
                    Chọn trên bản đồ
                  </Button>
                </Input.Group>
              </Form.Item>

              <Form.Item
                name="preferences"
                label="Ưu tiên"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng chọn ít nhất một ưu tiên",
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  placeholder="Chọn ưu tiên (ngọt, chua, cay...)"
                  style={{ width: "100%" }}
                >
                  {preferenceOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="image"
                label="Hình ảnh"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload
                  listType="picture-card"
                  multiple
                  maxCount={10}
                  beforeUpload={() => false}
                  accept="image/*"
                >
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                </Upload>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={uploading}
                  icon={<PlusOutlined />}
                  block
                >
                  Thêm món ăn
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="Danh sách món ăn">
            <Space style={{ marginBottom: "16px" }}>
              <Select
                mode="multiple"
                placeholder="Lọc theo ưu tiên"
                style={{ minWidth: "200px" }}
                value={selectedPreferences}
                onChange={setSelectedPreferences}
              >
                {preferenceOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
              <Button onClick={handleFilterDishes}>Lọc</Button>
              <Button
                type="primary"
                icon={<ReadOutlined />}
                onClick={handleRandomDish}
              >
                Gợi ý ngẫu nhiên
              </Button>
            </Space>

            {loading ? (
              <Spin size="large" />
            ) : (
              <List
                grid={{ gutter: 16, column: 2 }}
                dataSource={dishes}
                renderItem={(dish) => (
                  <List.Item>
                    <Card
                      hoverable
                      cover={
                        dish.imageUrls && dish.imageUrls.length > 0 ? (
                          <Image
                            alt={dish.name}
                            src={dish.imageUrls[0]}
                            style={{
                              height: 150,
                              objectFit: "cover",
                              cursor: "pointer",
                            }}
                            onClick={() => handlePreviewDish(dish)}
                          />
                        ) : (
                          <div
                            style={{
                              height: 150,
                              background: "#f0f0f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            Không có hình ảnh
                          </div>
                        )
                      }
                      actions={[
                        <Button
                          type="link"
                          icon={<EditOutlined />}
                          onClick={() => handleEditDish(dish)}
                        >
                          Sửa
                        </Button>,
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteDish(dish._id)}
                        >
                          Xóa
                        </Button>,
                      ]}
                    >
                      <Card.Meta
                        title={dish.name}
                        description={
                          <div>
                            <p>{formatCurrency(dish.price)}</p>
                            <p>{dish.description}</p>
                            {dish.address && (
                              <p>
                                <EnvironmentOutlined /> {dish.address}
                              </p>
                            )}
                            <div>
                              {dish.preferences.map((pref) => (
                                <Tag key={pref} color="blue">
                                  {pref}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Xem trước món ăn"
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsPreviewModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={800}
      >
        {previewDish && (
          <div style={{ textAlign: "center" }}>
            {previewDish.imageUrls && previewDish.imageUrls.length > 0 ? (
              <Image.PreviewGroup>
                {previewDish.imageUrls.map((url, index) => (
                  <Image
                    key={index}
                    alt={`${previewDish.name} ${index + 1}`}
                    src={url}
                    style={{ maxWidth: "100%", marginBottom: "16px" }}
                  />
                ))}
              </Image.PreviewGroup>
            ) : (
              <p>Không có hình ảnh</p>
            )}
            <h2>{previewDish.name}</h2>
            <p>{formatCurrency(previewDish.price)}</p>
            <p>{previewDish.description}</p>
            {previewDish.address && (
              <p>
                <EnvironmentOutlined /> {previewDish.address}
              </p>
            )}
            <div>
              {previewDish.preferences.map((pref) => (
                <Tag key={pref} color="blue">
                  {pref}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Đóng
          </Button>,
        ]}
      >
        {randomDish && (
          <div style={{ textAlign: "center" }}>
            {randomDish.imageUrls && randomDish.imageUrls.length > 0 && (
              <Image.PreviewGroup>
                {randomDish.imageUrls.map((url, index) => (
                  <Image
                    key={index}
                    alt={`${randomDish.name} ${index + 1}`}
                    src={url}
                    style={{ maxWidth: "100%", marginBottom: "16px" }}
                  />
                ))}
              </Image.PreviewGroup>
            )}
            <h2>{randomDish.name}</h2>
            <p>{formatCurrency(randomDish.price)}</p>
            <p>{randomDish.description}</p>
            {randomDish.address && (
              <p>
                <EnvironmentOutlined /> {randomDish.address}
              </p>
            )}
            <div>
              {randomDish.preferences.map((pref) => (
                <Tag key={pref} color="blue">
                  {pref}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Chỉnh sửa món ăn"
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingDish(null);
          editForm.resetFields();
        }}
        footer={null}
      >
        {editingDish && (
          <Form form={editForm} onFinish={handleUpdateDish} layout="vertical">
            <Form.Item
              name="name"
              label="Tên món ăn"
              rules={[{ required: true, message: "Vui lòng nhập tên món" }]}
            >
              <Input placeholder="Nhập tên món ăn" />
            </Form.Item>

            <Form.Item
              name="price"
              label="Giá (VNĐ)"
              rules={[{ required: false, message: "Vui lòng nhập giá" }]}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                placeholder="Nhập giá"
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
              />
            </Form.Item>

            <Form.Item name="description" label="Mô tả">
              <TextArea rows={3} placeholder="Mô tả món ăn" />
            </Form.Item>

            <Form.Item name="address" label="Địa chỉ">
              <Input placeholder="Nhập địa chỉ" />
            </Form.Item>

            <Form.Item
              name="preferences"
              label="Ưu tiên"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn ít nhất một ưu tiên",
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn ưu tiên (ngọt, chua, cay...)"
                style={{ width: "100%" }}
              >
                {preferenceOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="image"
              label="Thêm hình ảnh mới"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload
                listType="picture-card"
                multiple
                maxCount={10}
                beforeUpload={() => false}
                accept="image/*"
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              </Upload>
            </Form.Item>

            {editingDish.imageUrls && editingDish.imageUrls.length > 0 && (
              <div>
                <p>Hình ảnh hiện tại:</p>
                <Image.PreviewGroup>
                  {editingDish.imageUrls.map((url, index) => (
                    <Image
                      key={index}
                      alt={`Current ${index + 1}`}
                      src={url}
                      style={{
                        width: 100,
                        height: 100,
                        objectFit: "cover",
                        marginRight: 8,
                      }}
                    />
                  ))}
                </Image.PreviewGroup>
              </div>
            )}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={uploading}
                block
              >
                Cập nhật món ăn
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Chọn vị trí trên bản đồ"
        open={isMapModalVisible}
        onCancel={() => setIsMapModalVisible(false)}
        footer={[
          <Button key="getLocation" onClick={handleGetCurrentLocation}>
            Lấy vị trí hiện tại
          </Button>,
          <Button key="close" onClick={() => setIsMapModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={800}
      >
        <div style={{ height: "400px", width: "100%" }}>
          <MapContainer
            center={mapPosition}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Marker position={mapPosition} />
            <MapClickHandler onPositionChange={setMapPosition} />
          </MapContainer>
        </div>
        <p style={{ marginTop: "10px" }}>
          Click trên bản đồ để chọn vị trí. Tọa độ: {mapPosition[0].toFixed(6)},{" "}
          {mapPosition[1].toFixed(6)}
        </p>
      </Modal>
    </div>
  );
};

export default DishSuggestions;
