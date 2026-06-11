import axios from 'axios';

const linkCommand = {
    name: 'link',
    alias: ['enlace', 'link'],
    category: 'group',
    group: true,
    botAdmin: true,
    run: async (m, { conn }) => {
        try {
            const groupMetadata = await conn.groupMetadata(m.chat);
            const inviteCode = await conn.groupInviteCode(m.chat);
            const mainLink = `https://chat.whatsapp.com/${inviteCode}`;

            let shortLink;
            try {

                const { data } = await axios.post('https://dix.lat/short.php', {
                    url: mainLink
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                shortLink = data.status ? data.url : 'No disponible';
            } catch (error) {
                console.error('Error al acortar:', error);
                shortLink = 'Error en el servicio';
            }

            const caption = `*─── 「 ENLACE DE GRUPO 」 ───*\n\n▢ *GRUPO:* ${groupMetadata.subject}\n▢ *MIEMBROS:* ${groupMetadata.participants.length}\n\n▢ *ENLACE PRINCIPAL:*\n• ${mainLink}\n\n▢ *ENLACE CORTO:*\n• ${shortLink}\n\n*──────────────────────────*`.trim();

            await conn.sendMessage(m.chat, {
                text: caption
            }, { quoted: m });
        } catch (e) {
            console.error(e);
        }
    }
};

export default linkCommand;