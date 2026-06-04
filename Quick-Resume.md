# 🔄 Quick-Resume: Modulo AnimeWorld IT per Luna

Manuale di riferimento aggiornato al 2026-06-04.

## 📦 Repository

- **Repository GitHub:** `https://github.com/Karelg86/media-player-anim`
- **URL modulo per Luna:** `https://raw.githubusercontent.com/Karelg86/media-player-anim/main/main.json`
- **Cartella locale:** `d:\Sora_Sulfur\Anim_Git\`

## 📄 File nel repository

| File | Descrizione |
|------|-------------|
| `main.json` | Configurazione del modulo (sourceName, baseUrl, searchBaseUrl, scriptUrl) |
| `extractor.js` | Script di estrazione: ricerca, dettagli, episodi e stream video |
| `Quick-Resume.md` | Questo file |

---

## ⚙️ Architettura tecnica AnimeWorld

### Funzioni dell'extractor

1. **`searchResults(keyword)`** — Cerca su `/search?keyword=...`, estrae titoli da `<div class="film-list">`, ogni item ha `class="name"` (titolo/link) e `class="poster"` (immagine)
2. **`extractDetails(url)`** — Estrae descrizione (`<div class="desc">`), titolo originale (`<h2 class="title" data-jtitle="...">`), data uscita (`Data di Uscita:`)
3. **`extractEpisodes(url)`** — Trova episodi in `<div class="server active">`, ogni episodio è `<li class="episode"><a href="/play/..." data-id="...">`. Il `data-id` viene encodato nel fragment dell'URL (`href#data-id`) per passarlo a `extractStreamUrl`
4. **`extractStreamUrl(url)`** — Approccio ibrido (vedi sezione dedicata)

### Formato URL episodio
`https://www.animeworld.ac/play/SLUG.ANIMEID/TOKEN`
- `TOKEN` = ultimo segmento URL = usato come fallback per l'API
- `data-id` = attributo HTML sull'`<a>` dell'episodio = ID corretto per l'API

---

## 🎬 extractStreamUrl — Approccio ibrido

**Metodo 1: API diretta** (rapido, funziona per molti anime)
```
GET https://www.animeworld.ac/api/episode/info?id={episodeId}&alt=0
→ {"grabber": "https://cdn.../file.mp4", "name": "TOKEN", "target": "..."}
```
- `episodeId` = estratto dal fragment `#data-id` se presente, altrimenti `url.split("/").pop()` (TOKEN)
- Se la risposta ha `data.grabber`, viene restituito direttamente

**Metodo 2: WebView reale** (fallback quando l'API è bloccata)
- Chiama `networkFetchNative(url, {timeoutSeconds:20, cutoff:".mp4"}, resolve, reject)`
- Luna apre la pagina in un WKWebView reale che bypassa Cloudflare
- Monitora tutti gli URL caricati (XHR, fetch, video.src, jwplayer, ecc.)
- Con `cutoff: ".mp4"` si ferma appena trova il primo URL video
- Cerca anche `.m3u8` come fallback

---

## 🔬 Come funziona `fetchv2` in Luna (CRITICO)

Fonte: `Luna/JSLoader/JavaScriptCore+Extensions.swift` su GitHub (`cranci1/Luna`)

```js
fetchv2(url, headers, method, body, redirect, encoding)
```

- **È un `URLSession.downloadTask`** — una semplice richiesta HTTP, NON un WebView
- **Risolve SEMPRE, non rigetta mai** — anche in caso di errore di rete chiama `resolve({error: "..."})` invece di `reject`
- Quando ha successo restituisce: `{status: 200, headers: {...}, body: "..."}` con metodi `.text()` e `.json()`
- Quando fallisce restituisce: `{error: "..."}` — senza `status`, senza `body`

### Bug storico in `soraFetch` (fixato)
Il vecchio `soraFetch` usava `try/catch` sul `await fetchv2(...)`. Ma poiché `fetchv2` non rigetta mai, il `catch` non scattava mai e il fallback a `fetch` nativo non partiva mai.

**Fix:** controllare `response.status !== undefined` per rilevare l'errore:
```js
async function soraFetch(url, options) {
    try {
        const response = await fetchv2(url, options.headers, options.method, options.body);
        if (response && response.status !== undefined) return response; // successo
        throw new Error('fetchv2 error');  // forza il fallback
    } catch (e) {
        try { return await fetch(url, options); }
        catch (error) { return null; }
    }
}
```

---

## 🖥️ Come funziona `networkFetchNative` in Luna

Fonte: `Luna/JSLoader/JSController-NetworkFetch.swift` su GitHub (`cranci1/Luna`)

```js
networkFetchNative(url, options, resolve, reject)
```

- **È un WKWebView reale** — carica la pagina come un browser, bypassa Cloudflare
- Inietta JavaScript che monitora: `fetch`, `XHR`, `WebSocket`, `video.src`, `jwplayer.setup`, variabili globali, contenuto `<script>`
- Opzioni disponibili: `timeoutSeconds`, `cutoff` (stringa: si ferma quando trova URL che la contiene), `returnHTML`, `returnCookies`, `clickSelectors`, `waitForSelectors`
- Risultato: `{success: true, requests: [...], cutoffTriggered: bool, cutoffUrl: "...", html: "...", cookies: {...}}`
- **NON ha wrapper Promise** — va chiamata con callback: `new Promise((res, rej) => networkFetchNative(url, opts, res, rej))`

---

## ⚠️ Problemi noti

### 1. Redirect 301 (CRITICO)
- `https://animeworld.ac` (senza www) → redirect 301 → `https://www.animeworld.ac`
- `fetchv2` NON segue redirect per default
- **Soluzione:** usare SEMPRE `https://www.animeworld.ac` con `www`

### 2. API `/api/episode/info` bloccata da Cloudflare
- Per alcuni anime, Cloudflare blocca la chiamata API restituendo "Could not connect to the server"
- Per altri anime funziona senza problemi (Cloudflare selettivo per contenuto)
- **Soluzione:** approccio ibrido — API prima, WebView come fallback

### 3. Ricerca con titoli giapponesi (LIMITE DI LUNA)
- Luna nel cross-service search passa a volte il titolo giapponese (es. "キルアオ")
- AnimeWorld indicizza i titoli in italiano/inglese (es. "Kill Blue")
- Il nostro `searchResults` passa il keyword direttamente ad AnimeWorld → nessun risultato
- **Non risolvibile lato extractor** — dipende da come Luna gestisce i titoli

### 4. `extractDetails` con condizione troppo rigida (fixato)
- La vecchia condizione `if (description && aliases && airdate)` richiedeva tutti e tre i campi
- **Fix:** push sempre con i campi disponibili

### 5. `filmListRegex` dipendeva da `clearfix` (fixato)
- **Fix:** regex semplificata che non dipende dal div clearfix

### 6. `soraFetch` fallback mai attivo (fixato)
- **Fix:** check `response.status !== undefined` prima di restituire la risposta di `fetchv2`

---

## 📝 Procedura di aggiornamento dominio

1. **`main.json`** — aggiornare `baseUrl`, `searchBaseUrl`, `iconUrl`
2. **`extractor.js`** — sostituire tutte le stringhe con il vecchio dominio
3. **Push:**
   ```bash
   cd d:\Sora_Sulfur\Anim_Git
   git add .
   git commit -m "Aggiornato dominio a NUOVO_DOMINIO"
   git push
   ```
4. Ricaricare il modulo in Luna

---

## 🔗 Risorse utili

- **Source code Luna:** `https://github.com/cranci1/Luna`
  - `Luna/JSLoader/JavaScriptCore+Extensions.swift` — definizione `fetchv2`, `networkFetchNative`
  - `Luna/JSLoader/JSController-NetworkFetch.swift` — implementazione WebView
  - `Luna/JSLoader/JSController-Streams.swift` — come Luna processa il risultato di `extractStreamUrl`
- **AnimeWorld-API ufficiale (Python):** `https://github.com/MainKronos/AnimeWorld-API`
  - Usa `data-id` dall'HTML (non il token URL) per chiamare l'API
  - Fa una GET sulla homepage prima di ogni chiamata API per estrarre cookie anti-bot

---
**Dominio corrente configurato nei file:** `www.animeworld.ac`
