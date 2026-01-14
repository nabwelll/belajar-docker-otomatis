const express = require('express');
const app = express();

app.use(express.json());

app.post('/kirim-email', (req, res) => {
    const { nama, status } = req.body;
    
    // Pura-pura kirim email (Log ke layar server)
    console.log(`[EMAIL SERVICE] 📨 Mengirim Email ke: ${nama}`);
    console.log(`[EMAIL CONTENT] "Halo ${nama}, status asuransi kamu: ${status}"`);
    console.log(`------------------------------------------------`);

    res.json({ message: 'Email berhasil dikirim bos!' });
});

const PORT = 4000; // Jalan di port beda (4000)
app.listen(PORT, () => {
    console.log(`📮 Email Service standby di port ${PORT}`);
});