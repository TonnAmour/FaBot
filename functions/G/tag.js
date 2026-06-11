const hidetagCommand = {
    name: 'hidetag',
    alias: ['tag', 'n', 'notificar'],
    category: 'group',
    admin: true,
    group: true,
    run: async (m, { conn, text }) => {
        try {
            let metadata = global.groupCache?.get(m.chat);
            if (!metadata) {
                metadata = await conn.groupMetadata(m.chat).catch(() => null);
                if (metadata && global.groupCache) global.groupCache.set(m.chat, metadata);
            }

            if (!metadata || !metadata.participants) return await m.react('❌');

            const users = [];
            metadata.participants.forEach(u => {
                if (u.id) users.push(u.id);
                if (u.phoneNumber) users.push(u.phoneNumber);
            });

            const mentions = [...new Set(users)];
            const q = m.quoted ? m.quoted : m;
            const mime = (q.msg || q).mimetype || '';
            const tagText = text || (m.quoted && m.quoted.text) || "Nᴏᴛɪғɪᴄᴀᴄɪóɴ Gᴇɴᴇʀᴀʟ";

            if (mime) {
                const media = await q.download();
                const type = mime.split('/')[0];

                if (mime.includes('webp')) {
                    await conn.sendMessage(m.chat, { sticker: media, mentions }, { quoted: m });
                } else {
                    await conn.sendMessage(m.chat, { 
                        [type]: media, 
                        caption: tagText, 
                        mentions 
                    }, { quoted: m });
                }
            } else {
                await conn.sendMessage(m.chat, { 
                    text: tagText,
                    contextInfo: { 
                        mentionedJid: mentions,
                        groupMentions: [],
                        isForwarded: false
                    }
                }, { quoted: m });
            }

            await m.react('✅');
        } catch (e) {
            console.error(e);
            await m.react('❌');
        }
    }
}

export default hidetagCommand;