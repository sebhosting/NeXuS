FROM node:25-alpine
RUN npm install -g npm@11.10.1
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
ENV NODE_ENV=production
EXPOSE 5001
CMD ["npm", "start"]
