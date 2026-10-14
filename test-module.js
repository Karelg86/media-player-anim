/**
 * Test runner locale per extractor.js - AnimeWorld (Node.js 18+)
 *
 * Uso:
 *   node test-module.js "frieren"      -> test LIVE sul sito vero (search, details, episodes, stream)
 *   node test-module.js "one piece"    -> anime lungo
 *   node test-module.js --mock         -> test OFFLINE con pagine finte (non tocca internet)
 *
 * extractor.js viene caricato in un contesto isolato, come fa Shirox con JavaScriptCore.
 * fetchv2 e networkFetchNative non esistono in Node: soraFetch usa fetch come fallback,
 * gli step WebView (2 e 3) di extractStreamUrl falliscono e il test verifica solo l'API diretta.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const EXTRACTOR_PATH = process.env.EXTRACTOR || path.join(__dirname, "extractor.js");

function loadExtractor(fetchImpl) {
  const context = vm.createContext({
    fetch: fetchImpl,
    console: { log() {}, error: console.error },
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(fs.readFileSync(EXTRACTOR_PATH, "utf8"), context, { filename: "extractor.js" });
  return context;
}

let failures = 0;
function check(label, condition, detail = "") {
  console.log(`${condition ? "✅" : "❌"} ${label}${detail ? "  ->  " + detail : ""}`);
  if (!condition) failures++;
}

// ==========================================
// TEST LIVE
// ==========================================
async function runLive(keyword) {
  const ex = loadExtractor(fetch);
  console.log(`\n🔎 Test LIVE con "${keyword}"\n`);

  const results = JSON.parse(await ex.searchResults(keyword));
  check("search", results.length > 0, `${results.length} risultati`);
  if (results.length === 0) return;
  const first = results[0];
  console.log(`   primo risultato: ${first.title}\n   ${first.href}`);
  check("search: nessuna entità HTML nei titoli", results.every((r) => !/&#|&[a-z]+;/i.test(r.title)));

  const details = JSON.parse(await ex.extractDetails(first.href));
  check("details", details.length === 1 && details[0].description !== "",
    details[0] ? details[0].description.slice(0, 80).replace(/\n/g, " ") + "..." : "vuoto");

  const t0 = Date.now();
  const episodes = JSON.parse(await ex.extractEpisodes(first.href));
  check("episodes", episodes.length > 0, `${episodes.length} episodi in ${Date.now() - t0} ms`);
  if (episodes.length === 0) return;
  check("episodes: numeri crescenti", episodes.every((e, i) => i === 0 || e.number > episodes[i - 1].number));

  const stream = await ex.extractStreamUrl(episodes[0].href);
  check("stream (API diretta)", typeof stream === "string" && /^https?:\/\/.+\.(mp4|m3u8)/.test(stream), stream || "null");
}

// ==========================================
// TEST OFFLINE (MOCK)
// ==========================================
const BASE = "https://www.animeworld.ac";

function makeMockFetch(stats) {
  return async (url) => {
    stats.requests.push(url);
    let body = "";
    if (url.includes("/search?keyword=")) {
      // Struttura reale AnimeWorld (verificata 14/10/2026): item, clearfix, poi script di paginazione
      body = `<div class="film-list">
  <div class="item">
    <div class="inner">
      <a href="/play/frieren.abc" class="poster" data-tip="api/tooltip/1">
        <img loading="lazy" src="https://img.example/f.jpg" alt="Frieren" />
        <div class="status"><div class="dub">DUB</div><span class="bar"></span></div>
      </a>
      <a href="/play/frieren.abc" data-jtitle="Sousou no Frieren" class="name">Frieren: Beyond Journey&#x27;s End</a>
    </div>
  </div>
  <div class="clearfix"></div>
</div>
<div>
  <script>window.paginationUrl = "${BASE}/search";</script>
</div>
</div>
</div>`;
    } else if (url === `${BASE}/play/frieren.abc`) {
      body = `<h2 class="title" data-jtitle="Sousou no Frieren">Frieren</h2>
<div class="desc">Il re dei demoni è sconfitto.<br>Frieren l&#039;elfa parte.</div>
<dl><dt>Data di Uscita:</dt> <dd> 29 Settembre 2023 </dd></dl>
<div class="server active" data-name="9">
  <ul class="episodes range active">
    <li class="episode"><a data-episode-id="1" data-id="tokA" data-num="1" href="/play/frieren.abc/tokA" class="active">1</a></li>
    <li class="episode"><a href="/play/frieren.abc/tokB" data-id="tokB" data-num="2">2</a></li>
  </ul>
</div>`;
    } else if (url.includes("/api/episode/info?id=")) {
      const id = url.match(/id=([^&]+)/)[1];
      body = id === "tokA" ? JSON.stringify({ grabber: "https://cdn.example/Frieren_Ep_01.mp4" }) : JSON.stringify({ error: true });
    }
    return { status: 200, text: async () => body };
  };
}

async function runMock() {
  console.log("\n🧪 Test OFFLINE (mock)\n");

  const ex0 = loadExtractor(async () => null);
  for (const raw of ["L&#39;a", "L&#039;a", "L&#x27;a", "L&apos;a"]) {
    check(`decodeEntities("${raw}")`, typeof ex0.decodeEntities === "function" && ex0.decodeEntities(raw) === "L'a");
  }

  const stats = { requests: [] };
  const ex = loadExtractor(makeMockFetch(stats));

  const results = JSON.parse(await ex.searchResults("frieren"));
  check("search: apostrofo decodificato", results[0] && results[0].title === "Frieren: Beyond Journey's End", results[0] && results[0].title);
  check("search: href assoluto", results[0] && results[0].href === `${BASE}/play/frieren.abc`);

  const details = JSON.parse(await ex.extractDetails(`${BASE}/play/frieren.abc`));
  check("details: trama senza tag e con apostrofo", details[0] && details[0].description.includes("Frieren l'elfa parte") && !details[0].description.includes("<br"),
    details[0] && JSON.stringify(details[0].description));
  check("details: data trimmata", details[0] && details[0].airdate === "29 Settembre 2023");

  const episodes = JSON.parse(await ex.extractEpisodes(`${BASE}/play/frieren.abc`));
  check("episodes: entrambi trovati (attributi in ordine diverso)", episodes.length === 2, `${episodes.length}`);
  check("episodes: href senza fragment", episodes.every((e) => !e.href.includes("#")));
  check("episodes: numeri", episodes.map((e) => e.number).join(",") === "1,2");

  const stream = await ex.extractStreamUrl(`${BASE}/play/frieren.abc/tokA`);
  check("stream: API diretta", stream === "https://cdn.example/Frieren_Ep_01.mp4", stream || "null");

  const legacy = await ex.extractStreamUrl(`${BASE}/play/frieren.abc/tokA#tokA`);
  check("stream: compatibile con episodi salvati v1.0.5 (href#data-id)", legacy === "https://cdn.example/Frieren_Ep_01.mp4", legacy || "null");
}

// ==========================================
(async () => {
  const arg = process.argv[2];
  try {
    if (!arg) {
      console.log('Uso: node test-module.js "titolo"   oppure   node test-module.js --mock');
      process.exit(1);
    }
    if (arg === "--mock") await runMock();
    else await runLive(arg);
  } catch (error) {
    console.error("💥 Errore imprevisto:", error);
    failures++;
  }
  console.log(failures === 0 ? "\n🎉 Tutti i test superati\n" : `\n⚠️  ${failures} test falliti\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
