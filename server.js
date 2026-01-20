const express = require('express');
const redis = require('redis');
const amqp = require('amqplib');
const clientProm = require('prom-client'); 
const jwt = require('jsonwebtoken'); 
const cookieParser = require('cookie-parser'); 

const app = express();
app.set('trust proxy', true); 
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

const SECRET_KEY = "rahasia-negara-api"; 

// --- 1. SETUP REDIS ---
const client = redis.createClient({ 
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: (retries) => 1000 }
});
client.on('error', (err) => console.log('⚠️ Redis Error:', err));
(async () => { try { await client.connect(); console.log('✅ Redis Connected'); } catch (e) {} })();

// --- 2. METRICS ---
const collectDefaultMetrics = clientProm.collectDefaultMetrics;
collectDefaultMetrics(); 
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', clientProm.register.contentType);
    res.end(await clientProm.register.metrics());
});

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
            <h1>🔐 LOGIN SYSTEM FINAL</h1>
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
        const token = jwt.sign({ username, role: 'boss' }, SECRET_KEY, { expiresIn: '1h' });
        res.cookie('token_vip', token, { httpOnly: true }); 
        res.redirect('/');
    } else {
        res.send('Password Salah!');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token_vip');
    res.redirect('/login');
});

// Halaman Utama (Dijaga Satpam)
app.get('/', cekLogin, async (req, res) => {
    let totalPolis = 0;
    try { if(client.isOpen) totalPolis = await client.get('total_polis') || 0; } catch(e){}

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🚀 DASHBOARD FINAL (SUKSES)</h1>
            <h3>Halo Bos ${req.user.username}!</h3>
            <h3>Total Polis: ${totalPolis}</h3>
            <form action="/hitung" method="POST">
                <input type="text" name="nama" placeholder="Nama"><br>
                <button type="submit">Simpan</button>
            </form>
            <br><a href="/logout" style="color:red">LOGOUT</a>
        </div>
    `);
});

app.post('/hitung', cekLogin, async (req, res) => {
    const { nama } = req.body;
    try { if(client.isOpen) await client.incr('total_polis'); } catch(e){}
    try {
        const conn = await amqp.connect('amqp://rabbitmq');
        const ch = await conn.createChannel();
        await ch.assertQueue('antrian_email');
        ch.sendToQueue('antrian_email', Buffer.from(JSON.stringify({ nama, status:'OK' })));
    } catch(e) {}
    res.redirect('/');
});

const PORT = process.env.PORT || 3300; 
app.listen(PORT, () => console.log(`🚀 Server FINAL KEMBALI KE LAPTOP jalan di port ${PORT}`));