FROM node:20-alpine

# Install pnpm using npm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy application code (excluding keys - they'll be mounted)
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript code
RUN pnpm build

# Create directories for runtime
RUN mkdir -p /app/logs /app/keys

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]