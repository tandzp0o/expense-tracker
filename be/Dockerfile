# Bước 1: Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files để tận dụng Docker cache
COPY package*.json ./
RUN npm install

# Copy toàn bộ code và build
COPY . .
RUN npm run build

# Bước 2: Production stage (giúp giảm dung lượng image)
FROM node:18-alpine

WORKDIR /app

# Chỉ copy những file cần thiết từ bước build
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Biến môi trường mặc định
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Chạy server từ file đã build
CMD ["node", "dist/index.js"]