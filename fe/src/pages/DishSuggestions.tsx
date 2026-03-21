import React, { useState, useEffect, useCallback } from "react";
import {
    Card,
    Form,
    Input,
    InputNumber,
    Button,
    Upload,
    Select,
    Tag,
    Spin,
    Modal,
    Image,
    Space,
    Carousel,
    App,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { dishApi } from "../services/api";
import { formatCurrency } from "../utils/formatters";
import { auth } from "../firebase/config";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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
    { label: "Rau", value: "rau" },
    { label: "Thịt", value: "thịt" },
    { label: "Hải sản", value: "hải sản" },
    { label: "Chay", value: "chay" },
];

const DishSuggestions: React.FC = () => {
    const { message: staticMessage } = App.useApp();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [filteredDishes, setFilteredDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDish, setEditingDish] = useState<Dish | null>(null);
    const [form] = Form.useForm();
    const [imageFiles, setImageFiles] = useState<any[]>([]);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

    const fetchDishes = useCallback(async () => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;
        setLoading(true);
        try {
            const token = await firebaseUser.getIdToken();
            const data = await dishApi.getDishes(undefined, token);
            setDishes(data);
            setFilteredDishes(data);
        } catch (error) {
            staticMessage.error("Lỗi khi tải danh sách món ăn");
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        let filtered = dishes;
        if (selectedPreferences.length > 0) {
            filtered = filtered.filter(dish => dish.preferences.some(p => selectedPreferences.includes(p)));
        }
        setFilteredDishes(filtered);
    }, [dishes, selectedPreferences]);

    useEffect(() => { fetchDishes(); }, [fetchDishes]);

    const getRandomDish = () => {
        if (filteredDishes.length === 0) return;
        const random = filteredDishes[Math.floor(Math.random() * filteredDishes.length)];
        Modal.info({
            title: 'Gợi ý món ăn hôm nay!',
            content: (
                <div className="pt-4 text-center">
                    <p className="text-xl font-bold text-primary mb-4 italic">"Hôm nay ăn {random.name} nhé?"</p>
                    {random.imageUrls[0] && <img src={random.imageUrls[0]} className="w-full h-40 object-cover rounded-xl shadow-lg mb-4" />}
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{random.address || 'Hẹn bạn tại quán quen'}</p>
                </div>
            ),
            icon: <span className="material-symbols-outlined text-primary">restaurant</span>,
            centered: true,
            okText: 'Tuyệt vời!'
        });
    };

    const handleSubmit = async (values: any) => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            const formData = new FormData();
            formData.append("name", values.name);
            formData.append("description", values.description || "");
            formData.append("price", values.price || "");
            formData.append("preferences", JSON.stringify(values.preferences || []));
            formData.append("address", values.address || "");
            if (selectedLocation) formData.append("location", JSON.stringify(selectedLocation));
            imageFiles.forEach(file => { if (file.originFileObj) formData.append("images", file.originFileObj); });

            if (editingDish) await dishApi.updateDish(editingDish._id, formData, token);
            else await dishApi.createDish(formData, token);

            staticMessage.success("Thành công");
            setModalVisible(false);
            fetchDishes();
        } catch (error) { staticMessage.error("Không thể lưu"); }
    };

    const handleDelete = async (id: string) => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        await dishApi.deleteDish(id, token);
        staticMessage.success("Đã xóa");
        fetchDishes();
    };

    if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Spin size="large" /></div>;

    return (
        <div className="w-full space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight dark:text-white uppercase tracking-[0.05em]">Gợi ý món ăn</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">"Hôm nay ăn gì nhỉ?" - FinTrack sẽ trả lời thay bạn.</p>
                </div>
                <div className="flex gap-3">
                    <Button icon={<ReloadOutlined />} onClick={getRandomDish} className="h-11 px-6 rounded-xl font-bold uppercase text-xs tracking-wide border-2 hover:border-primary hover:text-primary transition-all">Gợi ý ngẫu nhiên</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingDish(null); form.resetFields(); setModalVisible(true); }} className="h-11 px-6 rounded-xl font-bold uppercase text-xs tracking-wide shadow-lg shadow-primary/20">Thêm món mới</Button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-primary/5 shadow-sm flex flex-wrap items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Khẩu vị:</span>
                <Select mode="multiple" placeholder="Lọc theo khẩu vị..." options={preferenceOptions} value={selectedPreferences} onChange={setSelectedPreferences} className="min-w-[200px] flex-1" allowClear />
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">{filteredDishes.length} Món ăn</div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredDishes.map((dish) => (
                    <div key={dish._id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-primary/5 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col">
                        <div className="relative h-48 overflow-hidden">
                            <Carousel autoplay effect="fade">
                                {dish.imageUrls.map((url, i) => (
                                    <div key={i}>
                                        <img src={url} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700" alt={dish.name} />
                                    </div>
                                ))}
                            </Carousel>
                            <div className="absolute top-4 right-4 flex gap-2">
                                <button onClick={() => { setEditingDish(dish); form.setFieldsValue(dish); setModalVisible(true); }} className="size-8 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center text-slate-600 hover:text-primary transition-colors"><EditOutlined className="text-sm" /></button>
                                <button onClick={() => handleDelete(dish._id)} className="size-8 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center text-slate-600 hover:text-rose-500 transition-colors"><DeleteOutlined className="text-sm" /></button>
                            </div>
                            <div className="absolute bottom-4 left-4">
                                <span className="bg-primary/90 text-white text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg shadow-lg">
                                    {dish.price ? formatCurrency(dish.price) : 'Giá liên hệ'}
                                </span>
                            </div>
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                            <h3 className="text-lg font-bold dark:text-white mb-2 group-hover:text-primary transition-colors">{dish.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 font-medium italic">{dish.description || 'Chưa có mô tả chi tiết cho món ăn này.'}</p>
                            <div className="mt-auto space-y-4">
                                <div className="flex flex-wrap gap-1.5">
                                    {dish.preferences.map(p => (
                                        <span key={p} className="text-[9px] font-bold uppercase tracking-tighter px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">{p}</span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400 pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <EnvironmentOutlined className="text-primary" />
                                    <span className="truncate">{dish.address || 'Địa điểm chưa cập nhật'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Modal title={editingDish ? "Chỉnh sửa món ăn" : "Thêm món ăn mới"} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={800} centered>
                <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ preferences: [] }}>
                    <div className="grid grid-cols-2 gap-6">
                        <Form.Item name="name" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên món ăn</span>} rules={[{ required: true }]}>
                            <Input placeholder="Nhập tên món ví dụ: Phở Bò" size="large" className="rounded-xl" />
                        </Form.Item>
                        <Form.Item name="price" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Giá ước tính</span>}>
                            <InputNumber style={{ width: "100%" }} placeholder="VNĐ" size="large" className="rounded-xl" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} parser={v => parseFloat(v!.replace(/\$\s?|(,*)/g, "")) || 0} />
                        </Form.Item>
                    </div>
                    <Form.Item name="description" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả khẩu vị</span>}>
                        <TextArea rows={3} placeholder="Món ăn này có gì đặc biệt?" className="rounded-xl" />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-6">
                        <Form.Item name="preferences" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Đặc điểm</span>}>
                            <Select mode="multiple" placeholder="Chọn vị..." options={preferenceOptions} className="rounded-xl" />
                        </Form.Item>
                        <Form.Item name="address" label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Địa chỉ</span>}>
                            <Input placeholder="Số nhà, tên đường..." size="large" className="rounded-xl" />
                        </Form.Item>
                    </div>
                    <Form.Item label={<span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hình ảnh món ăn</span>}>
                        <Upload listType="picture-card" fileList={imageFiles} onChange={({ fileList }) => setImageFiles(fileList)} beforeUpload={() => false} multiple>
                            <div><PlusOutlined /><div style={{ marginTop: 8 }} className="font-bold text-xs uppercase">Tải ảnh</div></div>
                        </Upload>
                    </Form.Item>
                    <div className="flex justify-end gap-3 pt-6 border-t font-bold">
                        <Button onClick={() => setModalVisible(false)} className="rounded-xl h-11 px-8 uppercase text-xs tracking-wide">Hủy</Button>
                        <Button type="primary" htmlType="submit" className="rounded-xl h-11 px-8 uppercase text-xs tracking-wide shadow-lg shadow-primary/20">{editingDish ? "Cập nhật" : "Tạo món ăn"}</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default DishSuggestions;
