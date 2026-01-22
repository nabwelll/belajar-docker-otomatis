const express = require('express');
const redis = require('redis');
const amqp = require('amqplib');
const { Pool } = require('pg'); // SUPIR POSTGRES
const jwt = require('jsonwebtoken'); 
const cookieParser = require('cookie-parser'); 

const app = express();
app.set('trust proxy', true); 
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

const SECRET_KEY = "rahasia-negara-api"; 

// --- 1. KONEKSI DATABASE PERMANEN (POSTGRES) ---
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'db', // Nama service di docker-compose / Host Railway
    database: process.env.DB_NAME || 'asuransi_db',
    password: process.env.DB_PASS || 'password123',
    // PENTING: Baca port dari Railway (Variable), kalau gak ada pake 5432
    port: process.env.DB_PORT || 5432, 
});

// Buat Tabel Otomatis saat server nyala
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS polis (
                id SERIAL PRIMARY KEY,
                nama VARCHAR(100),
                umur INT,
                perokok VARCHAR(10),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Tabel Database Siap (PostgreSQL)!");
    } catch (err) {
        console.log("❌ Gagal bikin tabel:", err.message);
    }
})();

// --- 2. SETUP REDIS (Hanya untuk Cache/Session) ---
const client = redis.createClient({ 
    url: process.env.REDIS_URL, // Baca URL dari Railway
    socket: { reconnectStrategy: (retries) => 1000 }
});
client.on('error', (err) => console.log('⚠️ Redis Error:', err.message));
(async () => { try { await client.connect(); console.log('✅ Redis Connected'); } catch (e) {} })();

// --- 3. SATPAM (MIDDLEWARE) ---
const cekLogin = (req, res, next) => {
    const token = req.cookies.token_vip;
    if (!token) return res.redirect('/login');
    try {
        const user = jwt.verify(token, SECRET_KEY);
        req.user = user;
        next();
    } catch (err) {
        res.clearCookie('token_vip');
        return res.redirect('/login');
    }
};

// --- 4. ROUTES ---
app.get('/login', (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h1>🛡️ LOGIN SYSTEM (DB + RABBITMQ)</h1>
            <p>Admin / 1234</p>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Username" required><br><br>
                <input type="password" name="password" placeholder="Password" required><br><br>
                <button type="submit">MASUK</button>
            </form>
        </div>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '1234') {
        const token = jwt.sign({ username, role: 'boss' }, SECRET_KEY, { expiresIn: '15m' });
        res.cookie('token_vip', token, { httpOnly: true }); 
        res.redirect('/');
    } else {
        res.send('Password Salah!');
    }
});

app.get('/logout', (req, res) => { res.clearCookie('token_vip'); res.redirect('/login'); });

// DASHBOARD: Ambil data dari POSTGRES
app.get('/', cekLogin, async (req, res) => {
    let totalPolis = 0;
    let recentPolis = [];

    try {
        // 1. Hitung Total (Query SQL)
        const countRes = await pool.query('SELECT COUNT(*) FROM polis');
        totalPolis = countRes.rows[0].count;

        // 2. Ambil 5 Data Terakhir (Query SQL)
        const dataRes = await pool.query('SELECT * FROM polis ORDER BY id DESC LIMIT 5');
        recentPolis = dataRes.rows; 

    } catch (err) { console.log("DB Error:", err.message); }

    const tokenExp = req.user.exp || Math.floor(Date.now() / 1000);
    const remainingMinutes = Math.max(0, Math.floor((tokenExp - Math.floor(Date.now()/1000)) / 60));

    // Generate HTML Table
    let polisTable = '';
    if(recentPolis.length > 0) {
        polisTable = `
            <h3>📋 5 Polis Terakhir (Dari Database Permanen): </h3>
            <table style="margin: 20px auto; border-collapse: collapse; width: 80%;">
                <thead>
                    <tr style="background: #e67e22; color: white;"> <th style="padding: 10px;">ID</th>
                        <th style="padding: 10px;">Nama</th>
                        <th style="padding: 10px;">Umur</th>
                        <th style="padding: 10px;">Perokok</th>
                        <th style="padding: 10px;">Waktu</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentPolis.map(p => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">#${p.id}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${p.nama}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${p.umur}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${p.perokok}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${new Date(p.created_at).toLocaleString('id-ID')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🏢 DASHBOARD LEVEL 4 (RABBITMQ ONLINE)</h1>
            <h3>Halo Bos ${req.user.username}!</h3>
            <h2 style="color: blue">Total Polis: ${totalPolis}</h2>
            <p style="color: gray;">Session expires in: ${remainingMinutes} mins</p>
            
            <form action="/hitung" method="POST" style="max-width: 400px; margin: 20px auto;">
                <input type="text" name="nama" placeholder="Nama" required style="width: 100%; padding: 10px; margin: 5px 0;"><br>
                <input type="number" name="umur" placeholder="Umur" required style="width: 100%; padding: 10px; margin: 5px 0;"><br>
                <label>Perokok?</label>
                <select name="perokok" style="width: 100%; padding: 10px; margin: 5px 0;">
                    <option value="Tidak">Tidak</option>
                    <option value="Ya">Ya</option>
                </select><br>
                <button type="submit" style="width: 100%; padding: 10px; background: #e67e22; color: white; border: none; cursor: pointer; margin-top: 10px;">Simpan & Kirim Email</button>
            </form>
            
            ${polisTable}
            <br><a href="/logout" style="color: red">LOGOUT</a>
        </div>
    `);
});

app.post('/hitung', cekLogin, async (req, res) => {
    const { nama, umur, perokok } = req.body;
    
    try {
        // 1. SIMPAN KE POSTGRES (Harddisk)
        const insertRes = await pool.query(
            'INSERT INTO polis (nama, umur, perokok) VALUES ($1, $2, $3) RETURNING id',
            [nama, umur, perokok]
        );
        const newId = insertRes.rows[0].id;
        console.log(`✅ Data tersimpan di DB dengan ID: ${newId}`);

        // 2. KIRIM KE RABBITMQ (Versi Production Ready)
        try {
            // FIX: Cek apakah ada RABBITMQ_URL (dari Railway) atau pakai Localhost
            const connectionString = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
            
            const conn = await amqp.connect(connectionString);
            const ch = await conn.createChannel();
            await ch.assertQueue('antrian_email');
            
            ch.sendToQueue('antrian_email', Buffer.from(JSON.stringify({ 
                id: newId, nama, umur, perokok, status: 'OK' 
            })));
            
            // Tutup koneksi setelah kirim (Biar server gak keberatan)
            setTimeout(() => { conn.close(); }, 500);
            
            console.log(`📬 Email dikirim ke antrian RabbitMQ (${process.env.RABBITMQ_URL ? 'Online' : 'Local'})`);

        } catch (mqErr) {
            console.log('⚠️ RabbitMQ Gagal (Tapi data aman di DB):', mqErr.message);
        }

    } catch(e) { console.log('❌ Error Saving:', e.message); }
    
    res.redirect('/');
});

const PORT = process.env.PORT || 3300; 
app.listen(PORT, () => console.log(`🚀 Server LEVEL 4 jalan di port ${PORT}`));