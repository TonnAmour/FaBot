import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runCmd = (cmd) => new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout);
    });
});

const updateCommand = {
    name: 'update',
    alias: ['actualizar', 'up', 'sync'],
    category: 'owner',
    rowner: true,
    run: async (m, { conn, args }) => {
        try {
            await m.react("🔄");
            const output = await runCmd(`git pull ${args[0] || ''}`);

            if (/Already up[ -]to[ -]date/i.test(output)) {
                await m.react("✅");
                return conn.sendMessage(m.chat, { text: '『 ✅ 』 El sistema ya está actualizado.' }, { quoted: m });
            }

            const updateMsg = `『 📦 ACTUALIZACIÓN COMPLETA 』\n\n\`\`\`${output.trim()}\`\`\`\n\n◈ *Sincronizando nuevos comandos...*`;
            await conn.sendMessage(m.chat, { text: updateMsg }, { quoted: m });

            const pluginDir = path.join(__dirname, '../plugins');

            if (global.reloadHandler) {
                await global.reloadHandler(true);
            }

            await m.react("⚙️");
            return m.reply("『 ✨ 』 Comandos recargados con éxito. Los cambios ya están vivos.");

        } catch (error) {
            let status = '';
            try { status = await runCmd('git status --porcelain'); } catch { status = 'Error de repo.'; }

            const conflictMsg = status.trim() 
                ? `⚠️ Conflictos:\n\`\`\`${status.trim()}\`\`\`` 
                : error.toString();

            await conn.sendMessage(m.chat, { text: `💀 *ERROR:* \n\n${conflictMsg}` }, { quoted: m });
            await m.react("❌");
        }
    }
};

export default updateCommand;