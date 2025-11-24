FROM node:18-bullseye-slim

# Install SQLite dev headers, C-toolchain and Python (needed by node-gyp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-dev \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything (package.json + source) before installing
COPY . .

# Install dependencies and explicitly rebuild the sqlite3 native module
RUN npm install && npm rebuild sqlite3

EXPOSE 3000

CMD ["npm", "start"]