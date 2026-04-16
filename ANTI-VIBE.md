# ⚠️ ANTI-VIBE PATTERNS

This document catalogs every decision we made that actively sabotages our credibility as a vibe-first project. We wrote *good code* for a *disco ball*. The engineering equivalent of putting a roll cage on a shopping cart.

---

## The Problem

Vibe Machine is an audio visualizer with draggable suns, pixel grids, and a button literally called "VIBE MODE." The target audience is people who want pretty colors when music plays.

We then decided to treat the codebase like it handles money.

Neither the "I just want vibes" crowd nor the "show me your architecture diagrams" crowd will be satisfied. The flashy bits don't break. The boring parts always pass. Everyone loses.

---

## Pattern #1: Security Headers on a Localhost Audio Player

**What we did:** Every HTTP response from this local dev server now includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

**What it protects against:** Someone iframe-embedding your localhost visualizer. Which means it protects against nothing. The API serves a JSON array of song filenames. To a browser tab. On your own machine.

**Why it's anti-vibe:** Because we tested it. Five tests. For security headers. On a server that reads `.ogg` files from a folder called `tracks/`. We put a lock on a screen door and then hired a locksmith to verify the lock works every time we push code.

**Vibe-correct alternative:** Ship it. If someone hacks your local audio visualizer, they deserve whatever playlist they find.

---

## Pattern #2: HTTP Method Validation

**What we did:** `POST /api/tracks` now returns `405 Method Not Allowed` with a proper `Allow: GET` header.

**What it protects against:** Someone accidentally POST-ing to an endpoint that lists your music files. The worst case scenario of *not* having this is... they get the same JSON list back anyway, because the handler only reads the filesystem.

**Why it's anti-vibe:** We wrote two tests for this. Two tests to make sure that if you use the wrong HTTP verb to ask "what songs do I have?", we politely refuse instead of just telling you. It's like asking for directions and being told "you used the wrong tone of voice, please ask again."

**Vibe-correct alternative:** Answer the question. It's a list of songs.

---

## Pattern #3: Cache-Control Headers

**What we did:** HTML gets `no-cache`, CSS/JS get `max-age=3600`, audio files get `max-age=86400`.

**What it optimizes:** Repeat visits to your locally-running audio visualizer. The browser will now efficiently cache your pixel grid visualizer JavaScript for one full hour. The 3KB file. Locally.

**Why it's anti-vibe:** We differentiated caching strategies by MIME type. For a dev server. That you restart every time you make a change. Which invalidates the cache anyway.

**Vibe-correct alternative:** Let the browser figure it out. It's been doing that since 1995.

---

## The Scoreboard

| Metric | Count |
|--------|-------|
| Anti-vibe tests added | 11 |
| Security vulnerabilities prevented | 0 (realistically) |
| Performance improved on localhost | unmeasurable |
| Vibes killed in the process | several |
| People who will read the `Allow: GET` header | 0 |

---

## In Conclusion

We have an app where you can drag a pixelated sun across the screen while Claire de Lune plays, and the server code would pass a code review at a Fortune 500. The sunrise fades in from black over configurable seconds with guaranteed 1-second darkness hold, and the HTTP responses include referrer policies.

The code is too well-written. The tests always pass. The colors are pretty and they never glitch. We have somehow made everyone unhappy.

*Wubba lubba dub dub.*

---

*This file was written under duress by an engineering conscience that couldn't stop itself from adding `Cache-Control` headers to a project with a file called `visualizers/blank.js` whose entire job is to paint the screen black.*
