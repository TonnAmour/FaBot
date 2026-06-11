import axios from 'axios';

const menu = {
    name: 'menu',
    alias: ['help', 'comandos', 'panel'],
    category: 'info',
    run: async function (m, { conn, usedPrefix }) {
        try {
            if (!global.plugins) return m.reply('> ✎ ᴇʀʀᴏʀ: ɴᴏ sᴇ ᴇɴᴄᴏɴᴛʀᴀʀᴏɴ ᴄᴏᴍᴀɴᴍᴅᴏs ᴄᴀʀɢᴀᴅᴏs.');

            const categories = {};

            global.plugins.forEach((pluginWrapper) => {
                const plugin = pluginWrapper.plugin;
                if (!plugin) return;

                const category = (plugin.category || 'otros').toUpperCase();
                if (!categories[category]) categories[category] = [];

                let totalCommands = [];
                if (plugin.name && !plugin.name.includes('_')) {
                    totalCommands.push(plugin.name);
                }

                if (plugin.alias && Array.isArray(plugin.alias)) {
                    plugin.alias.forEach(al => {
                        if (al && !totalCommands.includes(al)) {
                            totalCommands.push(al);
                        }
                    });
                }

                totalCommands.forEach(cmd => {
                    categories[category].push(` ⛩️  ${usedPrefix}${cmd}`);
                });
            });

            let menuText = `👑 *${name(conn)}* 👑\n`;
            menuText += `*───────────────────*\n`;
            menuText += `⚙️ *ᴘʀᴇғɪᴊᴏ:* [ ${usedPrefix} ]\n`;
            menuText += `*───────────────────*\n\n`;
            menuText += `${rmr}\n\n`;

            const orderedCategories = Object.keys(categories).sort();

            orderedCategories.forEach((cat) => {
                if (categories[cat].length === 0) return;

                const uniqueCommands = [...new Set(categories[cat])].sort();

                menuText += `┏━━〔 *${cat}* 〕━━┓\n`;
                uniqueCommands.forEach(cmd => {
                    menuText += `┃${cmd}\n`;
                });
                menuText += `┗━━━━━━━━━━━━━━━┛\n\n`;
            });

            menuText += `_Desarrollado por yi3nes._`;

            const targetUrl = "https://cdn.dix.lat";
            const imgUrl = "https://cdn.dix.lat/me/b7f2e139-8235-44cc-9ebd-9bc7fc97c0a8.jpg";

            const response = await axios.get(imgUrl, { responseType: 'arraybuffer' }).catch(() => null);
            if (!response) return m.reply("Error al descargar la miniatura del menú.");

            await conn.relayMessage(m.chat, {
                extendedTextMessage: {
                    text: targetUrl + "\n@120363424254110342@g.us\n\n" + menuText,
                    matchedText: targetUrl,
                    canonicalUrl: targetUrl,
                    description: null,
                    title: `❖ KIRITO - BOT MD ❖`,
                    jpegThumbnail: response.data,
                    previewType: 1,
                    contextInfo: {
                        ...channelInfo,
                        mentionedJid: [m.sender],
                        groupMentions: [
                            {
                                groupJid: "120363424254110342@g.us",
                                groupSubject: "Hola soy yo ❖ FABOT - BOT MD ❖"
                            }
                        ],
                        externalAdReply: {
                    title: `❖ FABOT - BOT MD ❖`,
                            body: "FaBot MD Network",
                            mediaType: 1,
                            previewType: 0,
                            thumbnailType: "PHOTO",
                            thumbnail: response.data,
                            sourceUrl: targetUrl,
                            renderLargerThumbnail: true
                        }
                    }
                }
            }, { quoted: m });

        } catch (e) {
            console.error(e);
            return m.reply('> ✎ ᴇʀʀᴏʀ ᴀʟ ɢᴇɴᴇʀᴀʀ ᴇʟ ᴍᴇɴᴜ.');
        }
    }
};

export default menu;
