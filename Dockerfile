# Production Dockerfile
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Install LibreOffice, fonts for DOCX to PDF conversion, and tzdata for Indian Standard Time
RUN apk add --no-cache libreoffice font-dejavu ttf-freefont ttf-liberation tzdata

# Copy application source code
COPY . .

# Set environment defaults for production
ENV PORT=5000
ENV TZ=Asia/Kolkata

EXPOSE 5000

# Start production server
CMD ["npm", "start"]

