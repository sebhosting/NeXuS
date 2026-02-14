FROM node:25-alpine
RUN npm install -g npm@11.10.0
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "start"]
