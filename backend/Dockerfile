FROM node:25-alpine

# Upgrade npm & install tools
RUN npm install -g npm@11.10.1 \
    && apk add --no-cache docker-cli curl bash

WORKDIR /app

# Copy package files and install deps
COPY package*.json tsconfig.json ./
RUN npm install

# Copy source & build
COPY src ./src
RUN npm run build

# Production environment
ENV NODE_ENV=production
EXPOSE 4000

# Start API
CMD ["npm", "start"]
