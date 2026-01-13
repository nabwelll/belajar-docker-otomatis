const http = require('http');
const { createClient } = require('redis');

// Konek ke container tetangga yang namanya 'redis-db'
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    await client.connect();
    console.log("✅ Terhubung ke Redis!");
})();

const server = http.createServer(async (req, res) => {
    // ---> TAMBAHKAN BARIS INI: <---
    console.log(`📣 Ada pengunjung masuk! URL: ${req.url}`);
    // Tambah angka kunjungan
    const count = await client.incr('pengunjung');
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('VERSI 2 NIH BOS! 🔥\n');
    res.end(`Data ini diambil dari Redis Container!\n`);
});

server.listen(3300, () => {
    console.log('Server berjalan di port 3300');
});