# 🔄 Quick-Resume: Modulo AnimeWorld IT

> **Versione modulo:** 1.0.6  
> **Ultimo aggiornamento:** 14 Ottobre 2026  
> **App principale:** iOS **Shirox** (compatibile anche con Luna / Sora / Mojuru)  
> **Repository GitHub:** [Karelg86/media-player-anim](https://github.com/Karelg86/media-player-anim)  
> **URL modulo:** `https://raw.githubusercontent.com/Karelg86/media-player-anim/main/main.json`  
> **Cartella locale:** `d:\Sora_Sulfur\Anim_Git\` (o cartella clone del repo)

---

## 📄 File nel repository

```
media-player-anim/
├── main.json                       # Configurazione del modulo (versione, baseUrl, scriptUrl)
├── extractor.js                    # Ricerca, dettagli, episodi e stream video
├── test-module.js                  # Test locale (Node.js 18+) prima del push
├── Quick-Resume.md                 # Questo file
├── .gitignore                      # Esclude backup/ e file locali
├── .github/
│   ├── workflows/
│   │   ├── check-domain.yml        # Robot: controlla il dominio ogni 6 ore e AVVISA (issue)
│   │   ├── update-domain.yml       # Robot: cambio dominio su richiesta (anche da cellulare)
│   │   └── health-check.yml        # Robot: test completo ogni giorno, AVVISA se il modulo non funziona
│   └── scripts/
│       ├── check-domain.js
│       └── update-domain.js
└── backup/                         # SOLO sul PC (ignorato da git): versioni precedenti
```

---

## 🆕 Novità v1.0.6 (14 Ottobre 2026)

1. **Dominio in un solo punto:** `CONFIG.BASE` in cima a `extractor.js` (prima era ripetuto in 5 punti).
2. **Apostrofi e simboli:** `decodeEntities` applicato a titoli, trama e titolo originale. AnimeWorld scrive l'apostrofo come `&#x27;` (es. "Frieren: Beyond Journey&#x27;s End" → ora "Frieren: Beyond Journey's End").
3. **Trama pulita:** rimossi i tag HTML (`<br>` diventa a capo).
4. **Episodi:** gli attributi di `<a>` vengono letti uno per uno, quindi l'ordine nell'HTML non conta. Numero episodio preso da `data-num`.
5. **Pulizia `data-id`:** verificato il 14/10/2026 che il `data-id` dell'episodio **coincide** con l'ultimo segmento dell'URL (`data-id="vlhlNp"` ↔ `/play/.../vlhlNp`). Il vecchio trucco `href#data-id` non serviva (e la sua regex non trovava mai nulla perché nell'HTML `data-id` viene prima di `href`). Gli episodi salvati con `#...` dalla v1.0.5 continuano a funzionare.
6. **`main.json`:** `supportsShirox: true`, autore Karelg86, icona GitHub stabile.

---

## ⚙️ Architettura tecnica AnimeWorld

### Funzioni dell'extractor

1. **`searchResults(keyword)`** — Cerca su `/search?keyword=...`, estrae i titoli da `<div class="film-list">` (ogni item ha `class="name"` e `class="poster"`). La lista termina con `<div class="clearfix"></div>`: la pagina contiene altre liste laterali che NON vanno prese.
2. **`extractDetails(url)`** — Trama (`<div class="desc">`), titolo originale (`data-jtitle`), data uscita (`Data di Uscita:`).
3. **`extractEpisodes(url)`** — Episodi in `<div class="server active">`, ogni episodio è `<li class="episode"><a data-id="..." data-num="1" href="/play/...">`. One Piece: 1180 episodi tutti nella stessa pagina.
4. **`extractStreamUrl(url)`** — Approccio a 3 step (vedi sotto).

### Formato URL episodio
`https://www.animeworld.ac/play/SLUG.ANIMEID/TOKEN` — `TOKEN` = `data-id` = id per l'API.

---

## 🎬 extractStreamUrl — 3 step

**Step 1: API diretta** (rapida, funziona per la maggior parte degli anime)
```
GET https://www.animeworld.ac/api/episode/info?id={TOKEN}&alt=0
→ {"grabber": "https://srvXX-....sweetpixel.org/DDL/ANIME/.../File_Ep_01_SUB_ITA.mp4", ...}
```

**Step 2: cookie Cloudflare** — `networkFetchNative` apre la homepage in un WebView reale, prende i cookie e riprova l'API.

**Step 3: WebView sulla pagina episodio** — `networkFetchNative` con `cutoff: ".mp4"` intercetta l'URL del video dal player (cerca anche `.m3u8`).

---

## 🔬 `fetchv2`: differenza Shirox / Luna (CRITICO)

| | **Shirox** (`xibrox/Shirox`, `Shirox/Services/JSEngine.swift`) | **Luna** (`cranci1/Luna`) |
|---|---|---|
| In caso di errore | **rigetta** la Promise | **risolve** con `{error: "..."}` senza `status` |
| Cloudflare | bypass integrato (`CloudflareBypassManager`: cookie + retry automatico su Turnstile) | nessuno |
| `fetch` globale | alias di `fetchv2` di Shirox | `fetch` nativo |

`soraFetch` gestisce entrambi: controlla `response.status !== undefined` (caso Luna) e ha un `try/catch` (caso Shirox).

### `networkFetchNative` (presente in Shirox e Luna, stessa firma)
```js
networkFetchNative(url, options, resolve, reject)   // callback, NON Promise
```
- È un WKWebView reale: carica la pagina come un browser.
- Opzioni: `timeoutSeconds`, `cutoff`, `returnHTML`, `returnCookies`, `clickSelectors`, `waitForSelectors`, `maxWaitTime`.
- Risultato: `{success, requests: [...], cutoffTriggered, cutoffUrl, html, cookies}`.
- Shirox definisce anche il wrapper Promise `networkFetch(url, options)` (`Shirox/Services/NetworkFetch.swift`).

---

## ⚠️ Problemi noti

### 1. Redirect dominio senza `www` → con `www`
- Su Luna `fetchv2` non segue i redirect → usare SEMPRE l'indirizzo con `www`.
- Quando cambi dominio, scrivilo **con `www.`** se il sito lo usa (il robot di controllo ti propone già l'indirizzo completo).

### 2. API `/api/episode/info` bloccata da Cloudflare
- Per alcuni anime Cloudflare può bloccare la chiamata API → entrano in gioco gli step 2 e 3.
- Test 14/10/2026 (da PC, senza cookie): API diretta funzionante per Frieren e One Piece.

### 3. "Continua a guardare" e href stabili
- Nelle build recenti di Shirox (`Views/ContinueWatchingCard.swift` → `onStreamExpired`) se il link salvato non funziona più l'app richiama `extractEpisodes`, ritrova l'episodio tramite `href` (o numero) e chiede un nuovo stream.
- Gli `href` degli episodi devono quindi restare **stabili**. Gli episodi salvati con la v1.0.5 (`href#data-id`) non coincidono più con i nuovi `href`: Shirox ripiega sul numero episodio, quindi funzionano comunque.

### 4. Ricerca con titoli giapponesi (limite dell'app)
- Nella ricerca incrociata l'app può passare il titolo giapponese (es. "キルアオ"); AnimeWorld indicizza titoli italiani/inglesi → nessun risultato. Non risolvibile lato extractor.

---

## 🔁 CAMBIO DOMINIO

### 🤖 Avviso automatico
- Ogni 6 ore GitHub esegue **Controllo dominio** (non modifica nulla).
- Se il dominio reindirizza altrove **o non risponde più**, apre una **issue** con etichetta `dominio` assegnata a te → notifica su app GitHub / email.
- Lancio manuale: *Actions → Controllo dominio → Run workflow*.
- ⚠️ GitHub sospende i workflow programmati dopo **60 giorni senza attività** nel repo (manda una email prima). Riattivazione: *Actions → Controllo dominio → Enable workflow*.

### 🩺 Salute del modulo (robot giornaliero)
- Ogni giorno GitHub esegue **Salute modulo**: test offline + test completo sul sito vero (ricerca → episodi → stream).
- Se fallisce **2 volte di fila** apre una issue con etichetta `salute` (notifica su app GitHub / email): il sito ha probabilmente cambiato la struttura delle pagine e il modulo va aggiornato.
- Un solo errore isolato non genera avvisi (Cloudflare a volte blocca i server di GitHub).
- Quando il test torna a funzionare la issue si chiude da sola. Lancio manuale: *Actions → Salute modulo → Run workflow*.

### 📱 Da cellulare
1. Apri il link nella issue, oppure `https://github.com/Karelg86/media-player-anim/actions/workflows/update-domain.yml`
2. **Run workflow** → scrivi il nuovo dominio **senza** `https://` (es. `www.animeworld.nuovo`) → conferma.
3. Il robot sostituisce il dominio in `main.json`, `extractor.js`, `Quick-Resume.md`, incrementa la versione, lancia i test, fa commit + push e chiude la issue.
4. Su Shirox: Moduli → aggiorna.

> Test del robot falliti ≠ errore per forza: Cloudflare a volte blocca i server di GitHub. Prova su Shirox o lancia il test dal PC.

### 💻 Da PC
```bash
node .github/scripts/update-domain.js www.animeworld.nuovo
node test-module.js "frieren"
node test-module.js "one piece"
git add main.json extractor.js Quick-Resume.md
git commit -m "Update domain to www.animeworld.nuovo - v1.0.7"
git push origin main
```

> ⚠️ Shirox salva lo script in cache: incrementare `version` in `main.json` è **obbligatorio** per far scaricare la nuova versione. `update-domain.js` lo fa da solo.

---

## 🧪 Test locale

```bash
node test-module.js --mock         # offline: apostrofi, trama, episodi, stream API, compatibilità v1.0.5
node test-module.js "frieren"      # live
node test-module.js "one piece"    # live, anime lungo
```
In Node non esistono `fetchv2` e `networkFetchNative`: il test live verifica solo lo step 1 (API diretta).
Versione vecchia: `EXTRACTOR=backup/v1.0.5/extractor.js node test-module.js --mock`.

---

## 🔗 Risorse utili

- **Sorgente Shirox:** `https://github.com/xibrox/Shirox` — `Shirox/Services/JSEngine.swift` (fetchv2), `Shirox/Services/NetworkFetch.swift` (networkFetchNative), `Shirox/Services/CloudflareBypassManager.swift`
- **Sorgente Luna:** `https://github.com/cranci1/Luna` — `Luna/JSLoader/JavaScriptCore+Extensions.swift`, `Luna/JSLoader/JSController-NetworkFetch.swift`
- **AnimeWorld-API (Python):** `https://github.com/MainKronos/AnimeWorld-API`
