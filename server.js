const express = require('express');
const redis = require('redis');
const app = express();

// Middleware biar bisa baca inputan Form (Body Parser)
app.use(express.urlencoded({ extended: true }));

const client = redis.createClient({
    url: process.env.REDIS_URL
});

// Koneksi ke Redis Cloud
(async () => {
    client.on('error', (err) => console.log('Redis Client Error', err));
    await client.connect();
    console.log('Terhubung ke Redis Cloud untuk Asuransi!');
})();

// LOGIKA HITUNG PREMI (Sederhana)
function hitungPremi(umur, perokok) {
    let hargaDasar = 500000; // Harga dasar 500rb
    
    // Tiap tahun di atas 20 tahun, nambah 10rb
    if (umur > 20) {
        hargaDasar += (umur - 20) * 10000;
    }

    // Kalau perokok, harga dikali 2 (Resiko tinggi)
    if (perokok === 'ya') {
        hargaDasar = hargaDasar * 2;
    }

    return hargaDasar;
}

// FORMAT RUPIAH
const rupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR"
    }).format(number);
}

// HALAMAN UTAMA (Form Input)
app.get('/', async (req, res) => {
    // Ambil total polis yang sudah laku dari Redis
    let totalPolis = await client.get('total_polis') || 0;

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🛡️ Asuransi Jiwa "Aman Sejahtera"</h1>
            <h3>Total Polis Terbit: ${totalPolis} Orang</h3>
            
            <div style="background: #f0f0f0; padding: 20px; display: inline-block; border-radius: 10px;">
                <form action="/hitung" method="POST">
                    <p>
                        <label>Umur Anda:</label><br>
                        <input type="number" name="umur" required placeholder="Contoh: 25">
                    </p>
                    <p>
                        <label>Apakah Anda Merokok?</label><br>
                        <select name="perokok">
                            <option value="tidak">Tidak</option>
                            <option value="ya">Ya (Perokok)</option>
                        </select>
                    </p>
                    <button type="submit" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                        Cek Harga Premi
                    </button>
                </form>
            </div>
            <p><small>Running on Pod: ${process.env.HOSTNAME}</small></p>
        </div>
    `);
});

// HALAMAN HASIL (Proses Hitung)
app.post('/hitung', async (req, res) => {
    const { umur, perokok } = req.body;
    
    // 1. Hitung harga
    const harga = hitungPremi(parseInt(umur), perokok);
    
    // 2. Simpan transaksi ke Redis (Naikkan counter polis)
    await client.incr('total_polis');

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>Hasil Perhitungan 📝</h1>
            <h2>Umur: ${umur} Tahun | Perokok: ${perokok}</h2>
            <h1 style="color: green; font-size: 50px;">${rupiah(harga)} / tahun</h1>
            
            <a href="/">Kembali</a>
        </div>
    `);
});

const PORT = 3300;
app.listen(PORT, () => {
    console.log(`Server Asuransi jalan di port ${PORT}`);
});