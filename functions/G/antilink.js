import { jidNormalizedUser } from '@whiskeysockets/baileys';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const antiLinkPlugin = {
    name: 'antilink_pro',
    async before(m, { conn, isAdmin, isBotAdmin, isOwner, chat }) {
        if (!m.isGroup || !chat?.antiLink || isOwner || isAdmin || m.fromMe) return false;

        const currentMessageText = m.msg?.text || m.msg?.caption || m.text || '';

        const linkRegex = /chat\.whatsapp\.com\/(?:invite\/)?([0-9A-Za-z]{20,24})/i;
        const channelRegex = /whatsapp\.com\/channel\/([0-9A-Za-z]{20,30})/i;

        const isGroupLink = linkRegex.exec(currentMessageText);
        const isChannelLink = channelRegex.exec(currentMessageText);

        const isForwardedChannel = !!(m.msg?.contextInfo?.forwardedNewsletterMessageInfo || m.message?.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo);

        if (isGroupLink || isChannelLink || isForwardedChannel) {
            if (isGroupLink && isBotAdmin) {
                const myCode = await conn.groupInviteCode(m.chat).catch(() => null);
                if (myCode && isGroupLink[1].includes(myCode)) return false;
            }

            if (isBotAdmin) {
                await conn.sendMessage(m.chat, { delete: m.key }).catch(() => null);
                await delay(500);
                await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => null);

                const type = (isChannelLink || isForwardedChannel) ? 'canales' : 'otros grupos';
                await conn.sendMessage(m.chat, { 
                    text: `> ✰ Se ha eliminado a @${m.sender.split('@')[0]} del grupo por \`AntiLink\`, no permitimos enlaces de *${type}*.`,
                    mentions: [m.sender]
                }).catch(() => null);
            } else {

            }
            return true;
        }
        return false;
    }
};

export default antiLinkPlugin;