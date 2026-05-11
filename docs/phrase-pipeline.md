# Phrase-of-the-moment — derivation pipeline

A two-word phrase computed once per song (~3–6 min apart). The phrase surfaces
under each song in the episode timeline, and the first song's phrase is shown
in the episode header. It is also injected as `vibes.phraseOfTheMoment` in
the Claude composer prompt as flavor, not a directive.

(Word-of-the-moment was dropped; only the phrase pipeline below is live.)

---

```mermaid
flowchart TD
  classDef source fill:#fff5d6,stroke:#a08400,color:#3a2e00,font-weight:bold
  classDef process fill:#dfeaff,stroke:#2c5fb0,color:#0c1f44
  classDef vocab fill:#f0e0ff,stroke:#7b3aa8,color:#260b3d
  classDef quantum fill:#ffdce3,stroke:#b53a55,color:#3d0c17
  classDef output fill:#d6f0dd,stroke:#2f8a3f,color:#0d2d12,font-weight:bold
  classDef ui fill:#ffe9cc,stroke:#a86a00,color:#3d2400
  classDef llm fill:#e7e7e7,stroke:#5a5a5a,color:#1a1a1a

  NOAA["🛰️ NOAA SWPC<br/><i>1 fetch · 90s shared cache</i>"]:::source
  ANU["🎲 ANU Quantum RNG<br/><i>32 random bytes per song</i>"]:::source

  SW["K-index + solar-wind<br/>speed + density<br/>(3 numbers)"]:::source

  NOAA --> SW

  subgraph PHRASE ["💬 PHRASE OF THE MOMENT  ·  two words per song · STOCHASTIC"]
    direction TB
    P1["1 — Standardize<br/><i>z-score the 3 space-weather numbers</i>"]:::process
    P2["2 — Random projection<br/><i>3 × 384 fixed matrix →<br/>a point in 384-D 'meaning space'</i>"]:::process
    P3a[("📚 Material pool<br/>557 nouns / things<br/><i>museum collections, mineralogy,<br/>historical glossaries</i>")]:::vocab
    P3b[("📚 Force pool<br/>432 verbs / forces<br/><i>same kind of sources</i>")]:::vocab
    P4["3 — Softmax-weighted sample<br/><i>tilted toward similar words<br/>(temperature 0.03 — sharp);<br/>quantum bytes pick the dice roll<br/>so same sky can yield different words</i>"]:::process
    P5["4 — Quantum coin toss<br/><i>byte 4 decides word order:<br/>'force material' or 'material force'</i>"]:::quantum
    P6(["✦ PHRASE"]):::output

    P1 --> P2 --> P4
    P3a -. candidates .-> P4
    P3b -. candidates .-> P4
    P4 --> P5 --> P6
  end

  SW --> P1
  ANU -. "bytes 0–1 → material<br/>bytes 2–3 → force" .-> P4
  ANU -. "byte 4" .-> P5

  CLAUDE["🎼 Claude Haiku prompt for THIS song<br/><i>vibes.phraseOfTheMoment<br/>nudges mood / image / motif</i>"]:::llm

  P6 ==> CLAUDE

  HEADER["📰 Episode header<br/><b>'phrase: ___'</b><br/><br/>FIRST song's phrase only —<br/>scene-level signature"]:::ui
  TIMELINE["🎵 Episode timeline<br/><b>'phrase: ___' under each song</b><br/><br/>Fresh phrase per track"]:::ui

  P6 -. "first song only" .-> HEADER
  P6 ==> TIMELINE
```

---

## Key / colour legend

- **Yellow** — live data sources (fetched fresh per song)
- **Blue** — math / transform steps on the Worker
- **Purple** — vocabulary pools (pre-built offline, embedded in the Worker)
- **Pink** — quantum-driven steps (true randomness from ANU)
- **Green** — final output token
- **Grey** — Claude prompt (every song)
- **Orange** — what shows up in the UI

## Conceptual hooks worth knowing

1. **"Meaning space" is the trick.** The pipeline turns three live cosmic
   numbers into a 384-dimensional vector and looks up nearby words in that
   space. The vector itself is meaningless to a human — but it lets the sky
   steer the language.

2. **Stochastic, not deterministic.** Same space weather can pick different
   phrases because true quantum dice roll the softmax sample.

3. **The pools are pre-curated.** No LLM call happens in this live pipeline —
   that keeps it fast and free. The material/force pools come from open-text
   sources (museum catalogs, mineral glossaries, etc.).

4. **It's a nudge, not a directive.** The phrase goes to Claude as
   `vibes.phraseOfTheMoment` alongside the full stacked meta + lexicon
   context; Claude weaves it in if it fits. The visible phrase in the UI is
   the same token Claude saw — the user is reading the prompt's mood input.

5. **Header asymmetry is intentional.** The episode header shows the *first
   song's* phrase as a scene-level signature for the share card; the
   timeline shows each song's fresh phrase as a micro-caption.
