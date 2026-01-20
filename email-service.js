const express = require('express');
const amqp = require('amqplib'); // Import library
const app = express();

async function startWorker() {
    try {
        // Tunggu RabbitMQ nyala dulu (karena dia agak lama bangun tidur)
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 1. Konek ke RabbitMQ
        const connection = await amqp.connect('amqp://rabbitmq');
        const channel = await connection.createChannel();
        const queue = 'antrian_email';

        // 2. Siapkan Kotak Surat
        await channel.assertQueue(queue, { durable: true });
        console.log("📬 Menunggu pesan di antrian...");

        // 3. Proses Surat yang Masuk
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                
                // Pura-pura kirim email (Loading 2 detik)
                setTimeout(() => {
                    console.log(`📧 MENGIRIM EMAIL KE: ${data.nama} | Tagihan: ${data.harga}`);
                    // Bilang ke RabbitMQ: "Tugas Selesai, Hapus surat ini"
                    channel.ack(msg); 
                }, 2000);
            }
        });

    } catch (error) {
        console.log("Error Worker:", error);
    }
}

startWorker(); // Jalankan Worker

const PORT = 80;
app.listen(PORT, () => {
    console.log(`Email Service jalan di port ${PORT}`);
});