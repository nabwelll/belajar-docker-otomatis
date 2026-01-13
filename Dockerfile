FROM node:18-alpine

WORKDIR /app

# Copy daftar belanjaan dulu (package.json)
COPY package*.json ./

# Install belanjaan (library redis, dll)
RUN npm install

# Baru copy kodingan sisanya
COPY . .

EXPOSE 3300

CMD ["node", "server.js"]