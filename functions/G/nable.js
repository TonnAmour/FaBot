const enable = {
    name: 'enable',
    alias: ['welcome', 'bv', 'antilink', 'antilink2'], 
    category: 'config',
    admin: true,
    group: true,
    run: async function (m, { conn, command, chat, usedPrefix }) {

        const featureMap = {
            'welcome': 'welcome',
            'bv': 'welcome',
            'antilink': 'antiLink',
            'antilink2': 'antiLink2'
        };

        const type = command.toLowerCase();

        if (type === 'enable' || !featureMap[type]) {
            let menu = `CONFIGURACION DEL GRUPO\n\n`;
            const options = [
                { name: 'Bienvenida', key: 'welcome' },
                { name: 'Anti-Links', key: 'antiLink' },
                { name: 'Anti-Links2', key: 'antiLink2' }
            ];

            options.forEach(opt => {
                const status = chat[opt.key] ? 'ACTIVADO' : 'DESACTIVADO';
                menu += `${opt.name}: ${status}\n`;
            });
            return m.reply(menu.trim());
        }

        const dbKey = featureMap[type];
        const newValue = !chat[dbKey];

        chat[dbKey] = newValue;
        
        if (global.db?.chats?.[m.chat]) {
            global.db.chats[m.chat][dbKey] = newValue;
        }

        let statusText = newValue ? 'ACTIVADO' : 'DESACTIVADO';
        return m.reply(`La funcion ${type.toUpperCase()} se ha ${statusText}.`);
    }
}
export default enable;
