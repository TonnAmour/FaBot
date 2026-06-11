import { jidNormalizedUser } from '@whiskeysockets/baileys';

export async function observeEvents(conn) {
    if (!conn) return;

    conn.ev.on('group-participants.update', async (m) => {
        try {
            const chatJid = m.id || m.chat;
            if (!chatJid?.endsWith('@g.us')) return;

            if (!global.db?.chats) return;
            const chat = global.db.chats[chatJid];

            if (!chat || !chat.welcome || chat.isBanned) return;

            const botJid = jidNormalizedUser(conn.user?.id || '');
            const isMainBot = botJid === jidNormalizedUser(global.conn?.user?.id || '');

            if (chat.antisub && !isMainBot) return;

            if (m.action === 'add') {
                const groupMetadata = await conn.groupMetadata(chatJid).catch(() => ({}));
                const groupName = groupMetadata.subject || 'Sistema';
                const memberCount = groupMetadata.participants?.length || 0;
                const groupDesc = groupMetadata.desc || 'Sin descripción';

                for (const part of m.participants) {
                    const userJid = part.id || part;
                    if (!userJid || typeof userJid !== 'string') continue;

                    const whoTag = `@${userJid.split('@')[0]}`;

                    let txt = '';
                    if (chat.customWelcome) {
                        txt = chat.customWelcome
                            .replace(/@us/g, whoTag)
                            .replace(/@g/g, groupName)
                            .replace(/@t/g, memberCount)
                            .replace(/@d/g, groupDesc)
                            .replace(/@n/g, groupName.toUpperCase());
                    } else {
                        txt = `[ BIENVENIDO ]\nUsuario: ${whoTag}\nGrupo: ${groupName}\nMiembros: ${memberCount}`;
                    }

                    const thumb = await conn.profilePictureUrl(userJid, 'image').catch(() => 'https://telegra.ph/file/24fa902eae053424ef841.jpg');

                    await conn.sendMessage(chatJid, { 
                        image: { url: thumb }, 
                        caption: txt, 
                        mentions: [userJid] 
                    }).catch(() => null);
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
}
