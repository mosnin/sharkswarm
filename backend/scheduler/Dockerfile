FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm config set strict-ssl false && npm install --omit=dev
COPY src/ ./src/
CMD ["node", "src/index.js"]
