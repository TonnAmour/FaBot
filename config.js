
import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import fs from 'fs'
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import axios from 'axios'
import moment from 'moment-timezone'
import path from 'path'
import { jidNormalizedUser } from '@whiskeysockets/baileys'

global.owner = [['56939026360']]

global.dev1 = '56939026360'

global.botNames = [
  '❖ 𝑭𝒂𝑩𝒐𝒕 - 𝑩𝑶𝑻 𝑴𝑫 ❖'
]

global.botImages = [
  'https://cdn.dix.lat/me/5cb5b0d9-bb69-489e-9597-b3e550b3c584.jpg'
]

const conf = {
  utils: { cheerio, fs, fetch, axios, moment },
  sessions: { main: 'sessions' },
  social: { channel: '120363406846602793@newsletter' }
}

var more = String.fromCharCode(8206)
Object.assign(global, conf.utils)

global.sessions = conf.sessions.main
global.ch = conf.social.channel
global.rmr = more.repeat(850)
global.developer = '𝚈𝚒𝟹𝚗𝚎𝚜'

global.name = (conn) => {
    try {
        return conn?.settings?.botName || global.botNames?.[0] || 'FaBot';
    } catch { return 'FaBot'; }
};

global.ads = {
    mensaje: 'Sigue nuestro canal: whatsapp.com/channel/0029VbC195k9xVJWUtGQ2m29'
}

global.v = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).version

Object.defineProperty(global, 'channelInfo', {
    get: function() {
        try {
            const conn = global.conn;
            return {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: global.ch,
                    newsletterName: global.name(conn)
                }
            };
        } catch (e) {
            return { forwardingScore: 1, isForwarded: true };
        }
    },
    configurable: true,
    enumerable: true
});

global.bufferCache = global.bufferCache || new Map();

global.getBuffer = async (url, options = {}) => {
  try {
    const res = await axios({
      method: "get",
      url,
      headers: { 
        'DNT': 1, 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache' 
      },
      ...options,
      responseType: 'arraybuffer'
    })

    if (res.status === 200 && res.data) {
      return res.data;
    }
    return null;
  } catch (e) { 
    return null; 
  }
}

const d = new Date(new Date().getTime() + 3600000)
global.fecha = d.toLocaleDateString('es', { day: 'numeric', month: 'numeric', year: 'numeric' })
global.tiempo = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })

const hour = new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Tegucigalpa'
}).format(new Date());

global.saludo = hour >= 6 && hour < 12 ? 'Lɪɴᴅᴀ Mᴀɴ̃ᴀɴᴀ 🌅' : 
                 hour >= 12 && hour < 19 ? 'Lɪɴᴅᴀ Tᴀʀᴅᴇ 🌆' : 
                 'Lɪɴᴅᴀ Nᴏᴄʜᴇ 🌃';

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
