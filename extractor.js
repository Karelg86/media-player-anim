async function searchResults(keyword) {
    try {
        const response = await soraFetch(
            `https://www.animeworld.ac/search?keyword=${encodeURIComponent(keyword)}`
        );
        const html = await response.text();
        const results = [];
        const animeItemRegex = /<div[^>]*class="[^"]*film-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
        const nameRegex = /<a[^>]*class="[^"]*name[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/;
        const posterRegex = /<a[^>]*class="[^"]*poster[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/;
        let match;
        while ((match = animeItemRegex.exec(html)) !== null) {
            const block = match[1];
            const nameMatch = nameRegex.exec(block);
            const posterMatch = posterRegex.exec(block);
            if (nameMatch) {
                const rawHref = nameMatch[1];
                const href = rawHref.startsWith("http") ? rawHref : `https://www.animeworld.ac${rawHref}`;
                const title = nameMatch[2].replace(/<[^>]*>/g, "").trim();
                let image = "";
                if (posterMatch) {
                    image = posterMatch[2].startsWith("http") ? posterMatch[2] : `https://www.animeworld.ac${posterMatch[2]}`;
                }
                if (title) results.push({ title, image, href });
            }
        }
        // Fallback: approccio più semplice se regex sopra non trova nulla
        if (results.length === 0) {
            const simpleNameRegex = /<a[^>]*class="[^"]*name[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
            const simplePosterRegex = /<a[^>]*class="[^"]*poster[^"]*"[^>]*href="[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/g;
            const names = [];
            const posters = [];
            let nm, pm;
            while ((nm = simpleNameRegex.exec(html)) !== null) names.push(nm);
            while ((pm = simplePosterRegex.exec(html)) !== null) posters.push(pm);
            for (let i = 0; i < names.length; i++) {
                const href = names[i][1].startsWith("http") ? names[i][1] : `https://www.animeworld.ac${names[i][1]}`;
                const title = names[i][2].replace(/<[^>]*>/g, "").trim();
                const image = posters[i] ? (posters[i][1].startsWith("http") ? posters[i][1] : `https://www.animeworld.ac${posters[i][1]}`) : "";
                if (title) results.push({ title, image, href });
            }
        }
        console.log("Search results:", JSON.stringify(results));
        return JSON.stringify(results);
    } catch (error) {
        console.log("Search error:", error);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        const details = [];
        const descMatch = html.match(/<div[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        let description = descMatch ? descMatch[1].replace(/<[^>]*>/g, "").trim() : "";
        const aliasesMatch = html.match(/Titolo Originale:\s*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/);
        let aliases = aliasesMatch ? aliasesMatch[1].trim() : "";
        const airdateMatch = html.match(/Data di Uscita:<\/dt>\s*([^<]+)<\/dd>/);
        let airdate = airdateMatch ? airdateMatch[1].trim() : "";
        if (description && aliases && airdate) {
            details.push({ description, aliases, airdate });
        }
        console.log(JSON.stringify(details));
        return JSON.stringify(details);
    } catch (error) {
        console.log("Details error:", error);
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        const episodes = [];
        const baseUrl = "https://animeworld.ac";
        // Cerca il server attivo - lista episodi sotto il server selezionato
        const serverActiveRegex = /<ul[^>]*class="[^"]*server[^"]*active[^"]*"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/;
        const serverActiveMatch = html.match(serverActiveRegex);
        if (!serverActiveMatch) {
            console.log("Episodes: server active block not found");
            return JSON.stringify(episodes);
        }
        const serverActiveContent = serverActiveMatch[1];
        const episodeRegex = /\s*<a[^>]*?href="([^"]+)"[^>]*?>([^<]+)<\/a>/g;
        let match;
        while ((match = episodeRegex.exec(serverActiveContent)) !== null) {
            let href = match[1];
            const number = parseInt(match[2], 10);
            if (!href.startsWith("https")) {
                href = href.startsWith("/") ? baseUrl + href : baseUrl + "/" + href;
            }
            episodes.push({ href, number });
        }
        console.log(JSON.stringify(episodes));
        return JSON.stringify(episodes);
    } catch (error) {
        console.log("Episodes error:", error);
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        const html = await response.text();
        // Link diretto MP4 via alternativeDownloadLink
        const idRegex = /<a[^>]+href="([^"]+)"[^>]*id="alternativeDownloadLink"/;
        const match = html.match(idRegex);
        return match ? match[1] : null;
    } catch (error) {
        console.log("Stream URL error:", error);
        return null;
    }
}

async function soraFetch(url, options = { headers: {}, method: "GET", body: null, encoding: "utf-8" }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? "GET", options.body ?? null, true, options.encoding ?? "utf-8");
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}
