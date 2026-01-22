const amqp = require('amqplib');

// Simulasi kirim email (tunggu 1 detik)
const kirimEmail = (data) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`📧 [EMAIL TERKIRIM] Kepada: ${data.nama} | Isi: "Halo ${data.nama}, polis asuransi rokokmu (${data.perokok}) sudah aktif!"`);
            resolve();
        }, 1000);
    });
};

async function startWorker() {
    try {
        // 👇 INI PERUBAHAN PENTINGNYA!
        // Baca variable RABBITMQ_URL dari Railway. Kalau kosong, baru pake 'amqp://rabbitmq'
        const connectionString = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
        
        console.log("⏳ Worker mencoba konek ke RabbitMQ...");
        const conn = await amqp.connect(connectionString);
        const ch = await conn.createChannel();
        
        const queue = 'antrian_email';
        await ch.assertQueue(queue);
        
        console.log(`✅ TUKANG POS SIAP! Menunggu pesan di antrian '${queue}'...`);

        ch.consume(queue, async (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                console.log(`📩 Menerima tugas: Kirim ke ${data.nama}`);
                
                await kirimEmail(data);
                
                ch.ack(msg); // Lapor ke Bos RabbitMQ: "Tugas Selesai!"
            }
        });

    } catch (err) {
        console.error("❌ Error Worker (Gagal Konek):", err.message);
        // Coba lagi setelah 5 detik (Retry Logic)
        setTimeout(startWorker, 5000);
    }
}

startWorker();