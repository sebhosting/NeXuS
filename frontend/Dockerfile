FROM node:25-alpine AS deps
RUN npm install -g npm@11.10.1
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:25-alpine AS builder
RUN npm install -g npm@11.10.1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:25-alpine AS runner
RUN npm install -g npm@11.10.1
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
