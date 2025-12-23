FROM node:18-alpine

WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies including axios
RUN npm install

# Copy rest of your app
COPY . .

EXPOSE 3003
CMD ["node", "server.js"]
