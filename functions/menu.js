import axios from 'axios';

const menu = {
    name: 'menu',
    alias: ['help', 'comandos', 'panel'],
    category: 'info',
    run: async function (m, { conn, usedPrefix }) {
        try {
            if (!global.plugins) return m.reply('[ERROR] No se encontraron comandos cargados.');

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
                    categories[category].push(`  ${usedPrefix}${cmd}`);
                });
            });

            let menuText = `*${name(conn)}*\n`;
            menuText += `Prefijo: ${usedPrefix}\n\n`;

            const orderedCategories = Object.keys(categories).sort();

            orderedCategories.forEach((cat) => {
                if (categories[cat].length === 0) return;

                const uniqueCommands = [...new Set(categories[cat])].sort();

                menuText += `[ ${cat} ]\n`;
                uniqueCommands.forEach(cmd => {
                    menuText += `${cmd}\n`;
                });
                menuText += '\n';
            });

            menuText += `Desarrollado por ton.`;

            return m.reply(menuText);
        } catch (e) {
            console.error(e);
            return m.reply('[ERROR] No se pudo generar el menu.');
        }
    }
};

export default menu;
