import fetch from 'node-fetch'
import { getRealJid } from '../../lib/identifier.js' 

const groupConfig = {
    name: 'config_group',
    alias: ['setwelcome', 'delwelcome', 'renombrar', 'setnombre', 'setname', 'desc', 'setdesc', 'setfoto', 'setpp', 'elimina', 'kick', 'ban', 'echar', 'sacar', 'tagall', 'todos', 'all', 'anuncio'],
    category: 'group',
    admin: true,
    group: true,
    botAdmin: true,
    run: async function (m, { conn, text, command, participants, chat }) {

        if (command === 'setwelcome') {
            if (!text) return m.reply('Ingresa el texto.\nVariables:\n@us = Usuario\n@g = Nombre del grupo\n@t = Total miembros\n@d = Descripcion\n@n = Nombre en mayusculas\n\nEj: #setwelcome Hola @us\nBienvenido a @g')

            let welcomeMessage = text;
            if (text.toLowerCase() === '@rules') {
                const groupMetadata = await conn.groupMetadata(m.chat).catch(() => ({}))
                welcomeMessage = groupMetadata.desc || 'No hay reglas definidas en este grupo.'
            }

            if (chat) {
                chat.customWelcome = welcomeMessage;
            } else if (global.db.chats[m.chat]) {
                global.db.chats[m.chat].customWelcome = welcomeMessage;
            }

            return m.reply(`CONFIG: WELCOME SET`)
        }

        if (command === 'delwelcome') {
            if (chat) {
                chat.customWelcome = '';
            } else if (global.db.chats[m.chat]) {
                global.db.chats[m.chat].customWelcome = '';
            }
            return m.reply(`CONFIG: WELCOME RESET`)
        }

        if (/renombrar|setnombre|setname/i.test(command)) {
            if (!text) return m.reply('Ingresa el nombre.')
            await conn.groupUpdateSubject(m.chat, text)
            return m.reply(`Nombre actualizado: ${text}`)
        }

        if (/desc|setdesc/i.test(command)) {
            let newDesc = m.quoted ? m.quoted.text : text
            if (!newDesc) return m.reply('Ingresa la descripcion.')
            await conn.groupUpdateDescription(m.chat, newDesc)
            return m.reply(`Descripcion actualizada.`)
        }

        if (/setfoto|setpp/i.test(command)) {
            let q = m.quoted ? m.quoted : m
            let mime = (q.msg || q).mimetype || ''
            if (!/image/.test(mime)) return m.reply('Responde a una imagen.')
            let media = await q.download()
            await conn.updateProfilePicture(m.chat, media)
            return m.reply(`Foto actualizada.`)
        }

        if (/elimina|kick|ban|echar|sacar/i.test(command)) {
            let users = m.mentionedJid.concat(m.quoted ? [m.quoted.sender] : []).filter(u => u !== conn.user.jid)
            if (users.length === 0) return m.reply('Etiqueta a alguien.')
            await conn.groupParticipantsUpdate(m.chat, users, 'remove')
        }

        if (/tagall|todos|all|anuncio/i.test(command)) {
            let txt = `ANUNCIO GRUPAL\nMensaje: ${text || 'sin motivo'}\n\n`

            const realParticipants = await Promise.all(
                participants.map(async (p) => {
                    return await getRealJid(conn, p.id, m);
                })
            );

            for (let jid of realParticipants) {
                txt += `@${jid.split('@')[0]}\n`
            }

            return conn.sendMessage(m.chat, { 
                text: txt, 
                contextInfo: { 
                    mentionedJid: realParticipants,
                    groupMentions: [],
                    remoteJidAlt: m.chat
                } 
            }, { quoted: m })
        }

    }
}

export default groupConfig
