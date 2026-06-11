import { Worker } from 'worker_threads';
import './config.js';
import { platform } from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import path, { join, basename } from 'path';
import fs, { existsSync, mkdirSync, watch, promises as fsP } from 'fs';
import chalk from 'chalk';
import pino from 'pino';
import yargs from 'yargs';
import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import readline from 'readline';
import cfonts from 'cfonts';
import { smsg } from './lib/serializer.js';
import { EventEmitter } from 'events';
import { observeEvents } from './lib/event/detect.js';

const maskLogs = (chunk, encoding, callback, originalWrite) => {
    const msg = chunk?.toString?.() || '';
    if (
        msg.includes('Closing session') || 
        msg.includes('Removing old closed session') || 
        msg.includes('Bad MAC') || 
        msg.includes('Failed to decrypt')
    ) {
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    }
    return originalWrite(chunk, encoding, callback);
};

const _stdout = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => maskLogs(chunk, encoding, callback, _stdout);

const _stderr = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, callback) => maskLogs(chunk, encoding, callback, _stderr);

process.removeAllListeners('warning');

global.groupCache = new Map(); 
EventEmitter.defaultMaxListeners = 0;
global.conns = new Map();

const sId = (jid) => {
    if (!jid) return jid;
    return jid.includes('@') ? jid.split('@')[0].split(':')[0] + '@s.whatsapp.net' : jid.split(':')[0] + '@s.whatsapp.net';
};

global.userCache = new Map();
global.dirtyUsers = new Set(); 

const dbPath = path.join(process.cwd(), 'db.json');
global.db = {
    users: {},
    chats: {},
    warns: {},
    botRestrictions: {}
};

if (existsSync(dbPath)) {
    try {
        const rawData = fs.readFileSync(dbPath, 'utf-8');
        const parsed = JSON.parse(rawData);
        global.db = { ...global.db, ...parsed };

        if (global.db.users) {
            for (const [jid, data] of Object.entries(global.db.users)) {
                global.userCache.set(jid, data);
            }
        }
    } catch (e) {
        console.error(chalk.red('[ERROR] BASE DE DATOS LOCAL JSON, RECREANDO...'));
    }
} else {
    fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2), 'utf-8');
}

const logDB = (type, status) => {
    console.log(chalk.cyan('[DATABASE] ') + chalk.blueBright(type) + ' | ' + (status === 'CONNECTED' ? chalk.greenBright(status) : chalk.redBright(status)));
};

console.clear();
cfonts.say('FABOT', { font: 'slick', align: 'center', colors: ['cyan', 'white'], letterSpacing: 2 });

logDB('LOCAL_JSON', 'CONNECTED');

global.updateUser = (jid, data) => {
    const currentData = global.userCache.get(jid) || {};
    const updatedData = { ...currentData, ...data, id: jid };
    global.userCache.set(jid, updatedData);
    global.db.users[jid] = updatedData;
    global.dirtyUsers.add(jid);
    return updatedData;
};

const flushData = () => {
    try {
        if (global.dirtyUsers.size > 0) {
            global.dirtyUsers.clear();
        }
        fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2), 'utf-8');
    } catch (e) {}
    process.exit(0);
};

process.on('SIGINT', flushData);
process.on('SIGTERM', flushData);

process.on('uncaughtException', (err) => {
    console.error(err); 
});

process.on('unhandledRejection', (reason) => {
    console.error(reason instanceof Error ? reason : new Error(String(reason)));
});

const originalLog = console.log;
console.log = (...args) => originalLog.apply(console, [chalk.cyan('[BOT]'), ...args]);
const originalError = console.error;
console.error = (...args) => {
    args.forEach(arg => {
        if (arg instanceof Error) {
            originalError.apply(console, [chalk.red('[ERROR]'), arg.stack]);
        } else {
            originalError.apply(console, [chalk.red('[ERROR]'), arg]);
        }
    });
};

global.restrictionsCache = new Map();

async function loadBotRestrictions(botId) {
    if (global.restrictionsCache.has(botId)) return global.restrictionsCache.get(botId);
    try {
        const settings = global.db.botRestrictions[botId];
        if (settings) {
            const data = {
                restrictedMode: settings.restrictedMode || false,
                hiddenCommands: new Set(settings.hiddenCommands || [])
            };
            global.restrictionsCache.set(botId, data);
            return data;
        }
    } catch {}
    const fallback = { restrictedMode: false, hiddenCommands: new Set() };
    global.restrictionsCache.set(botId, fallback);
    return fallback;
}

global.updateBotRestrictions = async (botId, update) => {
    try {
        const current = global.db.botRestrictions[botId] || { botId, restrictedMode: false, hiddenCommands: [] };

        let updatedHiddenCommands = current.hiddenCommands;
        if (update.hiddenCommands) {
            updatedHiddenCommands = Array.isArray(update.hiddenCommands) 
                ? update.hiddenCommands 
                : Array.from(update.hiddenCommands);
        }

        global.db.botRestrictions[botId] = {
            ...current,
            ...update,
            hiddenCommands: updatedHiddenCommands,
            botId
        };

        global.restrictionsCache.set(botId, {
            restrictedMode: global.db.botRestrictions[botId].restrictedMode,
            hiddenCommands: new Set(global.db.botRestrictions[botId].hiddenCommands)
        });
        return true;
    } catch {}
    return false;
};

global.isCommandAllowed = (sock, command) => {
    if (!sock?.user) return true;
    const botId = sId(sock.user.id);
    if (!global.restrictionsCache.has(botId)) {
        loadBotRestrictions(botId);
        return true;
    }
    const cache = global.restrictionsCache.get(botId);
    if (cache && cache.restrictedMode) {
        if (cache.hiddenCommands.has(command)) {
            return false;
        }
    }
    return true;
};

setInterval(async () => {
    try {
        global.dirtyUsers.clear();
        await fsP.writeFile(dbPath, JSON.stringify(global.db, null, 2), 'utf-8');
    } catch (e) {}
}, 15000);

const { 
    makeWASocket, DisconnectReason, fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore, Browsers, useMultiFileAuthState, generateWAMessageFromContent, proto
} = await import('@whiskeysockets/baileys');

if (!existsSync('./tmp')) mkdirSync('./tmp');
if (!existsSync('./sessions')) mkdirSync('./sessions');

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
};

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[#!./]');

const sessionFolder = './sessions/main-auth';
const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
const { version } = await fetchLatestBaileysVersion();
const msgRetryCounterCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const connectionOptions = {
  version,
  logger: pino({ level: 'silent' }),
  printQRInTerminal: false,
  browser: Browsers.macOS("Chrome"),
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })), 
  },
  markOnlineOnConnect: true,
  syncFullHistory: false,
  msgRetryCounterCache,
  connectTimeoutMs: 60000,
  defaultQueryTimeoutMs: 60000, 
  keepAliveIntervalMs: 15000,
  emitOwnEvents: true,
  getMessage: async (key) => { return undefined; },
  patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(message.interactiveMessage || message.templateMessage || message.listMessage);
      if (requiresPatch) {
          message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, ...message } } };
      }
      return message;
  }
};

global.conn = makeWASocket(connectionOptions);
global.conn.isMain = true;
global.conns.set('main', global.conn);

global._reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000;

function getReconnectDelay() {
    const delay = Math.min(10000 * (global._reconnectAttempts + 1), MAX_RECONNECT_DELAY);
    global._reconnectAttempts++;
    return delay;
}

if (!state.creds.registered) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (t) => new Promise((r) => rl.question(t, r));
    let phoneNumber = await question(chalk.cyan('[BOT] ') + `Número: `);
    let addNumber = phoneNumber.replace(/\D/g, '');
    rl.close();
    setTimeout(async () => {
        try {
            let codeBot = await conn.requestPairingCode(addNumber);
            console.log(chalk.cyan('[BOT] ') + chalk.bgBlack.white.bold(` CODIGO: ${codeBot?.match(/.{1,4}/g)?.join("-") || codeBot} `));
        } catch (e) { console.error(e); }
    }, 3000);
}

let messageHandlerMain;
const loadHandlers = async () => {
    try {
        const PathMain = path.join(process.cwd(), 'lib/message.js');
        const moduleMain = await import(`file://${PathMain}?update=${Date.now()}`);
        messageHandlerMain = moduleMain.message || moduleMain.default?.message || moduleMain.default;
    } catch (e) { console.error(e); }
};

await loadHandlers();
watch(path.join(process.cwd(), 'lib/message.js'), loadHandlers);

global.reload = async function(restatConn) {
  if (restatConn) {
    try { global.conn.ws.close(); } catch {}
    const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(sessionFolder);
    global.conn = makeWASocket({
        ...connectionOptions,
        auth: {
            creds: newState.creds,
            keys: makeCacheableSignalKeyStore(newState.keys, pino({ level: 'silent' })),
        }
    });
    global.conn.ev.on('creds.update', newSaveCreds);
    global.conns.set('main', global.conn);
  }

  if (global.conn) {
      global.conn.sendButtonMessage = async (jid, buttons = [], text = '', footer = '', quoted = null, options = {}) => {
          const formattedButtons = buttons.map((btn, index) => {
              return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowMessageButton.create({
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                      display_text: btn.text || '',
                      id: btn.id || `button_${index}`
                  })
              });
          });

          const interactiveMessage = proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({ text }),
              footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
              header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                  buttons: formattedButtons,
                  contentFormatVersion: 1
              }),
              contextInfo: options.contextInfo || {}
          });

          const messageContent = generateWAMessageFromContent(jid, {
              viewOnceMessage: {
                  message: {
                      interactiveMessage
                  }
              }
          }, { quoted });

          return global.conn.relayMessage(jid, messageContent.message, { messageId: messageContent.key.id });
      };
  }

  global.conn.ev.removeAllListeners('messages.upsert');
  observeEvents(global.conn);
  global.conn.ev.on('messages.upsert', async (chatUpdate) => {
    if (!chatUpdate?.messages || !Array.isArray(chatUpdate.messages) || chatUpdate.messages.length === 0) return;

    const msg = chatUpdate.messages[0];
    try {
        const m = await smsg(global.conn, msg);
        if (!m) return;
        
        if (messageHandlerMain) {
            await messageHandlerMain.call(global.conn, m, chatUpdate);
        }
    } catch (e) {
        console.error(e); 
    }
  });

  global.conn.ev.removeAllListeners('connection.update');
  global.conn.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode || 0;
        if (reason === DisconnectReason.loggedOut || reason === 403) {
            console.error(chalk.red(`[BOT] STATUS: SESION CAIDA (codigo ${reason}) — RECONECTANDO SIN BORRAR SESION`));
        } else {
            console.error(chalk.yellow(`[BOT] STATUS: DESCONECTADO (codigo ${reason}) — RECONECTANDO...`));
        }
        const delay = getReconnectDelay();
        console.log(chalk.cyan(`[BOT] Reintento #${global._reconnectAttempts} en ${delay / 1000}s...`));
        setTimeout(() => global.reload(true), delay);
    }

    if (connection === 'open') {
        global._reconnectAttempts = 0;
        global.botNumber = sId(global.conn.user.id);
        console.log(chalk.cyan('[BOT] ') + chalk.greenBright.bold(`STATUS: ONLINE`));

        const groups = await global.conn.groupFetchAllParticipating().catch(() => ({}));
        for (const id in groups) {
            global.groupCache.set(id, groups[id]);
        }

        const updateStatus = async () => {
            try {
                const time = new Date().toLocaleString('es-HN', { hour12: true });
                await global.conn.query({
                    tag: 'iq',
                    attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                    content: [{ tag: 'status', attrs: {},                     content: Buffer.from(`FABOT | ${time}`, 'utf-8') }]
                });
            } catch {}
        };
        updateStatus();
        if (global.keepAlive) clearInterval(global.keepAlive);
        global.keepAlive = setInterval(updateStatus, 600000);
    }
  });

  global.conn.ev.on('creds.update', saveCreds);

  global.conn.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
        const metadata = await global.conn.groupMetadata(update.id).catch(() => null);
        if (metadata) {
            global.groupCache.set(update.id, metadata);
        }
    }
  });
};

await global.reload();

global.plugins = new Map();
global.aliases = new Map();

async function readRecursive(folder) {
  const files = await fsP.readdir(folder);
  for (let filename of files) {
    const file = join(folder, filename);
    const st = await fsP.stat(file);
    if (st.isDirectory()) await readRecursive(file);
    else if (/\.js$/.test(filename)) {
      try {
        const module = await import(`file://${file}?update=${Date.now()}`);
        const plugin = module.default || module;
        const name = plugin.name || basename(filename, '.js');
        global.plugins.set(name, { plugin, path: file });
        if (plugin.alias) (Array.isArray(plugin.alias) ? plugin.alias : [plugin.alias]).forEach(a => global.aliases.set(a, name));
      } catch (e) { console.error(e); }
    }
  }
}

global.reloadHandler = async function (check) {
    global.plugins.clear();
    global.aliases.clear();
    await readRecursive(join(process.cwd(), './functions'));
    if (check) return true;
};

await readRecursive(join(process.cwd(), './functions'));

global.subHandler = async (...args) => {
    if (messageHandlerMain) return await messageHandlerMain.call(...args);
};
