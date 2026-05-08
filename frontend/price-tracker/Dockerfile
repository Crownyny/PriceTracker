FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

EXPOSE 4200

CMD ["sh", "-c", "npm run build && npm start -- --host 0.0.0.0 --port 4200 --poll 2000"]