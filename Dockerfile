FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./
COPY public/ ./public/

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
