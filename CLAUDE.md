# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cos'è questo repository

`miyamotodan.github.io` è il sito personale statico di Miyamotodan, pubblicato via **GitHub Pages** direttamente dal branch `main`. Non c'è alcun build system: HTML, CSS e JS sono scritti/serviti così come sono, non c'è `package.json`, non ci sono bundler, transpiler, linter o test.

## Sviluppo locale

Non essendoci build step, per sviluppare basta aprire i file HTML direttamente nel browser oppure servirli con un server statico:

- Il repo include `.vscode/settings.json` con la porta preconfigurata per l'estensione **Live Server** (`liveServer.settings.port = 5501`): tasto destro su un file `.html` → "Open with Live Server".
- In alternativa qualsiasi static server (es. `npx serve`) funziona, perché tutti i path sono relativi.

Non esistono comandi di build, lint o test da eseguire: le modifiche si verificano ricaricando la pagina nel browser.

## Struttura del sito

Il sito principale (root) e le sotto-app in `progetti/` sono **indipendenti tra loro** — ognuna ha il proprio HTML/CSS/JS e non condivide un design system comune.

### Sito principale (root)

- `index.html` — home page (hero, About, Personal Projects, Contact), in inglese.
- `martial-arts.html` — pagina dedicata al percorso nelle arti marziali, il cui contenuto testuale è la trascrizione in HTML di `MARTIAL.md` (in italiano). Quando si aggiorna il CV marziale, aggiornare **entrambi** i file in modo coerente.
- `project-1.html`, `project-2.html` — pagine "case study" per i progetti elencati nella sezione Personal Projects di `index.html`; ogni progetto aggiunto in home richiede una pagina case-study analoga.
- `index.js` — vanilla JS condiviso da tutte le pagine root per il menu hamburger responsive (`.header__main-ham-menu-cont`, `.header__sm-menu`) e per il click sul logo che riporta a `index.html`. Va incluso (`<script src="./index.js">`) in ogni nuova pagina root che riusa lo stesso header.
- `css/style.css` — foglio di stile **unico e minificato** (una riga) usato da tutte le pagine root. Non esiste sorgente SCSS/LESS nel repo: le modifiche di stile vanno fatte a mano direttamente su questo CSS compilato (`css/style.css.map` è presente ma il sourceRoot punta solo a se stesso, non è ricostruibile). Le classi seguono convenzione BEM (`header__logo-container`, `home-hero__cta`, `projects__row-content`, ecc.).
- `assets/` — immagini organizzate per tipo/uso: `jpeg/`, `png/` (icone social e screenshot progetti), `svg/` (icone menu), `martial-arts/` (foto pagina arti marziali).

### Sotto-progetti (`progetti/`)

Ogni cartella sotto `progetti/` è un mini-sito autonomo, self-contained, linkato dalle pagine case-study della root ma **non** dall'header/menu del sito principale:

- `progetti/imgmeasure/` — "Misuratore di Distanze", tool client-side per misurare distanze/aree su un'immagine caricata (segmenti, rettangoli, cerchi) e riportarle in scala su carta. Interfaccia in italiano, basata su Bootstrap 5 (vendored: `bootstrap.min.css`, `bootstrap.bundle.min.js`) + Font Awesome via CDN. Tutta la logica applicativa (disegno su `<canvas>`, gestione mouse/touch, calcolo distanze, punti di controllo, snapping) è in `main.js`, un unico file a funzioni globali (nessuna classe/modulo) che opera su uno stato condiviso a livello di modulo; `main.css` contiene gli stili specifici del tool sopra Bootstrap. Corrisponde al progetto "IMG MEASURE" linkato da `project-1.html`.
- `progetti/emattei/` — biglietto da visita digitale standalone ("Eugenia Mattei - Architetto"), pagina singola autocontenuta con CSS inline nell'`<head>`, non collegata al resto del sito.

Quando si aggiunge un nuovo sotto-progetto: creare una cartella dedicata sotto `progetti/`, mantenerla self-contained (vendorizzare eventuali librerie invece di condividerle con la root), ed eventualmente collegarla da una nuova `project-N.html` in root se va promossa come case study.

## Convenzioni di contenuto

- Le pagine rivolte al pubblico generale del sito (root: home, contatti) sono in **inglese**; contenuti più personali/locali (arti marziali, tool imgmeasure, biglietto da visita) sono in **italiano**. Rispettare la lingua già usata nel file che si sta modificando.
- I messaggi di commit del repo sono in italiano e generalmente descrittivi e brevi (es. "aggiornata imgmeasure", "fix menu").
