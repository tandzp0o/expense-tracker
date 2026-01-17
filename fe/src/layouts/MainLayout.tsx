import React, { useState, useEffect } from "react";
import { Layout, Drawer } from "antd";
import { useLocation } from "react-router-dom";
import Sidenav from "./Sidenav";
import Header from "./Header";
import Footer from "./Footer";

const { Sider, Content, Header: AntHeader } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [sidenavColor] = useState("#1890ff");
    const [sidenavType] = useState("transparent");
    const [placement, setPlacement] = useState("right");

    let { pathname } = useLocation();
    pathname = pathname.replace("/", "");

    useEffect(() => {
        if (pathname === "rtl") {
            setPlacement("left");
        } else {
            setPlacement("right");
        }
    }, [pathname]);

    const openDrawer = () => setVisible(!visible);

    return (
        <Layout
            className={`layout-dashboard ${
                pathname === "profile" ? "layout-profile" : ""
            } ${pathname === "rtl" ? "layout-dashboard-rtl" : ""}`}
        >
            {/* Mobile Drawer */}
            <Drawer
                title={false}
                placement={placement === "right" ? "left" : "right"}
                closable={false}
                onClose={() => setVisible(false)}
                open={visible}
                key={placement === "right" ? "left" : "right"}
                width={250}
                className={`drawer-sidebar ${
                    pathname === "rtl" ? "drawer-sidebar-rtl" : ""
                }`}
            >
                <Layout
                    className={`layout-dashboard ${
                        pathname === "rtl" ? "layout-dashboard-rtl" : ""
                    }`}
                >
                    <Sider
                        trigger={null}
                        width={250}
                        theme="light"
                        className="sider-primary ant-layout-sider-primary"
                        style={{ background: sidenavType }}
                    >
                        <Sidenav color={sidenavColor} />
                    </Sider>
                </Layout>
            </Drawer>

            {/* Desktop Sidebar */}
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                onCollapse={(collapsed, type) => {
                    console.log(collapsed, type);
                }}
                trigger={null}
                width={250}
                theme="light"
                className={`sider-primary ant-layout-sider-primary ${
                    sidenavType === "#fff" ? "active-route" : ""
                }`}
                style={{ background: sidenavType }}
            >
                <Sidenav color={sidenavColor} />
            </Sider>

            {/* Main Content Layout */}
            <Layout>
                <AntHeader className="subheader">
                    <Header onMenuClick={openDrawer} />
                </AntHeader>
                <Content className="content-ant">{children}</Content>
                <Footer />
            </Layout>
        </Layout>
    );
};

export default MainLayout;
