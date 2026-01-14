import React, { useState } from "react";
import { Button, Dropdown, Modal, Form, ColorPicker, Space } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import { useTheme, ThemeType, CustomTheme } from "../contexts/ThemeContext";

const ThemeSwitcher: React.FC = () => {
  const { setTheme, customTheme, setCustomTheme } = useTheme();
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [form] = Form.useForm();

  const handleThemeChange = (newTheme: ThemeType) => {
    if (newTheme === "custom") {
      setIsCustomModalVisible(true);
    } else {
      setTheme(newTheme);
    }
  };

  const handleCustomThemeSubmit = (values: any) => {
    const newCustomTheme: CustomTheme = {
      primaryColor:
        values.primaryColor?.toHexString() || customTheme.primaryColor,
      backgroundColor:
        values.backgroundColor?.toHexString() || customTheme.backgroundColor,
      textColor: values.textColor?.toHexString() || customTheme.textColor,
      secondaryColor:
        values.secondaryColor?.toHexString() || customTheme.secondaryColor,
      accentColor: values.accentColor?.toHexString() || customTheme.accentColor,
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
            rules={[{ required: true, message: "Vui lòng chọn màu chính" }]}
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="backgroundColor"
            label="Màu nền"
            rules={[{ required: true, message: "Vui lòng chọn màu nền" }]}
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="textColor"
            label="Màu chữ"
            rules={[{ required: true, message: "Vui lòng chọn màu chữ" }]}
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="secondaryColor"
            label="Màu phụ"
            rules={[{ required: true, message: "Vui lòng chọn màu phụ" }]}
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="accentColor"
            label="Màu nhấn mạnh"
            rules={[{ required: true, message: "Vui lòng chọn màu nhấn mạnh" }]}
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Áp dụng
              </Button>
              <Button onClick={() => setIsCustomModalVisible(false)}>
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
