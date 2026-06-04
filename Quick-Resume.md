# 🔄 Quick-Resume: Procedura Aggiornamento Dominio SORA - AnimeWorld

Questo file serve come manuale di riferimento rapido per l'IA. Delinea la procedura da seguire ogni volta che l'utente fornisce un nuovo dominio per aggiornare il modulo SORA di AnimeWorld.

## 📦 Repository

- **Repository GitHub:** `https://github.com/Karelg86/media-player-anim`
- **URL modulo per SORA:** `https://raw.githubusercontent.com/Karelg86/media-player-anim/main/main.json`
- **Cartella locale:** `d:\Sora_Sulfur\Anim_Git\`

## 📄 File nel repository

| File | Descrizione |
|------|-------------|
| `main.json` | Configurazione del modulo (sourceName, baseUrl, searchBaseUrl, scriptUrl) |
| `extractor.js` | Script di estrazione: ricerca, dettagli, episodi e stream video |
| `Quick-Resume.md` | Questo file - manuale di riferimento |

## ⚙️ Architettura tecnica AnimeWorld

### Come funziona l'extractor

1. **`searchResults(keyword)`**: Cerca su `https://www.animeworld.ac/search?keyword=...` — estrae titoli dalla `<div class="film-list">`, ogni item ha `class="name"` (titolo/link) e `class="poster"` (immagine)
2. **`extractDetails(url)`**: Estrae descrizione (`<div class="desc">`), titolo originale (`<h2 class="title" data-jtitle="...">`), data uscita (`Data di Uscita:`)
3. **`extractEpisodes(url)`**: Trova episodi nel blocco `<div class="server active">`, ogni episodio è `<li class="episode"><a href="/play/...">`
4. **`extractStreamUrl(url)`**: Carica la pagina dell'episodio e cerca il link video con regex multipli sull'HTML della pagina (vedi sezione dedicata)

### Dettagli `extractStreamUrl` (aggiornato)

- **NON usa più l'API** `/api/episode/info` — viene bloccata da AnimeWorld con "Could not connect to the server" in `fetchV2NativeFunction`
- **Approccio attuale:** `soraFetch(url)` sulla pagina episodio, poi cerca il link video con questi pattern in ordine:
  1. `"grabber":"https://..."` — campo JSON embeddato nella pagina
  2. `file: "https://...*.mp4"` — formato player JW/VideoJS
  3. `<source src="https://...">` — tag HTML5 video
  4. `data-src="https://...*.mp4"` — attributo lazy-load
  5. `window.VIDEO_URL = "https://..."` — variabile JS globale
- Se nessun pattern matcha, il log riporta `"Stream URL: no pattern matched in page HTML"`

### Formato video

- **Formato atteso:** MP4 diretto (NON HLS/m3u8) — dichiarato in `main.json` come `"streamType": "MP4"`

## ⚠️ Problemi noti e soluzioni

### 1. Redirect 301 (CRITICO)
- `https://animeworld.ac` (senza www) → redirect 301 → `https://www.animeworld.ac`
- **`fetchv2` di SORA NON segue i redirect!**
- **Soluzione:** Usare SEMPRE `https://www.animeworld.ac` con `www` in tutti gli URL

### 2. API `/api/episode/info` bloccata
- L'endpoint `GET /api/episode/info?id=TOKEN&alt=0` restituisce "Could not connect to the server" in `fetchV2NativeFunction`
- L'API richiede probabilmente una sessione/cookie valida che il fetch nativo dell'app non fornisce
- **Soluzione:** Bypassare l'API e leggere il link video direttamente dall'HTML della pagina episodio (implementato)

### 3. `extractDetails` ritornava array vuoto
- La vecchia condizione `if (description && aliases && airdate)` richiedeva tutti e tre i campi presenti
- Se anche uno solo era vuoto, la funzione ritornava `[]` e Luna non mostrava l'anime
- **Soluzione:** Push sempre con i campi disponibili (anche vuoti)

### 4. `filmListRegex` dipendeva da `clearfix`
- La vecchia regex cercava `<div class="clearfix"></div>` come boundary del film-list
- Se AnimeWorld rimuoveva o spostava quel div, `searchResults` ritornava `[]`
- **Soluzione:** Regex semplificata che non dipende dal clearfix

### 5. `alternativeDownloadLink` rimosso
- Il vecchio metodo (usato dal reference Luna) non esiste più nel DOM
- **Soluzione:** Usare il parsing diretto della pagina episodio (implementato)

### 6. `soraFetch` - firma compatibile SORA
- Usare la stessa firma di StreamingCommunity: `fetchv2(url, headers, method, body)` — **4 parametri**
- NON usare parametri extra come `true` o `encoding` (Luna li supporta, SORA no)

## 📝 Procedura di aggiornamento dominio

Quando l'utente comunica che il dominio è cambiato e fornisce quello nuovo (es. `www.animeworld.nuovo`):

1. **Aggiornare `main.json`** (`d:\Sora_Sulfur\Anim_Git\main.json`):
   - Sostituire il dominio corrente col nuovo dominio in campi chiave come `iconUrl`, `baseUrl`, e `searchBaseUrl`.

2. **Aggiornare `extractor.js`** (`d:\Sora_Sulfur\Anim_Git\extractor.js`):
   - Sostituire tutte le stringhe contenenti il vecchio dominio con quello nuovo.
   - ⚠️ Verificare se il nuovo dominio richiede `www` o no (testare con redirect 301).

3. **Verificare sostituzioni**:
   - Assicurarsi che tutti i pattern URL siano validi e non facciano redirect.

4. **Push su GitHub (Automatico)**:
   ```bash
   cd d:\Sora_Sulfur\Anim_Git
   git add .
   git commit -m "Aggiornato dominio a IL_NUOVO_DOMINIO"
   git push
   ```

5. **Avvisare l'utente**:
   - Confermare che i file sono stati aggiornati e pushati su GitHub.
   - Ricordare di chiudere l'app completamente (o ricaricare il modulo).

---
**Dominio corrente configurato nei file:** `www.animeworld.ac`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione così da avere facilmente identificabile il "dominio precedente")*
