async function searchResults(keyword) {
  const results = [];
  const baseUrl = "https://www.animeworld.ac";

  try {
    const response = await soraFetch(
      `${baseUrl}/search?keyword=${encodeURIComponent(keyword)}`
    );
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
      let imageUrl = imgMatch ? imgMatch[1] : "";

      const titleMatch = itemHtml.match(/class="name">([^<]+)</);
      const title = titleMatch ? titleMatch[1] : "";

      const hrefMatch = itemHtml.match(/href="([^"]+)"/);
      let href = hrefMatch ? hrefMatch[1] : "";

      if (title && href) {
        if (imageUrl && !imageUrl.startsWith("https")) {
          imageUrl = imageUrl.startsWith("/") ? baseUrl + imageUrl : baseUrl + "/" + imageUrl;
        }
        if (!href.startsWith("https")) {
          href = href.startsWith("/") ? baseUrl + href : baseUrl + "/" + href;
        }
        results.push({
          title: title.trim(),
          image: imageUrl,
          href: href,
        });
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
    if (!response) return JSON.stringify([]);
    const html = await response.text();

    const descriptionMatch = html.match(/<div class="desc">([\s\S]*?)<\/div>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : "";

    const aliasesMatch = html.match(/<h2 class="title" data-jtitle="([^"]+)">/);
    const aliases = aliasesMatch ? aliasesMatch[1] : "";

    const airdateMatch = html.match(/<dt>Data di Uscita:<\/dt>\s*<dd>([^<]+)<\/dd>/);
    const airdate = airdateMatch ? airdateMatch[1].trim() : "";

    const details = [{
      description: description,
      aliases: aliases,
      airdate: airdate,
    }];

    console.log("Details:", JSON.stringify(details));
    return JSON.stringify(details);
  } catch (error) {
    console.log("Details error:", error);
    return JSON.stringify([]);
  }
}

async function extractEpisodes(url) {
  try {
    const response = await soraFetch(url);
    if (!response) return JSON.stringify([]);
    const html = await response.text();

    const episodes = [];
    const baseUrl = "https://www.animeworld.ac";

    const serverActiveMatch = html.match(/<div class="server active"[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/);
    if (!serverActiveMatch) {
      console.log("Episodes: server active block not found");
      return JSON.stringify(episodes);
    }

    const serverActiveContent = serverActiveMatch[1];
    // Cattura href, data-id e numero episodio
    const episodeRegex = /<li class="episode">\s*<a[^>]*?href="([^"]+)"[^>]*?data-id="([^"]+)"[^>]*?>([^<]+)<\/a>/g;
    let match;

    while ((match = episodeRegex.exec(serverActiveContent)) !== null) {
      let href = match[1];
      const dataId = match[2];
      const number = parseInt(match[3], 10);

      if (!href.startsWith("https")) {
        href = href.startsWith("/") ? baseUrl + href : baseUrl + "/" + href;
      }

      // Encode data-id nel fragment dell'URL così extractStreamUrl può usarlo
      episodes.push({ href: href + "#" + dataId, number: number });
    }

    // Fallback: regex senza data-id se il primo non ha trovato nulla
    if (episodes.length === 0) {
      const fallbackRegex = /<li class="episode">\s*<a[^>]*?href="([^"]+)"[^>]*?>([^<]+)<\/a>/g;
      while ((match = fallbackRegex.exec(serverActiveContent)) !== null) {
        let href = match[1];
        const number = parseInt(match[2], 10);
        if (!href.startsWith("https")) {
          href = href.startsWith("/") ? baseUrl + href : baseUrl + "/" + href;
        }
        episodes.push({ href: href, number: number });
      }
    }

    console.log("Episodes:", JSON.stringify(episodes));
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("Episodes error:", error);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const cleanUrl = url.indexOf("#") !== -1 ? url.substring(0, url.indexOf("#")) : url;
    const episodeId = cleanUrl.split("/").pop();

    // Metodo 1: API diretta (rapida, funziona per molti anime)
    const apiResponse = await soraFetch(
      `https://www.animeworld.ac/api/episode/info?id=${episodeId}&alt=0`
    );
    if (apiResponse) {
      const text = await apiResponse.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && data.grabber) {
            console.log("Stream: found via API");
            return data.grabber;
          }
        } catch (e) {}
      }
    }

    // Metodo 2: WebView reale — carica la pagina come un browser,
    // bypassa Cloudflare ed intercetta gli URL video caricati dal player
    console.log("Stream: API failed, trying WebView");
    const result = await new Promise((resolve, reject) => {
      networkFetchNative(
        cleanUrl,
        { timeoutSeconds: 20, cutoff: ".mp4", returnHTML: false, returnCookies: false },
        resolve,
        reject
      );
    });

    if (result && result.success) {
      if (result.cutoffTriggered && result.cutoffUrl) {
        console.log("Stream: found via WebView cutoff");
        return result.cutoffUrl;
      }
      if (result.requests && result.requests.length > 0) {
        const videoUrl = result.requests.find(r => r.includes(".mp4") || r.includes(".m3u8"));
        if (videoUrl) {
          console.log("Stream: found in WebView requests");
          return videoUrl;
        }
      }
    }

    console.log("Stream: no URL found");
    return null;
  } catch (error) {
    console.log("Stream URL error:", error);
    return null;
  }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        const response = await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
        // fetchv2 risolve sempre (mai reject), anche in caso di errore.
        // Se status è undefined significa che ha restituito {error: "..."} → fallback.
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
