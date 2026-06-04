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
    const episodeRegex = /<li class="episode">\s*<a[^>]*?href="([^"]+)"[^>]*?>([^<]+)<\/a>/g;
    let match;

    while ((match = episodeRegex.exec(serverActiveContent)) !== null) {
      let href = match[1];
      const number = parseInt(match[2], 10);

      if (!href.startsWith("https")) {
        href = href.startsWith("/") ? baseUrl + href : baseUrl + "/" + href;
      }

      episodes.push({ href: href, number: number });
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
    const episodeToken = url.split("/").pop();
    console.log("Stream: fetching API for token:", episodeToken);

    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "it-IT,it;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": url,
    };

    const apiResponse = await soraFetch(
      `https://www.animeworld.ac/api/episode/info?id=${episodeToken}&alt=0`,
      { headers: headers, method: "GET", body: null }
    );
    if (!apiResponse) {
      console.log("Stream: soraFetch returned null");
      return null;
    }

    const text = await apiResponse.text();
    console.log("Stream API response:", text);

    const data = JSON.parse(text);
    if (data && data.grabber) {
      return data.grabber;
    }

    console.log("Stream: grabber missing or null in response");
    return null;
  } catch (error) {
    console.log("Stream URL error:", error);
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
