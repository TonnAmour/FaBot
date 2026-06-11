const enable = {
    name: 'enable',
    alias: ['welcome', 'bv', 'antilink', 'antilink2'], 
    category: 'config',
    admin: true,
    group: true,
    run: async function (m, { conn, command, chat, usedPrefix }) {

        const featureMap = {
            'welcome': 'welcome',
            'bv': 'welcome',
            'antilink': 'antiLink',
            'antilink2': 'antiLink2'
        };

        const type = command.toLowerCase();

        if (type === 'enable' || !featureMap[type]) {
            let menu = `❯❯ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗖𝗢𝗡𝗙𝗜𝗚𝗨𝗥𝗔𝗧𝗜𝗢𝗡\n\n`;
            const options = [
                { name: 'Bienvenida', key: 'welcome' },
                { name: 'Anti-Links', key: 'antiLink' },
                { name: 'Anti-Links2', key: 'antiLink2' }
            ];

            options.forEach(opt => {
                const status = chat[opt.key] ? '✅ ᴀᴄᴛɪᴠᴀᴅᴏ' : '❌ ᴅᴇsᴀᴄᴛɪᴠᴀᴅᴏ';
                menu += `❖ *${opt.name}:* ${status}\n`;
            });
            return m.reply(menu.trim());
        }

        const dbKey = featureMap[type];
        const newValue = !chat[dbKey];

        chat[dbKey] = newValue;
        
        if (global.db?.chats?.[m.chat]) {
            global.db.chats[m.chat][dbKey] = newValue;
        }

        let statusText = newValue ? 'ᴀᴄᴛɪᴠᴀᴅᴏ' : 'ᴅᴇsᴀᴄᴛɪᴠᴀᴅᴏ';
        return m.reply(`> ʟᴀ ғᴜɴᴄɪᴏɴ *${type.toUpperCase()}* sᴇ ʜᴀ ${statusText}.`);
    }
}
export default enable;
