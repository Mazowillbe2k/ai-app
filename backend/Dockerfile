# Use Ubuntu 22.04 LTS as base image
FROM ubuntu:22.04

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
    unzip \
    grep \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxss1 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x for better compatibility with modern tools
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Bun (fast JavaScript runtime and package manager)
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && chmod +x /usr/local/bin/bun \
    && ln -s /usr/local/bin/bun /usr/local/bin/bunx

# Install degit and glob globally
RUN npm install -g degit glob

# Install Docker CLI
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Create workspace
WORKDIR /workspace

# Copy dependencies and install
COPY package*.json ./
RUN npm install --omit=dev

# Install Playwright browsers
RUN npx playwright install chromium

# Copy backend and browser agent source
COPY src/ ./src/
COPY browser-agent/ ./browser-agent/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV BROWSER_PORT=10001
ENV PATH=/workspace/node_modules/.bin:$PATH

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodeuser \
    && chown -R nodeuser:nodejs /workspace
USER nodeuser

# Expose backend port (browser agent is managed as subprocess)
EXPOSE 10000

# Health check for main app
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:10000/health || exit 1

# Start main server (which manages browser agent as subprocess)
CMD ["node", "src/server.js"]
