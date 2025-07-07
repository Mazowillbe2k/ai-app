# Use Ubuntu 22.04 LTS as base image
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install essential packages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    nano \
    vim \
    build-essential \
    python3 \
    python3-pip \
    ca-certificates \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Bun (fast JavaScript runtime and package manager)
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && chmod +x /usr/local/bin/bun

# Install degit globally for fast project scaffolding
RUN npm install -g degit

# Install Docker CLI
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Copy package files for the backend application
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy the backend source code
COPY src/ ./src/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV PATH=/workspace/node_modules/.bin:$PATH

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodeuser \
    && chown -R nodeuser:nodejs /workspace
USER nodeuser

# Expose the port where the server will run
EXPOSE 10000

# Health check to verify the server is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:10000/health || exit 1

# Start the Node.js server (CRITICAL for port detection)
CMD ["node", "src/server.js"] 