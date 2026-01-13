const express = require('express');
const redis = require('redis');
const app = express();

app.use(express.urlencoded({ extended: true }));

// --- [BAGIAN 1: BIKIN KUNCI MOTOR (REDIS) DULU] ---
// Ini WAJIB ada di atas sebelum dipanggil oleh app.get atau app.post
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

// --- [BAGIAN 2: BARU BOLEH PAKE MOTORNYA (ROUTES)] ---

app.get('/', async (req, res) => {
    // Di sini 'client' sudah aman dipanggil karena sudah dibuat di atas
    let totalPolis = await client.get('total_polis') || 0;

    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🛡️ Asuransi Jiwa "Super Lengkap"</h1>
            <h3>Polis Terbit: ${totalPolis} | Server: v6 Fix</h3>
            
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
    const { nama, umur, perokok } = req.body;
    const harga = hitungPremi(parseInt(umur), perokok);
    
    await client.incr('total_polis');

    const dataNasabah = {
        nama: nama,
        umur: umur,
        status_perokok: perokok,
        harga_premi: harga,
        waktu_daftar: new Date().toLocaleString()
    };

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
    console.log(`Server v6 Fix jalan di port ${PORT}`);
});