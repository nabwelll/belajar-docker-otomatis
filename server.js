const express = require('express');
const redis = require('redis');
const app = express();
const axios = require('axios'); 
const clientProm = require('prom-client'); 

app.set('trust proxy', true); 
app.use(express.urlencoded({ extended: true }));

// Biar IP Address asli user kebaca (karena kita di belakang LoadBalancer K8s)
app.set('trust proxy', true); 
app.use(express.urlencoded({ extended: true }));

// <--- 2. Setup Metrics Default (CPU, RAM, dll) --->
const collectDefaultMetrics = clientProm.collectDefaultMetrics;
collectDefaultMetrics(); // Mulai rekam data kesehatan server

// <--- 3. Bikin Halaman Khusus buat Laporan ke Prometheus --->
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', clientProm.register.contentType);
    res.end(await clientProm.register.metrics());
});

// --- SETUP REDIS ---
const client = redis.createClient({
    url: process.env.REDIS_URL
});

(async () => {
    client.on('error', (err) => console.log('Redis Client Error', err));
    await client.connect();
    console.log('Terhubung ke Redis Cloud!');
})();

// --- FITUR BARU: SATPAM ANTI-SPAM (Rate Limiter) ---
// Middleware ini akan mencegat setiap request sebelum masuk ke logic utama
async function cekSpam(req, res, next) {
    const ipUser = req.ip; // Ambil IP Address pengunjung
    const kunciSpam = `spam:${ipUser}`; // Contoh key: spam:192.168.1.5

    try {
        // 1. Cek sudah berapa kali dia akses?
        const jumlahAkses = await client.incr(kunciSpam);

        // 2. Kalau ini akses pertama, pasang timer 60 detik (Reset tiap menit)
        if (jumlahAkses === 1) {
            await client.expire(kunciSpam, 60);
        }

        // 3. ATURAN: Maksimal 5 kali per menit
        if (jumlahAkses > 5) {
            // Sisa waktu hukuman
            const sisaWaktu = await client.ttl(kunciSpam);
            
            return res.status(429).send(`
                <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                    <h1 style="color: red; font-size: 80px;">⛔️</h1>
                    <h2>Woi, Santai Dong!</h2>
                    <p>Anda terdeteksi melakukan spam.</p>
                    <p>Tunggu <b>${sisaWaktu} detik</b> lagi sebelum mencoba.</p>
                </div>
            `);
        }

        // Kalau aman (kurang dari 5), lanjut ke bawah!
        next();
    } catch (err) {
        console.error(err);
        next(); // Kalau Redis error, lolosin aja biar aplikasi gak mati
    }
}

// LOGIKA HITUNG HARGA
function hitungPremi(umur, perokok) {
    let hargaDasar = 500000;
    if (umur > 20) hargaDasar += (umur - 20) * 10000;
    if (perokok === 'ya') hargaDasar = hargaDasar * 2;
    return hargaDasar;
}

const rupiah = (number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(number);
}

// --- ROUTES ---

app.get('/', async (req, res) => {
    let totalPolis = await client.get('total_polis') || 0;
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🛡️ Asuransi Jiwa "Anti-Spam"</h1>
            <h3>Polis Terbit: ${totalPolis} | Server: v8 Security</h3>
            
            <div style="background: #e3f2fd; padding: 20px; display: inline-block; border-radius: 10px;">
                <form action="/hitung" method="POST">
                    <p><label>Nama:</label><br><input type="text" name="nama" required></p>
                    <p><label>Umur:</label><br><input type="number" name="umur" required></p>
                    <p>
                        <label>Perokok?</label><br>
                        <select name="perokok">
                            <option value="tidak">Tidak</option>
                            <option value="ya">Ya</option>
                        </select>
                    </p>
                    <button type="submit" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px;">
                        Simpan Data
                    </button>
                </form>
            </div>
            <p><small>Limit: 5 request / menit</small></p>
        </div>
    `);
});

// PASANG SATPAM DI SINI! (middleware cekSpam)
app.post('/hitung', cekSpam, async (req, res) => {
    const { nama, umur, perokok } = req.body;
    const harga = hitungPremi(parseInt(umur), perokok);
    
    await client.incr('total_polis');

    const dataNasabah = {
        nama: nama, 
        umur: umur, 
        status_perokok: perokok, 
        harga_premi: harga,
        waktu: new Date().toLocaleString()
    };
    
    await client.rPush('riwayat_transaksi', JSON.stringify(dataNasabah));

    await client.rPush('riwayat_transaksi', JSON.stringify(dataNasabah));


// Panggil Microservice Email (Lewat jaringan internal Kubernetes)
try {
    await axios.post('http://email-service-svc:80/kirim-email', {
        nama: nama,
        status: 'AKTIF (Premi Sudah Dihitung)'
    });
    console.log("Perintah kirim email sudah diteruskan.");
} catch (error) {
    console.log("Gagal kontak Email Service:", error.message);
}

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>✅ Berhasil Disimpan!</h1>
            <h2>Halo, ${nama}</h2>
            <a href="/">Kembali</a>
        </div>
    `);
});

// Dulu: const PORT = 3300;
// Sekarang: Ambil port dari Cloud, kalau gak ada baru pake 3300
const PORT = process.env.PORT || 3300; 

app.listen(PORT, () => {
    console.log(`Server v10 jalan di port ${PORT}`);
});
