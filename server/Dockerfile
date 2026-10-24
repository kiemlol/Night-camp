FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV HOST=0.0.0.0 PORT=7350 DATA_DIR=/app/data
EXPOSE 7350
VOLUME ["/app/data"]
CMD ["npm", "start"]
