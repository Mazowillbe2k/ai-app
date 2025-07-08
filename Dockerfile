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
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxss1 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Docker CLI (if still needed)
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install --no-cache-dir \
    flask \
    playwright \
    pydantic \
    requests

# Install Playwright browser binaries (e.g. Chromium)
RUN python3 -m playwright install chromium

# Create workspace
WORKDIR /workspace

# Copy your API server code here
COPY server.py /workspace/server.py

# Set environment variables
ENV NODE_ENV=development
ENV PATH=/workspace/node_modules/.bin:$PATH

# Expose port for browsing agent API
EXPOSE 10000

# Default command (run API server)
CMD ["python3", "server.py"]
