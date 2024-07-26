const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({ auth: state });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Conexión abierta');
        }

        if (qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (err) {
                    console.error('Error generando el QR:', err);
                } else {
                    console.log('QR generado:', url);
                }
            });
        }
    });

    return sock;
}

connectToWhatsApp().then(sock => {
    app.post('/send-message', async (req, res) => {
        const { number, message } = req.body;
        console.log(req);
        try {
            await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
            res.status(200).send('Mensaje enviado');
        } catch (error) {
            console.error('Error al enviar el mensaje:', error);
            res.status(500).send('Error al enviar el mensaje ' + error);
        }
    });

    app.get('/get-qr', (req, res) => {
        connectToWhatsApp().then(sock => {
            sock.ev.on('connection.update', (update) => {
                const { qr } = update;
                if (qr) {
                    QRCode.toDataURL(qr, (err, url) => {
                        if (err) {
                            res.status(500).send('Error generando el QR');
                        } else {
                            res.send(`<img src="${url}" alt="QR Code" />`);
                        }
                    });
                } else {
                    res.status(500).send('QR no disponible');
                }
            });
        }).catch(err => res.status(500).send('Error al conectar con WhatsApp'));
    });

    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
}).catch(err => console.log('Error al conectar con WhatsApp:', err));
