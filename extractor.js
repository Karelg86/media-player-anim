async function searchResults(keyword) {
    const response = await soraFetch(
        `https://www.animeworld.ac/search?keyword=${encodeURIComponent(keyword)}`
    );
    const html = await response.text();
    const results = [];
    // Estrai i risultati dalla griglia: ogni card ha a.name (link+titolo) e a.poster img (immagine)
    const cardRegex = /<div[^>]*class="[^"]*item[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
    const nameRegex = /<a[^>]*class="[^"]*name[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/;
    const imgRegex = /<a[^>]*class="[^"]*poster[^"]*"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/;
    // Approccio alternativo: cerca tutti i link con classe "name"
    const allNameLinks = html.match(/<a[^>]*class="[^"]*name[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g) || [];
    const allPosterImgs = html.match(/<a[^>]*class="[^"]*poster[^"]*"[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/g) || [];
    for (let i = 0; i < allNameLinks.length; i++) {
        const nameMatch = allNameLinks[i].match(/href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
        const imgMatch = allPosterImgs[i] ? allPosterImgs[i].match(/src="([^"]*)"/) : null;
        if (nameMatch) {
            const href = nameMatch[1].startsWith('http') ? nameMatch[1] : `https://www.animeworld.ac${nameMatch[1]}`;
            const title = nameMatch[2].replace(/<[^>]*>/g, '').trim();
            const image = imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : `https://www.animeworld.ac${imgMatch[1]}`) : '';
            if (title && href) {
                results.push({ title, image, href });
            }
        }
    }
    return JSON.stringify(results);
}

async function extractDetails(url) {
    // Normalizza l'URL alla pagina base dell'anime (senza episodio)
    const baseUrl = url.replace(/\/[A-Za-z0-9]+$/, '');
    const response = await soraFetch(baseUrl);
    const html = await response.text();
    // Descrizione
    const descMatch = html.match(/<div[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
    // Titolo originale (spesso in un sottotitolo)
    const origMatch = html.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const aliases = origMatch ? origMatch[1].replace(/<[^>]*>/g, '').trim() : 'N/A';
    // Data di uscita
    const yearMatch = html.match(/(\d{4})/);
    const airdate = yearMatch ? yearMatch[1] : 'N/A';
    return JSON.stringify([{ description, aliases, airdate }]);
}

async function extractEpisodes(url) {
    try {
        // Normalizza l'URL alla pagina base dell'anime
        const baseUrl = url.replace(/\/[A-Za-z0-9]+$/, '');
        const response = await soraFetch(baseUrl);
        const html = await response.text();
        const episodes = [];
        // Tutti gli episodi sono già nel DOM sotto .episodes - estrai tutti i link <a>
        const episodesSection = html.match(/<div[^>]*class="[^"]*episodes[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
        const source = episodesSection ? episodesSection[1] : html;
        const epLinks = source.match(/<a[^>]*href="(\/play\/[^"]+)"[^>]*>/g) || [];
        const seen = new Set();
        let number = 1;
        for (const link of epLinks) {
            const hrefMatch = link.match(/href="(\/play\/[^"]+)"/);
            if (hrefMatch) {
                const href = `https://www.animeworld.ac${hrefMatch[1]}`;
                if (!seen.has(href)) {
                    seen.add(href);
                    episodes.push({ href, number: number++ });
                }
            }
        }
        // Fallback: se non trovati episodi usa l'URL base come ep 1
        if (episodes.length === 0) {
            episodes.push({ href: baseUrl, number: 1 });
        }
        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        // Cerca la configurazione JW Player: sources con file m3u8
        const jwMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*['"]([^'"]+)['"]/);
        if (jwMatch) return jwMatch[1];
        // Fallback: cerca direttamente un link m3u8
        const m3u8Match = html.match(/(https?:\/\/[^'"<>\s]+\.m3u8[^'"<>\s]*)/);
        if (m3u8Match) return m3u8Match[1];
        // Cerca un iframe embed
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/);
        if (iframeMatch) {
            const embedUrl = iframeMatch[1].replace(/&amp;/g, '&');
            const response2 = await soraFetch(embedUrl);
            const html2 = await response2.text();
            const m3u8Match2 = html2.match(/(https?:\/\/[^'"<>\s]+\.m3u8[^'"<>\s]*)/);
            if (m3u8Match2) return m3u8Match2[1];
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}
