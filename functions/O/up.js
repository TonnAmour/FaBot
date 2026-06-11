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
            const output = await runCmd(`git pull ${args[0] || ''}`);

            if (/Already up[ -]to[ -]date/i.test(output)) {
                return conn.sendMessage(m.chat, { text: 'El sistema ya esta actualizado.' }, { quoted: m });
            }

            const updateMsg = `ACTUALIZACION COMPLETA\n\n${output.trim()}\n\nSincronizando nuevos comandos...`;
            await conn.sendMessage(m.chat, { text: updateMsg }, { quoted: m });

            if (global.reloadHandler) {
                await global.reloadHandler(true);
            }

            return m.reply("Comandos recargados con exito. Los cambios ya estan vivos.");

        } catch (error) {
            let status = '';
            try { status = await runCmd('git status --porcelain'); } catch { status = 'Error de repo.'; }

            const conflictMsg = status.trim() 
                ? `Conflictos:\n${status.trim()}` 
                : error.toString();

            await conn.sendMessage(m.chat, { text: `ERROR:\n\n${conflictMsg}` }, { quoted: m });
        }
    }
};

export default updateCommand;