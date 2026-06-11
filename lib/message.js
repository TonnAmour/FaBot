import { format } from 'util';
import { fileURLToPath } from 'url';
import path, { join } from 'path';
import { unwatchFile, watchFile } from 'fs';
import chalk from 'chalk';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { getRealJid } from './identifier.js';

const __filename = fileURLToPath(import.meta.url);

const cleanJid = (jid) => {
    if (!jid) return '';
    const [user, server] = jid.split('@');
    return `${user.split(':')[0]}@${server || 's.whatsapp.net'}`;
};

export async function message(m, chatUpdate) {
    this.uptime = this.uptime || Date.now();
    const conn = this;
    if (!m || !conn?.user) return;

    const botJid = `${conn.user.id.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    const currentChatJid = cleanJid(m.chat);
    if (!m.isGroup && currentChatJid === botJid) return;

    const chatJid = m.chat;

    const getTxt = (obj) => {
        if (!obj) return '';
        return (
            obj.conversation ||
            obj.extendedTextMessage?.text ||
            obj.imageMessage?.caption ||
            obj.videoMessage?.caption ||
            obj.groupInviteMessage?.caption ||
            obj.msg?.text ||
            obj.msg?.caption ||
            obj.msg?.contentText ||
            ''
        ).trim();
    };

    m.text = getTxt(m.message || m);
    const quotedText = m.quoted ? (m.quoted.text || getTxt(m.quoted)) : '';

    const fullTextSearch = `${m.text} ${quotedText}`.trim();

    const activePrefixes = ['.', '#', '/', '!'];
    const usedPrefix = activePrefixes.find(p => m.text.startsWith(p));

    if (!m.sender.endsWith('@s.whatsapp.net') && !m.sender.endsWith('@lid')) return;

    const realSenderId = await getRealJid(conn, m.sender, m);
    const cleanSenderId = cleanJid(realSenderId);
    const senderNumber = cleanSenderId.split('@')[0];

    let isROwner = global.owner.some(([num]) => num.replace(/\D/g, '') === senderNumber);

    let chat = null;
    let user = null;
    let initialUserSnapshot = null;

    try {
        if (m?.isGroup) {
            if (!global.db.chats) global.db.chats = {};
            chat = global.db.chats[chatJid];
            if (!chat) {
                global.db.chats[chatJid] = { 
                    id: chatJid, 
                    welcome: true,   
                    antiLink: true, 
                    antiLink2: false, 
                    antiStatus: false,
                    customWelcome: null,
                    antiToxic: true
                };
                chat = global.db.chats[chatJid];
            }
        }

        if (!global.db.users) global.db.users = {};
        user = global.userCache.get(realSenderId);
        if (!user && (usedPrefix || m.isGroup)) {
            user = global.db.users[realSenderId];
            if (!user && usedPrefix) {
                global.db.users[realSenderId] = {
                    id: realSenderId,
                    name: m.pushName || "",
                    warnAntiLink: 0,
                    banned: false,
                    lastSeen: new Date()
                };
                user = global.db.users[realSenderId];
            }
            if (user) global.userCache.set(realSenderId, user);
        }
        if (user) {
            initialUserSnapshot = JSON.stringify(user);
        }
    } catch (e) { return; }

    let participants = [];
    let isAdmin = false;
    let isBotAdmin = false;

    if (m.isGroup) {
        try {
            const groupMetadata = await conn.groupMetadata(chatJid);
            participants = groupMetadata?.participants || [];

            const adminRoles = ['admin', 'superadmin'];
            const numSender = cleanSenderId.split('@')[0].replace(/\D/g, '');
            const numBot = botJid.split('@')[0].replace(/\D/g, '');

            const userParticipant = participants.find(p => {
                const pNum = p.phoneNumber ? p.phoneNumber.replace(/\D/g, '') : p.id.split('@')[0].replace(/\D/g, '');
                return pNum === numSender;
            });
            isAdmin = userParticipant ? adminRoles.includes(userParticipant.admin) : false;

            const botParticipant = participants.find(p => {
                const pNum = p.phoneNumber ? p.phoneNumber.replace(/\D/g, '') : p.id.split('@')[0].replace(/\D/g, '');
                return pNum === numBot;
            });
            isBotAdmin = botParticipant ? adminRoles.includes(botParticipant.admin) : false;
        } catch {
            participants = [];
            isAdmin = false;
            isBotAdmin = false;
        }
    }

    if (m.isGroup && chat && !isROwner) {
        if ((chat.muto || chat.mutos?.includes(realSenderId)) && isBotAdmin) {
            await conn.sendMessage(m.chat, { delete: m.key }).catch(() => null);
            return; 
        }
    }

    const allPlugins = Array.from(global.plugins.values());
    for (const pluginWrapper of allPlugins) {
        const plugin = pluginWrapper.plugin;
        if (plugin?.before && typeof plugin.before === 'function') {
            try {
                if (await plugin.before.call(this, m, { 
                    conn, isAdmin, isBotAdmin, isOwner: isROwner, isROwner, participants, chat, user, fullText: fullTextSearch
                })) return;
            } catch (e) { continue; }
        }
    }

        const isEvalTrigger = m.text.startsWith('=>') || m.text.startsWith('>') || m.text.startsWith('await ') || m.text.startsWith('.=>') || m.text.startsWith('.>');
    if (!usedPrefix && !isEvalTrigger) return;

    if (user?.banned && !isROwner) {
        if (!global.banCooldown) global.banCooldown = new Map();
        const now = Date.now();
        if (now - (global.banCooldown.get(m.sender) || 0) > 30000) {
            global.banCooldown.set(m.sender, now);
            await conn.sendMessage(m.chat, { text: `*ACCESO RESTRINGIDO*${user.banReason ? `\n\nRazon: ${user.banReason}` : ''}` }, { quoted: m }).catch(() => null);
        }
        return;
    }

    if (m.isGroup && chat?.modoadmin && !isAdmin && !isROwner) return;

        const noPrefix = usedPrefix ? m.text.slice(usedPrefix.length).trim() : m.text.trim();
    const spaceIndex = noPrefix.search(/[\s\n]/);

    let command = '';
    let text = '';
    let args = [];

    if (spaceIndex === -1) {
        command = noPrefix.toLowerCase();
    } else {
        command = noPrefix.slice(0, spaceIndex).toLowerCase();
        text = noPrefix.slice(spaceIndex).trim();
        args = text.split(/\s+/).filter(Boolean);
    }

    const isActualCommand = global.plugins.has(command) || global.aliases.has(command);

    if (!m.isGroup && isActualCommand && !isROwner && (cleanSenderId !== botJid && !m.fromMe)) {
        return;
    }

    if (chat?.isBanned && command !== 'bot' && command !== 'enable' && command !== 'onchat') return;

    const pluginWrapper = global.plugins.has(command) ? global.plugins.get(command) : global.plugins.get(global.aliases.get(command));
    const plugin = pluginWrapper ? pluginWrapper.plugin : null;

    if (plugin) {
        if (m.isGroup && (plugin.admin || plugin.botAdmin)) {
            try {
                const updatedGroupMetadata = await conn.groupMetadata(chatJid);
                participants = updatedGroupMetadata?.participants || [];

                const adminRoles = ['admin', 'superadmin'];
                const numSender = cleanSenderId.split('@')[0].replace(/\D/g, '');
                const numBot = botJid.split('@')[0].replace(/\D/g, '');

                const userParticipant = participants.find(p => {
                    const pNum = p.phoneNumber ? p.phoneNumber.replace(/\D/g, '') : p.id.split('@')[0].replace(/\D/g, '');
                    return pNum === numSender;
                });
                isAdmin = userParticipant ? adminRoles.includes(userParticipant.admin) : false;

                const botParticipant = participants.find(p => {
                    const pNum = p.phoneNumber ? p.phoneNumber.replace(/\D/g, '') : p.id.split('@')[0].replace(/\D/g, '');
                    return pNum === numBot;
                });
                isBotAdmin = botParticipant ? adminRoles.includes(botParticipant.admin) : false;
            } catch {}
        }

        const checkPermissions = (perm) => ({
            rowner: isROwner, owner: isROwner, group: m.isGroup, 
            botAdmin: isBotAdmin, admin: isAdmin, private: !m.isGroup
        }[perm]);

        if (plugin.nsfw && !chat?.nsfw) {
            global.dfail('nsfw', m, conn);
            return;
        }

        for (const perm of ['rowner', 'owner', 'group', 'botAdmin', 'admin', 'private']) {
            if (plugin[perm] && !checkPermissions(perm)) {
                global.dfail(perm, m, conn);
                return;
            }
        }

        try {
            await conn.readMessages([m.key]).catch(() => null);
            await plugin.run.call(conn, m, { 
                usedPrefix, noPrefix, args, command, text, conn, user, chat, 
                isROwner, isAdmin, isBotAdmin, participants,
                settings: {}
            });
            if (user) {
                global.userCache.set(realSenderId, user);
                global.db.users[realSenderId] = user;
                const finalUserSnapshot = JSON.stringify(user);
                if (initialUserSnapshot !== finalUserSnapshot) {
                    if (typeof global.updateUser === 'function') {
                        global.updateUser(realSenderId, user);
                    }
                }
            }
        } catch (e) {
            console.error(chalk.red(`Error: ${command}`), e.message);
        }
    }
}

global.dfail = (type, m, conn, cost) => {
    const messages = {
        rowner: `Solo mi creador puede usar este comando.`,
        owner: `Solo mi creador puede usar este comando.`,
        group: `Este comando solo se puede usar en grupos.`,
        private: `Este comando solo se puede usar en privado.`,
        admin: `Solo los administradores pueden ejecutar este comando.`,
        nsfw: `El contenido NSFW esta desactivado.`,
        botAdmin: `Necesito ser administrador.`
    };
    if (messages[type] && m.chat) conn.reply(m.chat, messages[type], m).catch(() => null);
};

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
    unwatchFile(file)
    console.log(chalk.redBright("Update 'handler.js'"))
    import(`${file}?update=${Date.now()}`)
})
