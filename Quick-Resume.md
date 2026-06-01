# 🔄 Quick-Resume: Procedura Aggiornamento Dominio SORA - AnimeWorld

Questo file serve come manuale di riferimento rapido per l'IA. Delinea la procedura da seguire ogni volta che l'utente fornisce un nuovo dominio per aggiornare il modulo SORA di AnimeWorld.

## 📝 Procedura di aggiornamento:

Quando l'utente comunica che il dominio è cambiato e fornisce quello nuovo (es. `animeworld.nuovo`):

1. **Aggiornare `main.json`** (`d:\\Sora_Sulfur\\Anim_Git\\main.json`):
   - Sostituire il dominio corrente col nuovo dominio in campi chiave come `iconUrl`, `baseUrl`, e `searchBaseUrl`.
   - Ad esempio, `https://IL_VECCHIO_DOMINIO/` diventerà `https://IL_NUOVO_DOMINIO/`.

2. **Aggiornare `extractor.js`** (`d:\\Sora_Sulfur\\Anim_Git\\extractor.js`):
   - Aprire il file e sostituire tutte le stringhe contenenti il vecchio dominio con quello nuovo.
   - Ad esempio, aggiornare da `` `https://IL_VECCHIO_DOMINIO/search?...` `` a `` `https://IL_NUOVO_DOMINIO/search?...` ``.

3. **Verificare sostituzioni**:
   - Assicurarsi che tutti i pattern URL con il nuovo dominio siano validi dopo l'edit.

4. **Push su GitHub (Automatico)**:
   - Eseguire i seguenti comandi nel terminale all'interno della cartella `Anim_Git` per pubblicare le modifiche online:
     ```bash
     git add .
     git commit -m "Aggiornato dominio a IL_NUOVO_DOMINIO"
     git push
     ```

5. **Avvisare l'utente**:
   - Confermare all'utente che i file sono stati aggiornati e pushati con successo su GitHub.
   - Ricordare all'utente di chiudere l'app SORA completamente (o ricaricare il modulo) affinché acquisisca il file aggiornato dal cloud.

---
**Dominio corrente configurato nei file:** `www.animeworld.ac`
*(Mantenere quest'ultima riga aggiornata a ogni sostituzione così da avere facilmente identificabile il "dominio precedente")*
