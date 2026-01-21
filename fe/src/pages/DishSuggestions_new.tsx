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
    Spin,
    Row,
    Col,
    Modal,
    Image,
    Space,
    Carousel,
    App,
} from "antd";
import {
    PlusOutlined,
    ReadOutlined,
    EditOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    ReloadOutlined,
    FilterOutlined,
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
    imageUrls: string[];
    preferences: string[];
    address?: string;
}

const preferenceOptions = [
    { label: "Ngọt", value: "ngọt" },
    { label: "Chua", value: "chua" },
    { label: "Cay", value: "cay" },
    { label: "Mặn", value: "mặn" },
    { label: "Đắng", value: "đắng" },
    { label: "Dầu mỡ", value: "dầu mỡ" },
    { label: "Rau", value: "rau" },
    { label: "Thịt", value: "thịt" },
    { label: "Hải sản", value: "hải sản" },
    { label: "Chay", value: "chay" },
];

const DishSuggestions_new: React.FC = () => {
    const { message: staticMessage } = App.useApp();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [filteredDishes, setFilteredDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDish, setEditingDish] = useState<Dish | null>(null);
    const [form] = Form.useForm();
    const [imageFiles, setImageFiles] = useState<any[]>([]);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>(
        [],
    );
    const [currentImageIndex, setCurrentImageIndex] = useState<{
        [key: string]: number;
    }>({});
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [viewingDish, setViewingDish] = useState<Dish | null>(null);
    const [modalImageIndex, setModalImageIndex] = useState(0);

    const getToken = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) {
            staticMessage.error("Người dùng chưa được xác thực");
            return null;
        }
        return user.getIdToken();
    }, []);

    const fetchDishes = useCallback(async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
            staticMessage.error(
                "Xác thực người dùng thất bại. Vui lòng tải lại trang.",
            );
            return;
        }
        setLoading(true);
        try {
            const token = await firebaseUser.getIdToken();
            const data = await dishApi.getDishes(undefined, token);
            setDishes(data);
            setFilteredDishes(data);
        } catch (error) {
            staticMessage.error("Lỗi khi tải danh sách món ăn");
        } finally {
            setLoading(false);
        }
    }, []);

    const filterDishes = useCallback(() => {
        let filtered = dishes;

        if (selectedPreferences.length > 0) {
            filtered = filtered.filter((dish) =>
                dish.preferences.some((pref) =>
                    selectedPreferences.includes(pref),
                ),
            );
        }

        setFilteredDishes(filtered);
    }, [dishes, selectedPreferences]);

    const getRandomDish = useCallback(() => {
        if (filteredDishes.length === 0) return;
        const randomIndex = Math.floor(Math.random() * filteredDishes.length);
        const randomDish = filteredDishes[randomIndex];
        const randomImageIndex = Math.floor(
            Math.random() * randomDish.imageUrls.length,
        );
        staticMessage.success(`Gợi ý ngẫu nhiên: ${randomDish.name}`);
        openImageModal(randomDish, randomImageIndex);
    }, [filteredDishes]);

    const nextImage = useCallback((dishId: string) => {
        setCurrentImageIndex((prev) => ({
            ...prev,
            [dishId]: (prev[dishId] || 0) + 1,
        }));
    }, []);

    const prevImage = useCallback((dishId: string) => {
        setCurrentImageIndex((prev) => ({
            ...prev,
            [dishId]: Math.max((prev[dishId] || 0) - 1, 0),
        }));
    }, []);

    const openImageModal = useCallback((dish: Dish, imageIndex: number) => {
        setViewingDish(dish);
        setModalImageIndex(imageIndex);
        setImageModalVisible(true);
    }, []);

    const closeImageModal = useCallback(() => {
        setImageModalVisible(false);
        setViewingDish(null);
        setModalImageIndex(0);
    }, []);

    const nextModalImage = useCallback(() => {
        if (!viewingDish) return;
        setModalImageIndex((prev) => (prev + 1) % viewingDish.imageUrls.length);
    }, [viewingDish]);

    const prevModalImage = useCallback(() => {
        if (!viewingDish) return;
        setModalImageIndex((prev) =>
            prev === 0 ? viewingDish.imageUrls.length - 1 : prev - 1,
        );
    }, [viewingDish]);

    useEffect(() => {
        fetchDishes();
    }, [fetchDishes]);

    useEffect(() => {
        filterDishes();
    }, [filterDishes]);

    const handleSubmit = async (values: any) => {
        try {
            const token = await getToken();
            if (!token) return;

            const formData = new FormData();
            formData.append("name", values.name);
            formData.append("description", values.description || "");
            formData.append("price", values.price || "");
            formData.append(
                "preferences",
                JSON.stringify(values.preferences || []),
            );
            formData.append("address", values.address || "");

            if (selectedLocation) {
                formData.append("location", JSON.stringify(selectedLocation));
            }

            imageFiles.forEach((file) => {
                formData.append("images", file.originFileObj);
            });

            if (editingDish) {
                await dishApi.updateDish(editingDish._id, formData, token);
                staticMessage.success("Cập nhật món ăn thành công");
            } else {
                await dishApi.createDish(formData, token);
                staticMessage.success("Thêm món ăn thành công");
            }

            setModalVisible(false);
            setEditingDish(null);
            setImageFiles([]);
            setSelectedLocation(null);
            form.resetFields();
            fetchDishes();
        } catch (error) {
            console.error(error);
            staticMessage.error("Không thể lưu món ăn");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const token = await getToken();
            if (!token) return;

            await dishApi.deleteDish(id, token);
            staticMessage.success("Xóa món ăn thành công");
            fetchDishes();
        } catch (error) {
            console.error(error);
            staticMessage.error("Không thể xóa món ăn");
        }
    };

    const openEditModal = (dish: Dish) => {
        setEditingDish(dish);
        form.setFieldsValue({
            name: dish.name,
            description: dish.description,
            price: dish.price,
            preferences: dish.preferences,
            address: dish.address,
        });
        setImageFiles(
            dish.imageUrls.map((url, index) => ({
                uid: index.toString(),
                name: `image-${index}`,
                status: "done",
                url,
            })),
        );
        setModalVisible(true);
    };

    const openCreateModal = () => {
        setEditingDish(null);
        form.resetFields();
        setImageFiles([]);
        setSelectedLocation(null);
        setModalVisible(true);
    };

    const handleImageChange = ({ fileList }: any) => {
        setImageFiles(fileList);
    };

    const LocationPicker = () => {
        useMapEvents({
            click(e) {
                setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
            },
        });

        return selectedLocation ? (
            <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
        ) : null;
    };

    if (loading) {
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
                    <h2 className="ekash_title">Gợi ý món ăn</h2>
                    <p className="ekash_subtitle">
                        Quản lý danh sách các món ăn yêu thích
                    </p>
                </div>
                <div className="ekash_breadcrumb">
                    Home <span className="sep">›</span> Gợi ý món ăn
                </div>
            </div>

            <div className="ekash_page_actions">
                <Space size="middle">
                    <Select
                        mode="multiple"
                        placeholder="Lọc theo khẩu vị"
                        options={preferenceOptions}
                        value={selectedPreferences}
                        onChange={setSelectedPreferences}
                        style={{ width: 200 }}
                        allowClear
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={getRandomDish}
                        className="ekash_btn"
                    >
                        Gợi ý ngẫu nhiên
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreateModal}
                        className="ekash_btn primary"
                    >
                        Thêm món ăn mới
                    </Button>
                </Space>
            </div>

            <div className="ekash_grid_3">
                {filteredDishes.map((dish) => (
                    <div key={dish._id} className="ekash_card">
                        <div className="ekash_card_header">
                            <h3 className="ekash_card_title">{dish.name}</h3>
                            <div className="ekash_card_actions">
                                <Button
                                    type="text"
                                    icon={<EditOutlined />}
                                    onClick={() => openEditModal(dish)}
                                    size="small"
                                />
                                <Button
                                    type="text"
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDelete(dish._id)}
                                    size="small"
                                    danger
                                />
                            </div>
                        </div>

                        {dish.imageUrls.length > 0 && (
                            <div className="ekash_card_image">
                                <Carousel
                                    dots={false}
                                    arrows={dish.imageUrls.length > 1}
                                    autoplay={false}
                                    beforeChange={(prev, next) => {
                                        // Reset current image index when changing slides
                                        setCurrentImageIndex((prev) => ({
                                            ...prev,
                                            [dish._id]: 0,
                                        }));
                                    }}
                                >
                                    {dish.imageUrls.map((url, index) => (
                                        <div key={index}>
                                            <Image
                                                width="100%"
                                                height={200}
                                                src={url}
                                                alt={dish.name}
                                                style={{
                                                    objectFit: "cover",
                                                    borderRadius: "8px",
                                                }}
                                                preview={false}
                                                onClick={() =>
                                                    openImageModal(dish, index)
                                                }
                                                className="ekash_card_image_clickable"
                                            />
                                        </div>
                                    ))}
                                </Carousel>

                                {/* Custom Navigation */}
                                {dish.imageUrls.length > 1 && (
                                    <div className="ekash_carousel_nav">
                                        <Button
                                            type="text"
                                            icon={<ReadOutlined />}
                                            onClick={() => prevImage(dish._id)}
                                            size="small"
                                            className="ekash_carousel_btn"
                                            disabled={
                                                (currentImageIndex[dish._id] ||
                                                    0) === 0
                                            }
                                        />
                                        <span className="ekash_carousel_counter">
                                            {(currentImageIndex[dish._id] ||
                                                0) + 1}{" "}
                                            / {dish.imageUrls.length}
                                        </span>
                                        <Button
                                            type="text"
                                            icon={<ReadOutlined />}
                                            onClick={() => nextImage(dish._id)}
                                            size="small"
                                            className="ekash_carousel_btn"
                                            disabled={
                                                (currentImageIndex[dish._id] ||
                                                    0) ===
                                                dish.imageUrls.length - 1
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="ekash_card_content">
                            {dish.price && (
                                <div className="ekash_price">
                                    {formatCurrency(dish.price)}
                                </div>
                            )}

                            {dish.description && (
                                <p className="ekash_description">
                                    {dish.description}
                                </p>
                            )}

                            {dish.preferences.length > 0 && (
                                <div className="ekash_preferences">
                                    {dish.preferences.map((pref) => (
                                        <Tag key={pref} className="ekash_tag">
                                            {pref}
                                        </Tag>
                                    ))}
                                </div>
                            )}

                            {dish.address && (
                                <div className="ekash_address">
                                    <EnvironmentOutlined /> {dish.address}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                title={editingDish ? "Chỉnh sửa món ăn" : "Thêm món ăn mới"}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingDish(null);
                    setImageFiles([]);
                    setSelectedLocation(null);
                    form.resetFields();
                }}
                footer={null}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        preferences: [],
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Tên món ăn"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập tên món ăn",
                            },
                        ]}
                    >
                        <Input placeholder="Nhập tên món ăn" />
                    </Form.Item>

                    <Form.Item name="description" label="Mô tả">
                        <TextArea rows={3} placeholder="Mô tả về món ăn" />
                    </Form.Item>

                    <Form.Item name="price" label="Giá (VNĐ)">
                        <InputNumber
                            style={{ width: "100%" }}
                            placeholder="Giá món ăn"
                            formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            parser={(value) =>
                                value!.replace(/\$\s?|(,*)/g, "")
                            }
                        />
                    </Form.Item>

                    <Form.Item name="preferences" label="Khẩu vị">
                        <Select
                            mode="multiple"
                            placeholder="Chọn khẩu vị"
                            options={preferenceOptions}
                        />
                    </Form.Item>

                    <Form.Item name="address" label="Địa chỉ">
                        <Input
                            placeholder="Nhập địa chỉ hoặc chọn trên bản đồ"
                            suffix={
                                <Button
                                    type="link"
                                    onClick={() => setMapModalVisible(true)}
                                >
                                    Chọn trên bản đồ
                                </Button>
                            }
                        />
                    </Form.Item>

                    <Form.Item label="Hình ảnh">
                        <Upload
                            listType="picture-card"
                            fileList={imageFiles}
                            onChange={handleImageChange}
                            beforeUpload={() => false}
                            multiple
                        >
                            <div>
                                <PlusOutlined />
                                <div style={{ marginTop: 8 }}>Tải lên</div>
                            </div>
                        </Upload>
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                        <Space>
                            <Button
                                onClick={() => {
                                    setModalVisible(false);
                                    setEditingDish(null);
                                    setImageFiles([]);
                                    setSelectedLocation(null);
                                    form.resetFields();
                                }}
                            >
                                Hủy
                            </Button>
                            <Button type="primary" htmlType="submit">
                                {editingDish ? "Cập nhật" : "Thêm"}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Chọn vị trí trên bản đồ"
                open={mapModalVisible}
                onCancel={() => setMapModalVisible(false)}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => setMapModalVisible(false)}
                    >
                        Hủy
                    </Button>,
                    <Button
                        key="select"
                        type="primary"
                        onClick={() => {
                            if (selectedLocation) {
                                form.setFieldsValue({
                                    address: `${selectedLocation.lat}, ${selectedLocation.lng}`,
                                });
                            }
                            setMapModalVisible(false);
                        }}
                        disabled={!selectedLocation}
                    >
                        Chọn vị trí này
                    </Button>,
                ]}
                width={800}
            >
                <div style={{ height: 400, width: "100%" }}>
                    <MapContainer
                        center={[21.0285, 105.8542]} // Hanoi
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationPicker />
                    </MapContainer>
                </div>
            </Modal>

            {/* Image View Modal */}
            <Modal
                title={viewingDish?.name}
                open={imageModalVisible}
                onCancel={closeImageModal}
                footer={[
                    <Button key="close" onClick={closeImageModal}>
                        Đóng
                    </Button>,
                ]}
                width={800}
                centered
            >
                {viewingDish && (
                    <div style={{ textAlign: "center" }}>
                        <Carousel
                            dots={false}
                            arrows={viewingDish.imageUrls.length > 1}
                            autoplay={false}
                            initialSlide={modalImageIndex}
                        >
                            {viewingDish.imageUrls.map((url, index) => (
                                <div key={index}>
                                    <Image
                                        width="100%"
                                        src={url}
                                        alt={viewingDish.name}
                                        style={{
                                            maxHeight: "500px",
                                            objectFit: "contain",
                                        }}
                                        preview={true}
                                    />
                                </div>
                            ))}
                        </Carousel>

                        <div style={{ marginTop: "16px" }}>
                            <span style={{ fontSize: "14px", color: "#666" }}>
                                Ảnh {modalImageIndex + 1} /{" "}
                                {viewingDish.imageUrls.length}
                            </span>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DishSuggestions_new;
