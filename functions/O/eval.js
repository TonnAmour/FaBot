import { format } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);

const evalCommand = {
    name: 'eval',
    alias: ['>', '=>', 'await'],
    category: 'owner',
    async before(m, context) {
        const { conn, isROwner, args, settings } = context;

        if (!isROwner || !m.text) return false;

        const rawText = m.text.trim();
        let trigger = '';
        let cleanText = '';

        if (rawText.startsWith('.=>')) {
            trigger = '=>';
            cleanText = rawText.slice(3).trim();
        } else if (rawText.startsWith('=>')) {
            trigger = '=>';
            cleanText = rawText.slice(2).trim();
        } else if (rawText.startsWith('.>')) {
            trigger = '>';
            cleanText = rawText.slice(2).trim();
        } else if (rawText.startsWith('>')) {
            trigger = '>';
            cleanText = rawText.slice(1).trim();
        } else if (rawText.startsWith('await ')) {
            trigger = 'await';
            cleanText = rawText.slice(6).trim();
        } else {
            return false;
        }

        if (!cleanText) return false;

        if (trigger === '=>' && !cleanText.startsWith('return ')) {
            cleanText = 'return ' + cleanText;
        }

        let groupMetadata = null;
        if (m.isGroup) {
            try {
                groupMetadata = await conn.groupMetadata(m.chat);
            } catch {
                groupMetadata = null;
            }
        }

        let output;
        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const executor = new AsyncFunction(
                'conn', 'm', 'text', 'args', 'groupMetadata', 'settings', 'require', 'process', 'format',
                cleanText
            );

            output = await executor.call(
                conn, 
                conn, m, cleanText, args, groupMetadata, settings, require, process, format
            );
        } catch (err) {
            output = err;
        } finally {
            if (output !== undefined) {
                await conn.sendMessage(m.chat, { text: format(output) }, { quoted: m }).catch(() => null);
            }
        }
        return true;
    }
};

export default evalCommand;