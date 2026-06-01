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
4. **`extractStreamUrl(url)`**: Prende il token dall'ultimo segmento URL (es. `NoZjU` da `.../NoZjU`), chiama API `https://www.animeworld.ac/api/episode/info?id=TOKEN&alt=0`, restituisce `data.grabber` (URL MP4 diretto)

### Dettagli API

- **Endpoint stream:** `GET https://www.animeworld.ac/api/episode/info?id={episodeToken}&alt=0`
- **Risposta:** `{"grabber":"https://srv28.../file.mp4","name":"TOKEN","target":"/api/episode/serverPlayerAnimeWorld?id=TOKEN"}`
- **Formato video:** MP4 diretto (NON HLS/m3u8)
- **Non serve** header `X-Requested-With` o `Referer` — funziona senza header custom

### Token episodio

I token sono stringhe alfanumeriche (es. `NoZjU`, `WKyvz`, `3nvDT`) che identificano univocamente ogni episodio. Si trovano:
- Come ultimo segmento dell'URL episodio: `/play/anime-slug.ID/TOKEN`
- Nel JavaScript della pagina: `window.episodeToken = "TOKEN"`
- Negli attributi HTML: `data-id="TOKEN"`

## ⚠️ Problemi noti e soluzioni

### 1. Redirect 301 (CRITICO)
- `https://animeworld.ac` (senza www) → redirect 301 → `https://www.animeworld.ac`
- **`fetchv2` di SORA NON segue i redirect!**
- **Soluzione:** Usare SEMPRE `https://www.animeworld.ac` con `www` in tutti gli URL

### 2. `alternativeDownloadLink` rimosso
- Il vecchio metodo (usato dal reference Luna) non esiste più nel DOM
- **Soluzione:** Usare l'API `/api/episode/info` (implementata nel nostro extractor)

### 3. `soraFetch` - firma compatibile SORA
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
   - Ricordare di chiudere l'app SORA completamente (o ricaricare il modulo).

---
**Dominio corrente configurato nei file:** `www.animeworld.ac`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione così da avere facilmente identificabile il "dominio precedente")*
