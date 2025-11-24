FROM node:18-bullseye-slim

# Install SQLite dev headers, C-toolchain and Python (needed by node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies (this will compile sqlite3)
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["npm", "start"]