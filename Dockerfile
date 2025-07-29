FROM node:18-slim

WORKDIR /app

# Install pnpm with specific version to match lockfile
RUN npm install -g pnpm@10.5.2

# Copy package files and install dependencies (skip postinstall script)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript code
RUN pnpm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "start"] 