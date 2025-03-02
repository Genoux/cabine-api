FROM node:20-alpine

# Install pnpm using npm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy application code
COPY . .

# Build TypeScript code
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]