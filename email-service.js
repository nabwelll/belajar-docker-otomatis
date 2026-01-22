const express = require('express');
const amqp = require('amqplib');
const app = express();

let retryCount = 0;
const MAX_RETRIES = 10;

async function startWorker() {
    try {
        console.log(`🔄 Attempt ${retryCount + 1}/${MAX_RETRIES} - Connecting to RabbitMQ... `);
        
        // Connect dengan timeout
        const connection = await amqp.connect('amqp://rabbitmq', {
            heartbeat: 60,
        });
        
        console.log('✅ Connected to RabbitMQ!');
        
        const channel = await connection.createChannel();
        const queue = 'antrian_email';

        // Assert queue
        await channel.assertQueue(queue, { durable: true });
        console.log("📬 Menunggu pesan di antrian...");
        
        // Reset retry count setelah berhasil connect
        retryCount = 0;

        // Handle connection errors
        connection.on('error', (err) => {
            console.log('❌ RabbitMQ connection error:', err.message);
            setTimeout(startWorker, 5000);
        });

        connection.on('close', () => {
            console.log('⚠️ RabbitMQ connection closed, reconnecting...');
            setTimeout(startWorker, 5000);
        });

        // Consume messages
        channel.consume(queue, (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                
                console.log(`⏳ Processing:  ${data.nama}... `);
                
                // Simulate email sending (2 seconds delay)
                setTimeout(() => {
                    console.log(`📧 MENGIRIM EMAIL KE: ${data.nama} | Umur: ${data.umur || 'N/A'} | Perokok: ${data.perokok || 'N/A'}`);
                    channel.ack(msg);
                }, 2000);
            }
        });

    } catch (error) {
        console.log(`❌ Error Worker (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
        
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
            const delay = Math.min(retryCount * 2000, 10000); // Exponential backoff, max 10s
            console.log(`⏰ Retrying in ${delay/1000} seconds...`);
            setTimeout(startWorker, delay);
        } else {
            console.log('💀 Max retries reached. Giving up.');
            process.exit(1);
        }
    }
}

// Start worker after 5 seconds (give RabbitMQ time to fully start)
setTimeout(() => {
    console.log('🚀 Starting Email Worker...');
    startWorker();
}, 5000);

const PORT = 80;
app.listen(PORT, () => {
    console.log(`✅ Email Service HTTP server running on port ${PORT}`);
});