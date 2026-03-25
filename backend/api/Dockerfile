FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm config set strict-ssl false && npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm config set strict-ssl false && npx tsc

EXPOSE 4000

CMD ["node", "dist/index.js"]
