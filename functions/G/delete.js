const deleteCommand = {
    name: 'delete',
    alias: ['del', 'd', 'borrar'],
    category: 'group',
    admin: true,
    group: true,
    run: async (m, { conn, text }) => {
        try {
            if (m.quoted) {
                const key = m.quoted.key || {
                    remoteJid: m.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id,
                    participant: m.quoted.sender || m.quoted.author
                };

                await conn.sendMessage(m.chat, { delete: key });

                const count = parseInt(text);
                if (!isNaN(count) && count > 1) {
                    const limit = Math.min(count - 1, 20);
                    const messages = conn.store?.messages[m.chat]?.array || [];
                    const userMessages = messages
                        .filter(v => (v.key.participant || v.key.remoteJid) === m.quoted.sender)
                        .slice(-limit);

                    for (const msg of userMessages.reverse()) {
                        await conn.sendMessage(m.chat, { delete: msg.key }).catch(() => null);
                    }
                }
                return;
            }

            const count = parseInt(text);
            if (!isNaN(count) && count > 0) {
                const limit = Math.min(count, 20);
                const messages = conn.store?.messages[m.chat]?.array || [];

                if (!messages || messages.length === 0) {
                    return conn.reply(m.chat, 'El store esta vacio para este chat.', m);
                }

                const toDelete = messages.slice(-limit);
                for (const msg of toDelete.reverse()) {
                    if (msg.key) {
                        await conn.sendMessage(m.chat, { delete: msg.key }).catch(() => null);
                    }
                }
                return;
            }

            return conn.reply(m.chat, 'Responde a un mensaje para borrarlo.', m);

        } catch (e) {

            const errorText = format(e);
            await conn.reply(m.chat, `[ERROR] ${e.message}`, m);
        }
    }
}

export default deleteCommand;