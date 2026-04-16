# =========================================
# Root Dockerfile — Build Backend từ be/
# =========================================

# Bước 1: Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy từ thư mục be/ (vì build context là root repo)
COPY be/package*.json ./
COPY be/tsconfig.json ./

RUN npm install

# Copy source code của backend
COPY be/src ./src

RUN npm run build

# Bước 2: Production stage
FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=1810

EXPOSE 1810

CMD ["node", "dist/index.js"]
