# Bước 1: Build React app
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Truyền biến môi trường lúc build (Cần thiết cho React)
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Bước 2: Chạy bằng Nginx (Cực nhẹ)
FROM nginx:stable-alpine

# Copy file build vào thư mục của Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Cấu hình Nginx để hỗ trợ React Router (tránh lỗi 404 khi reload trang)
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]