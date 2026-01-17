import React, { useState } from "react";
import { Button, Dropdown, Modal, Form, ColorPicker, Space } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import { useTheme, ThemeType, CustomTheme } from "../contexts/ThemeContext";

const ThemeSwitcher: React.FC = () => {
    const { setTheme, customTheme, setCustomTheme } = useTheme();
    const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
    const [form] = Form.useForm();

    const normalizeColor = (value: any, fallback: string) => {
        if (!value) return fallback;
        if (typeof value === "string") return value;
        if (typeof value?.toHexString === "function")
            return value.toHexString();
        if (typeof value?.toRgbString === "function")
            return value.toRgbString();
        return fallback;
    };

    const handleThemeChange = (newTheme: ThemeType) => {
        if (newTheme === "custom") {
            setIsCustomModalVisible(true);
        } else {
            setTheme(newTheme);
        }
    };

    const handleCustomThemeSubmit = (values: any) => {
        const newCustomTheme: CustomTheme = {
            primaryColor: normalizeColor(
                values.primaryColor,
                customTheme.primaryColor,
            ),
            backgroundColor: normalizeColor(
                values.backgroundColor,
                customTheme.backgroundColor,
            ),
            textColor: normalizeColor(values.textColor, customTheme.textColor),
            secondaryColor: normalizeColor(
                values.secondaryColor,
                customTheme.secondaryColor,
            ),
            accentColor: normalizeColor(
                values.accentColor,
                customTheme.accentColor,
            ),
        };
        setCustomTheme(newCustomTheme);
        setTheme("custom");
        setIsCustomModalVisible(false);
    };

    const menuItems = [
        {
            key: "light",
            label: "Sáng",
            onClick: () => handleThemeChange("light"),
        },
        {
            key: "dark",
            label: "Tối",
            onClick: () => handleThemeChange("dark"),
        },
        {
            key: "custom",
            label: "Tùy chỉnh",
            onClick: () => handleThemeChange("custom"),
        },
    ];

    return (
        <>
            <Dropdown
                menu={{ items: menuItems }}
                placement="bottomRight"
                trigger={["click"]}
            >
                <Button
                    type="text"
                    icon={<BgColorsOutlined />}
                    style={{ color: "inherit" }}
                >
                    Theme
                </Button>
            </Dropdown>

            <Modal
                title="Tùy chỉnh giao diện"
                open={isCustomModalVisible}
                onCancel={() => setIsCustomModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCustomThemeSubmit}
                    initialValues={{
                        primaryColor: customTheme.primaryColor,
                        backgroundColor: customTheme.backgroundColor,
                        textColor: customTheme.textColor,
                        secondaryColor: customTheme.secondaryColor,
                        accentColor: customTheme.accentColor,
                    }}
                >
                    <Form.Item
                        name="primaryColor"
                        label="Màu chính"
                        help="Áp dụng cho: nút chính (Primary), trạng thái active ở menu, progress, highlight chính trong trang."
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn màu chính",
                            },
                        ]}
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item
                        name="backgroundColor"
                        label="Màu nền"
                        help="Áp dụng cho: nền tổng của trang (layout/background)."
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn màu nền",
                            },
                        ]}
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item
                        name="textColor"
                        label="Màu chữ"
                        help="Áp dụng cho: chữ chính (tiêu đề, nội dung). Các chữ phụ/mờ sẽ tự giảm độ đậm từ màu này."
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn màu chữ",
                            },
                        ]}
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item
                        name="secondaryColor"
                        label="Màu phụ"
                        help="Áp dụng cho: nền card/khối nội dung (card background), bề mặt (container) nằm trên nền trang."
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn màu phụ",
                            },
                        ]}
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item
                        name="accentColor"
                        label="Màu nhấn mạnh"
                        help="Áp dụng cho: link, hover, viền/focus input và các hiệu ứng nhấn (accent)."
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn màu nhấn mạnh",
                            },
                        ]}
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Áp dụng
                            </Button>
                            <Button
                                onClick={() => setIsCustomModalVisible(false)}
                            >
                                Hủy
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default ThemeSwitcher;
