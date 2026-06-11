import { jidNormalizedUser, getContentType, downloadContentFromMessage, generateWAMessageFromContent, prepareWAMessageMedia, generateWAMessage, delay, jidDecode, generateForwardMessageContent } from '@whiskeysockets/baileys';
import { getRealJid, resolveMentions } from './identifier.js';
import fs from 'fs';
import { Buffer } from 'buffer';
import axios from 'axios';

export const smsg = async (conn, m) => {
    if (!m) return m;

    if (!conn.downloadM) {
        conn.generateWAMessageFromContent = generateWAMessageFromContent;
        conn.prepareWAMessageMedia = prepareWAMessageMedia;
        conn.generateWAMessage = generateWAMessage;

        conn.downloadM = async (message, type) => {
            if (!message) return Buffer.alloc(0);
            const stream = await downloadContentFromMessage(message, type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
        };

        conn.getFile = async (PATH, save) => {
            let res, data;
            if (Buffer.isBuffer(PATH)) {
                data = PATH;
            } else if (typeof PATH === 'string' && PATH.startsWith('data:')) {
                data = Buffer.from(PATH.split(',')[1], 'base64');
            } else if (typeof PATH === 'string' && PATH.startsWith('http')) {
                res = await axios.get(PATH, { responseType: 'arraybuffer' });
                data = Buffer.from(res.data);
            } else {
                data = await fs.promises.readFile(PATH);
            }

            const mime = res?.headers?.['content-type'] || 'image/png';
            const filename = `file_${Date.now()}.${mime.split('/')[1] || 'bin'}`;

            if (save) {
                await fs.promises.writeFile(filename, data);
            }
            return { res, filename, data, mime };
        };

        conn.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
            const { data, mime } = await conn.getFile(path, false);
            const mtype = /webp/.test(mime) ? 'sticker' : /image/.test(mime) ? 'image' : /video/.test(mime) ? 'video' : /audio/.test(mime) ? (ptt ? 'ptt' : 'audio') : 'document';

            return conn.sendMessage(conn.decodeJid(jid), {
                [mtype]: data,
                caption,
                mimetype: mime,
                fileName: filename,
                ...options
            }, { quoted, ...options });
        };

        conn.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return (decode?.user && decode?.server) ? `${decode.user}@${decode.server}` : jidNormalizedUser(jid);
            }
            return jidNormalizedUser(jid);
        };

        if (conn.groupMetadata && !conn.patchedGroupMetadata) {
            const originalGroupMetadata = conn.groupMetadata.bind(conn);
            conn.groupMetadataRaw = originalGroupMetadata;

            conn.groupMetadata = async (jid) => {
                const metadata = await originalGroupMetadata(jid);
                if (metadata) {
                    if (metadata.ownerPn) metadata.owner = metadata.ownerPn;
                    if (metadata.subjectOwnerPn) metadata.subjectOwner = metadata.subjectOwnerPn;
                    if (Array.isArray(metadata.participants)) {
                        metadata.participants = await Promise.all(metadata.participants.map(async p => {
                            const originalId = p.id;
                            const isLid = originalId?.endsWith('@lid');
                            const realJid = p.phoneNumber || (await getRealJid(conn, originalId)) || conn.decodeJid(originalId);
                            return {
                                ...p,
                                id: realJid,
                                phoneNumber: p.phoneNumber || realJid,
                                lid: isLid ? originalId : (p.lid || undefined),
                                username: p.username || undefined
                            };
                        }));
                    }
                }
                return metadata;
            };
            conn.patchedGroupMetadata = true;
        }

        conn.parseMention = (text = '') => {
            if (typeof text !== 'string') return [];
            return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => conn.decodeJid(`${v[1]}@s.whatsapp.net`));
        };

        conn.reply = (jid, text = '', quoted, options = {}) => {
            if (!text) return;
            return conn.sendMessage(conn.decodeJid(jid), { text: text.trim(), mentions: conn.parseMention(text) }, { quoted: quoted || m, ...options });
        };
    }

    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') || m.id.length === 16;
        m.chat = conn.decodeJid(m.key.remoteJid);
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        const botId = conn.user?.id ? conn.decodeJid(conn.user.id) : '';
        m.author = conn.decodeJid(m.key.participant || m.key.remoteJid || m.participant || botId);
        m.sender = await getRealJid(conn, m.author, m);

        const botName = conn.settings?.botName || 'FaBot';
        m.pushName = m.fromMe ? botName : (m.pushName || m.verifiedName || 'Usuario');

        m.reply = (text, chat = m.chat, options = {}) => text ? conn.reply(conn.decodeJid(chat), text, m, options) : undefined;
        m.react = (emoji) => emoji ? conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) : undefined;
    }

    if (m.message) {
        m.mtype = getContentType(m.message);
        if (m.mtype === 'protocolMessage' || m.mtype === 'senderKeyDistributionMessage') return m;
        m.msg = (m.mtype === 'viewOnceMessageV2' || m.mtype === 'viewOnceMessage') 
            ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] 
            : m.message[m.mtype];
        if (!m.msg) return m;

        let rawText = m.msg?.text || m.msg?.caption || m.msg?.contentText || m.message?.conversation || m.msg?.selectedDisplayText || m.msg?.title || '';
        if (m.mtype === 'interactiveResponseMessage') {
            try {
                const params = JSON.parse(m.msg.nativeFlowResponseMessage?.paramsJson || '{}');
                rawText = params.id || m.msg.body?.text || '';
            } catch { rawText = m.msg.body?.text || ''; }
        }

        m.text = String(rawText || '').trim();
        m.download = () => conn.downloadM(m.msg, m.mtype.replace('Message', ''));

        m.mentionedJid = (m.msg?.contextInfo?.mentionedJid || []).map(jid => conn.decodeJid(jid));

        if (m.msg?.contextInfo?.quotedMessage) {
            const botId = conn.user?.id ? conn.decodeJid(conn.user.id) : '';
            const qParticipant = conn.decodeJid(m.msg.contextInfo.participant || '');
            m.quoted = {
                key: {
                    remoteJid: m.chat,
                    fromMe: qParticipant === botId,
                    id: m.msg.contextInfo.stanzaId,
                    participant: qParticipant
                },
                message: m.msg.contextInfo.quotedMessage
            };
            m.quoted.mtype = getContentType(m.quoted.message);
            m.quoted.msg = m.quoted.message[m.quoted.mtype];
            if (m.quoted.msg) {
                let qText = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted.msg?.contentText || m.quoted.message?.conversation || '';
                m.quoted.text = String(qText || '').trim();
                m.quoted.sender = await getRealJid(conn, qParticipant, m);
                m.quoted.pushName = m.msg.contextInfo.pushName || 'Usuario';
                m.quoted.download = () => conn.downloadM(m.quoted.msg, m.quoted.mtype.replace('Message', ''));
            }
        } else {
            m.quoted = null;
        }
    }

    return m;
};