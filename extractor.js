/**
 * Shirox / Sora / Luna Module Extractor - AnimeWorld IT
 * Versione: 1.0.6
 *
 * Novità v1.0.6:
 * - Dominio in un solo punto (CONFIG.BASE)
 * - decodeEntities su titoli, trama e titolo originale (es. &#x27; -> ')
 * - Episodi letti indipendentemente dall'ordine degli attributi HTML
 * - Pulizia: il data-id coincide con l'ultimo segmento dell'URL episodio, niente più fragment #data-id
 */

const CONFIG = {
  BASE: "https://www.animeworld.ac",
};

// --- UTILITY ---
function decodeEntities(str = "") {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Rimuove i tag HTML e normalizza gli spazi (per la trama)
function stripTags(str = "") {
  return str.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").trim();
}

function absUrl(href) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  return href.startsWith("/") ? CONFIG.BASE + href : CONFIG.BASE + "/" + href;
}

// ==========================================
// 1. RICERCA
// ==========================================
async function searchResults(keyword) {
  const results = [];

  try {
    const response = await soraFetch(`${CONFIG.BASE}/search?keyword=${encodeURIComponent(keyword)}`);
    if (!response) return JSON.stringify([]);
    const html = await response.text();

    const filmListMatch = html.match(/<div class="film-list">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    if (!filmListMatch) {
      console.log("Search: film-list not found in HTML");
      return JSON.stringify(results);
    }

    const filmListContent = filmListMatch[1];
    const itemRegex = /<div class="item">([\s\S]*?)<\/div>\s*<\/div>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(filmListContent)) !== null) {
      const itemHtml = itemMatch[0];

      const imgMatch = itemHtml.match(/src="([^"]+)"/);
      const titleMatch = itemHtml.match(/class="name">([^<]+)</);
      const hrefMatch = itemHtml.match(/href="([^"]+)"/);

      const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";
      const href = hrefMatch ? absUrl(hrefMatch[1]) : "";

      if (title && href) {
        results.push({
          title: title,
          image: imgMatch ? absUrl(imgMatch[1]) : "",
          href: href,
        });
      }
    }

    return JSON.stringify(results);
  } catch (error) {
    console.log("Search error:", error);
    return JSON.stringify([]);
  }
}

// ==========================================
// 2. DETTAGLI
// ==========================================
async function extractDetails(url) {
  try {
    const response = await soraFetch(url);
    if (!response) return JSON.stringify([]);
    const html = await response.text();

    const descriptionMatch = html.match(/<div class="desc">([\s\S]*?)<\/div>/);
    const aliasesMatch = html.match(/<h2 class="title" data-jtitle="([^"]+)">/);
    const airdateMatch = html.match(/<dt>Data di Uscita:<\/dt>\s*<dd>([^<]+)<\/dd>/);

    return JSON.stringify([{
      description: descriptionMatch ? decodeEntities(stripTags(descriptionMatch[1])) : "",
      aliases: aliasesMatch ? decodeEntities(aliasesMatch[1]) : "",
      airdate: airdateMatch ? airdateMatch[1].trim() : "",
    }]);
  } catch (error) {
    console.log("Details error:", error);
    return JSON.stringify([]);
  }
}

// ==========================================
// 3. EPISODI
// ==========================================
async function extractEpisodes(url) {
  try {
    const response = await soraFetch(url);
    if (!response) return JSON.stringify([]);
    const html = await response.text();

    const episodes = [];

    const serverActiveMatch = html.match(/<div class="server active"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/);
    if (!serverActiveMatch) {
      console.log("Episodes: server active block not found");
      return JSON.stringify(episodes);
    }

    // Ogni episodio: <li class="episode"><a data-id="..." data-num="1" ... href="/play/...">1</a>
    // Gli attributi vengono letti singolarmente, quindi l'ordine nell'HTML non conta.
    const episodeRegex = /<li class="episode"[^>]*>\s*<a([^>]*)>([^<]*)<\/a>/g;
    let match;

    while ((match = episodeRegex.exec(serverActiveMatch[1])) !== null) {
      const attrs = match[1];
      const hrefMatch = attrs.match(/href="([^"]+)"/);
      if (!hrefMatch) continue;

      const numMatch = attrs.match(/data-num="([^"]+)"/);
      const number = parseInt(numMatch ? numMatch[1] : match[2], 10);

      episodes.push({
        href: absUrl(hrefMatch[1]),
        number: Number.isNaN(number) ? episodes.length + 1 : number,
      });
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.log("Episodes error:", error);
    return JSON.stringify([]);
  }
}

// ==========================================
// 4. ESTRAZIONE STREAM
// ==========================================
async function extractStreamUrl(url) {
  try {
    // Compatibilità con episodi salvati dalla v1.0.5 (href#data-id): il fragment viene ignorato
    const cleanUrl = url.indexOf("#") !== -1 ? url.substring(0, url.indexOf("#")) : url;
    // L'ultimo segmento dell'URL coincide con il data-id usato dall'API
    const episodeId = cleanUrl.split("/").pop();

    // Step 1: API diretta senza cookies (rapida, funziona per molti anime)
    const direct = await callApi(episodeId, {});
    if (direct) return direct;

    // Step 2: Carica homepage con WebView reale per ottenere i cookie Cloudflare,
    // poi riprova l'API con quei cookie
    const homeResult = await new Promise((resolve, reject) => {
      networkFetchNative(
        `${CONFIG.BASE}/`,
        { timeoutSeconds: 12, returnHTML: false, returnCookies: true },
        resolve,
        reject
      );
    });
    if (homeResult && homeResult.cookies && Object.keys(homeResult.cookies).length > 0) {
      const cookieString = Object.entries(homeResult.cookies)
        .map(([k, v]) => `${k}=${v}`).join("; ");
      const withCookies = await callApi(episodeId, { "Cookie": cookieString });
      if (withCookies) return withCookies;
    }

    // Step 3: WebView sulla pagina episodio — intercetta l'URL MP4 dal player
    const result = await new Promise((resolve, reject) => {
      networkFetchNative(
        cleanUrl,
        { timeoutSeconds: 20, cutoff: ".mp4", returnHTML: false, returnCookies: false },
        resolve,
        reject
      );
    });
    if (result && result.success) {
      if (result.cutoffTriggered && result.cutoffUrl) return result.cutoffUrl;
      const videoUrl = result.requests &&
        result.requests.find(r => r.includes(".mp4") || r.includes(".m3u8"));
      if (videoUrl) return videoUrl;
    }

    return null;
  } catch (error) {
    console.log("Stream URL error:", error);
    return null;
  }
}

async function callApi(episodeId, extraHeaders) {
  try {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "X-Requested-With": "XMLHttpRequest",
      ...extraHeaders
    };
    const res = await soraFetch(
      `${CONFIG.BASE}/api/episode/info?id=${episodeId}&alt=0`,
      { headers, method: "GET", body: null }
    );
    if (!res) return null;
    const text = await res.text();
    if (!text) return null;
    const data = JSON.parse(text);
    return (data && data.grabber) ? data.grabber : null;
  } catch (e) {
    return null;
  }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        const response = await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
        // Luna: fetchv2 risolve sempre (mai reject), anche in caso di errore → {error: "..."} senza status.
        // Shirox: fetchv2 rigetta in caso di errore → si finisce direttamente nel catch.
        if (response && response.status !== undefined) {
            return response;
        }
        throw new Error('fetchv2 error response');
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}
