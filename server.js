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
    const express = require('express');
    const redis = require('redis');
    const app = express();
    
    app.use(express.urlencoded({ extended: true }));
    
    const client = redis.createClient({
        url: process.env.REDIS_URL
    });
    
    (async () => {
        client.on('error', (err) => console.log('Redis Client Error', err));
        await client.connect();
        console.log('Terhubung ke Redis Cloud!');
    })();
    
    function hitungPremi(umur, perokok) {
        let hargaDasar = 500000;
        if (umur > 20) hargaDasar += (umur - 20) * 10000;
        if (perokok === 'ya') hargaDasar = hargaDasar * 2;
        return hargaDasar;
    }
    
    const rupiah = (number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(number);
    }
    
    app.get('/', async (req, res) => {
        // Ambil total polis (Angka)
        let totalPolis = await client.get('total_polis') || 0;
    
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>🛡️ Asuransi Jiwa "Super Lengkap"</h1>
                <h3>Polis Terbit: ${totalPolis} | Server: v6</h3>
                
                <div style="background: #e3f2fd; padding: 20px; display: inline-block; border-radius: 10px;">
                    <form action="/hitung" method="POST">
                        <p>
                            <label>Nama Lengkap:</label><br>
                            <input type="text" name="nama" required placeholder="Siapa nama anda?">
                        </p>
                        <p>
                            <label>Umur:</label><br>
                            <input type="number" name="umur" required placeholder="25">
                        </p>
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
            </div>
        `);
    });
    
    app.post('/hitung', async (req, res) => {
        const { nama, umur, perokok } = req.body; // Ambil nama juga
        const harga = hitungPremi(parseInt(umur), perokok);
        
        // 1. Naikkan Counter Angka (Tetap dipakai)
        await client.incr('total_polis');
    
        // 2. DATA KOMPLEKS: Buat Object Nasabah
        const dataNasabah = {
            nama: nama,
            umur: umur,
            status_perokok: perokok,
            harga_premi: harga,
            waktu_daftar: new Date().toLocaleString() // Catat jam server
        };
    
        // 3. Simpan ke Redis LIST (Key: 'riwayat_transaksi')
        // Kita harus ubah Object jadi String (JSON) karena Redis cuma bisa simpan teks
        await client.rPush('riwayat_transaksi', JSON.stringify(dataNasabah));
    
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>✅ Data Tersimpan!</h1>
                <h2>Halo, ${nama}</h2>
                <h3>Premi Anda: ${rupiah(harga)}</h3>
                <p>Data anda sudah masuk ke Database Cloud.</p>
                <a href="/">Kembali</a>
            </div>
        `);
    });
    
    const PORT = 3300;
    app.listen(PORT, () => {
        console.log(`Server v6 jalan di port ${PORT}`);
    });
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