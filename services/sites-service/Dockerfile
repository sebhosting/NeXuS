FROM node:25-alpine
RUN npm install -g npm@11.10.1
RUN apk add --no-cache git
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 7005
CMD ["npm", "start"]
