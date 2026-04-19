import { ThemeConfig } from 'antd';

const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1869ff', // A classic Ant Design blue
    colorSuccess: '#1ac461',
    colorWarning: '#faad14',
    colorError: '#f52234',
    colorInfo: '#1890ff',
    colorTextBase: '#333333',
    colorBgBase: '#f0f2f5',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },
    Menu: {
      itemBg: '#ffffff',
      itemSelectedBg: '#e6f7ff',
      itemSelectedColor: '#1890ff',
    },
    Card: {
      headerBg: '#fafafa',
    },
  },
};

export default antdTheme;
