import { jidNormalizedUser } from '@whiskeysockets/baileys';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const antiLink2Plugin = {
    name: 'antilink2_xxx_only',
    async before(m, { conn, isAdmin, isBotAdmin, isOwner, chat }) {
        if (!m.isGroup || !chat?.antiLink2 || isAdmin || m.fromMe) return false;

        const currentMessageText = m.msg?.text || m.msg?.caption || m.text || '';

        const urlExtractRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?& rescue=\/\/]*)|(?:\b[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|net|org|xyz|top|site|online|club|vip|pro|cc|tv|me|info|biz|xxx|adult|porn|sex|hentai|cam|tube|tech|link|click|work|live)\b/gi;

        const matches = currentMessageText.match(urlExtractRegex);

        let isForbiddenLink = false;

        if (matches) {
            const adultKeywords = /\b(xvideos|pornhub|xnxx|redtube|youporn|hentai|onlyfans|brazzers|xhamster|cam4|chaturbate|stripchat|bongacams|spankbang|porntrex|motherless|xmovies8|tubegalore|heavy-r|rule34|sex|porn|xxx|adult|cam|tube|bestreams|hqporner|tnaflix|xhamsterlive|proserx|pervert|erito|xnxx2|fuck|vixen|blacked|tushy|jav|clips)\b/i;

            for (const link of matches) {
                let cleanLink = link.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
                const host = cleanLink.split(/[/?#]/)[0];

                const hostParts = host.split('.');
                if (hostParts.length >= 2) {
                    const tld = hostParts.pop();
                    const domainName = hostParts.pop();

                    if (tld === 'xxx' || tld === 'adult' || tld === 'porn' || tld === 'sex') {
                        isForbiddenLink = true;
                        break;
                    }

                    if (domainName && adultKeywords.test(domainName)) {
                        const safeDomains = /^(youtube|youtu|tiktok|instagram|facebook|twitch|twitter|x|github|google|microsoft|wikipedia|pinterest|linkedin|spotify|netflix|disney|twitch|amazon|imgur|reddit)$/i;
                        if (!safeDomains.test(domainName)) {
                            isForbiddenLink = true;
                            break;
                        }
                    }
                }
            }
        }

        if (isForbiddenLink) {
            if (isBotAdmin) {
                await conn.sendMessage(m.chat, { delete: m.key }).catch(() => null);
                await delay(200);
                await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => null);

                await conn.sendMessage(m.chat, { 
                    text: `> *CONTENIDO PROHIBIDO DETECTADO* \n\n> Se ha expulsado a *@${m.sender.split('@')[0]}* por enviar enlaces de contenido explícito o sitios no permitidos.`,
                    contextInfo: { mentionedJid: [m.sender] }
                }).catch(() => null);
            }
            return true;
        }
        return false;
    }
};

export default antiLink2Plugin;