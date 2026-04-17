FROM node:18-alpine AS build

WORKDIR /app

COPY be/package*.json ./
COPY be/tsconfig.json ./

RUN npm install

COPY be/src ./src

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=1810

EXPOSE 1810

CMD ["node", "dist/index.js"]