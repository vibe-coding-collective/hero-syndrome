# Musical Parameter Schema

A deterministic mapping from runtime data inputs to musical-element option lists.

For every `/generate` call, the worker draws **one option per element** from each list using the song's per-call ANU quantum bytes. Those drawn options are passed verbatim to Claude as directorial constraints. Claude composes the song *within* them — choosing prose, sections, transitions, and how to honor each element — and returns the `compose_song` tool call. All input categories below correspond to fields actually emitted by the runtime (`packages/shared/src/claudePrompt.ts`).

Cultural-neutrality rule: no astrology, tarot, runes, zodiac, religious-tradition referents, or named deities. Musical character is chosen for its sonic / cinematic register, not its mythological associations.

Location data (Nominatim `placeType`, OSM `type`, proper `name`, `city`, `country`) flows to Claude as flavor, but is intentionally **not** a quantum-picked layer — places are too open-ended to bucket cleanly without losing the specificity that makes them evocative. Same goes for `userInput`, `vibes.wordOfTheMoment`, `vibes.phraseOfTheMoment`, `nearby` POIs, and `recentHistory` — they sit alongside the picks as context Claude reads directly.

---

## Layer 1 — Base canvas

### Input: `state.time.phase` (8 phases)

Source: `apps/web/src/sensors/clock.ts → timePhaseFromHour`. Boundaries are local-clock-driven.

| Phase | Hours (local) | Tempo (pick one BPM) | Key / mode (pick one) | Instrumentation base (pick one) |
|---|---|---|---|---|
| **`witchingHour`** | 02:00–05:00 | 44, 48, 50, 52, 54, 56 | A minor (natural), D minor, F♯ minor, C♯ Phrygian, B Aeolian, G minor, E Phrygian | Sub bass + bowed double bass + tape hiss · Subharmonic pad + soft choir · Detuned strings + low drone + felt piano · Bowed vibraphone + dark pad · Bass clarinet + analog drone · Muted French horn + low pad · Contrabassoon + sustained synth |
| **`night`** | 21:00–02:00 | 52, 56, 60, 64, 66, 68 | A minor (natural), E minor, D minor, F♯ minor, C♯ Phrygian, G minor, B Aeolian | Sustained strings + distant piano + soft pad · Felt piano + low cello drone + airy synth pad · Solo Rhodes + bowed double bass + tape hiss · Bowed vibraphone + warm pad + sub bass · Muted French horn + harp halo + analog pad · Nylon guitar + sustained synth + breath flute · Cor anglais + warm strings + sub bass |
| **`dawn`** | 05:00–07:00 | 56, 60, 64, 68, 72, 76 | A minor → A major (turning), D Dorian, G major, E minor → E major, F major, B♭ Lydian, C major | Felt piano + soft strings + tape hiss · Solo violin + warm pad + low brass · Cor anglais + harp + warm pad · Bowed cymbal swell + Rhodes + sub bass · Choir pad rising + nylon guitar + flute · Soft brass swell + strings + harp · Glass harmonica + warm strings + airy synth |
| **`morning`** | 07:00–11:00 | 72, 76, 80, 84, 88, 92 | D major, G major, A major, F major, C Lydian, E Mixolydian, B♭ major | Acoustic guitar + light strings + soft brass · Upright piano + clarinet + plucked harp · Nylon guitar + vibraphone + solo flute · Chamber strings + oboe + light percussion · Electric piano + soft synth lead + brushed drums · Solo violin + cello pad + acoustic guitar · Mandolin + accordion + light woodwinds |
| **`noon`** | 11:00–13:00 | 100, 104, 108, 112, 116, 120 | G major, C major, D major, A Mixolydian, F major, E major, B♭ Lydian | Full ensemble + acoustic + light synth · Brass quartet + rhythm section + piano · String quartet + light percussion + acoustic guitar · Synth lead + bass + drums + pads · Woodwind ensemble + Rhodes + walking bass · Acoustic combo: piano + upright bass + brushed kit · Orchestral chamber + harpsichord + light strings |
| **`afternoon`** | 13:00–16:00 | 92, 96, 100, 104, 108, 112 | C major, F major, G major, D Mixolydian, B♭ major, A major, E Lydian | Rhodes + acoustic guitar + walking bass · Soft horn section + piano + light percussion · String trio + clarinet + brushed drums · Vibraphone + nylon guitar + upright bass · Solo trumpet + piano + warm strings · Synth pad + acoustic guitar + soft drums · Chamber ensemble + flute + light strings |
| **`goldenHour`** | 16:00–19:00 | 80, 84, 88, 92, 96, 100 | D Mixolydian, A Dorian, F major, B♭ Lydian, E Dorian, G major, C Lydian | Warm guitar + electric piano + soft synth pad · Tenor saxophone + Rhodes + brushed bass · Cello + classical guitar + ambient pad · Flugelhorn + felt piano + warm strings · Bass clarinet + nylon guitar + analog synth · Muted trumpet + double bass + soft drums · Alto flute + harp + warm strings |
| **`dusk`** | 19:00–21:00 | 72, 76, 80, 84, 88, 92 | E Dorian, A Dorian, D Mixolydian, F♯ minor, C♯ minor, B minor, G Mixolydian | Warm pad + electric piano + soft drums · Cor anglais + cello + ambient pad · Soft synth bass + nylon guitar + brushed kit · Alto flute + harp + warm strings · Bowed vibraphone + Rhodes + sub bass · Felt piano + low strings + tape hiss · Bass clarinet + soft synth + felt piano |

### Input: `state.time.dayOfWeek` (7 days)

A secondary day-accent voice on top of the L1 base. No tradition-derived character — instrument options were chosen for sonic distinctness across the week.

| Day | Day accent instrument (pick one) |
|---|---|
| **Mon** | Choir pad — soft, hovering · Distant vocal "ah" — wordless · Bowed vibraphone — silvery, slow · Sustained celesta — cool, lit · Glass harmonica — translucent · Soft synth pad with slow LFO — gently pulsing · Boys' choir — pale, suspended |
| **Tue** | Brass accent — assertive, forward · French horn line — declarative · Timpani roll into accent · Trumpet stab — bright, decisive · Trombone slide — bold, muscular · Snare ruff + cymbal — drilled, ready · Low brass cluster — gritty, forceful |
| **Wed** | Solo strings — communicative, agile · Pizzicato violin runs — quick, witty · Solo flute filigree — darting · Marimba flurries — chattering · Solo clarinet line — conversational · Glockenspiel sparkles — quicksilver · Plucked koto figures — agile, bright |
| **Thu** | Organ — expansive, weighty · Full string-section swell — generous · Tubular bells — broad · Hammond B3 sustained — warm authority · Brass chorale — noble, grand · Pipe organ pedal point — vast · Low choir + organ blend — solemn breadth |
| **Fri** | Harp — light, social · Acoustic guitar arpeggio — easygoing · Solo flute + harp duet — flirtatious · Vibraphone shimmer — convivial · Mandolin tremolo — lilting · Plucked Celtic harp — graceful · Music-box motif — gentle charm |
| **Sat** | Low bass strings — grounded, no urgency · Contrabassoon held tone — heavy, slow · Tuba sustained — leaden, settled · Bass drone synth — earthen · Cello in low register — patient, weighted · Bass marimba pulse — measured · Subharmonic pad — geological |
| **Sun** | Orchestral swell — full, resolved · Brass + strings unison — radiant · Full choir "ah" — luminous · Pipe organ tutti — golden · Trumpet + horn unison — bright halo · Wide string chorale — open, completed · Bell + strings — proclamatory |

---

## Layer 2 — Atmosphere

### Input: `state.weather.condition` (14 enum values)

Source enum: `apps/shared/src/state.ts → WeatherCondition`. Each row picks one Reverb, one Dynamics, one Color/added timbre.

| Condition | Reverb (pick one) | Dynamics (pick one) | Color / added timbre (pick one) |
|---|---|---|---|
| **`clear`** | Small chamber + air · Warm hall · Tape echo with long decay · Medium plate · Convolution of an empty hall · Soft spring reverb · Cathedral with HF rolloff | mp steady · mf with subtle taper · mp with slight crescendo · mp throughout, no swell · mp → mf and back · pp crescendo to mp · mf even, unhurried | Bright pad halo · Acoustic guitar resonance · Soft glockenspiel sparkle · Sustained string shimmer · Gentle high pad · Plucked harp accents · Light vibraphone halo |
| **`mainly-clear`** | Small chamber · Warm hall short · Plate medium · Soft spring · Convolution of porch space · Tape with light flutter · Wood room | mp steady · mp with light taper · mp → mf and back · mp throughout · mf relaxed · mp pulsing gently · pp → mp easy | Soft string halo · Felt piano resonance · Light flute air · Subtle vibraphone · Plucked guitar overtones · Bright pad with rolloff · Distant horn halo |
| **`overcast`** | Long warm hall · Cathedral with HF rolloff · Wet plate · Damped chamber · Long convolution + soft tail · Slow spring · Cloth-damped room | mp held, no crescendo · pp throughout · mp slightly darker · mp without taper · pp → mp very gently · mp dim · mp pillowy | Low pad shadow · Felt piano with damper · Cello drone · Bass clarinet wash · Soft synth pad cloud · Tape hiss bed · Sustained warm strings |
| **`fog`** | Cathedral with HF rolloff · Long convolution + felt damping · Wet plate · Cloth-damped chamber · Tape with extreme low-pass · Wide hall + low-pass · Underwater convolution | pp throughout · pp very held · ppp → pp · pp in deep stillness · pp without articulation · pp barely audible swell · pp diffuse | Sustained low pad · Bowed cello drone · Sub bass swell · Bass clarinet hum · Soft choir pad · Felt piano sus pedal · Air-only flute breath |
| **`drizzle`** | Soft plate · Small chamber + light air · Tape with subtle wow · Spring with short decay · Medium hall damped · Wood-room reverb · Convolution of a porch | mp gently pulsing · mp with light articulation · pp → mp soft · mp uneven, natural · mp damped · mp threaded · mp filtered | Light pizzicato pulses · Soft vibraphone droplets · Marimba pattering · Felt piano staccato · Plucked harp arpeggios · Light glockenspiel taps · Brushed cymbal patter |
| **`freezing-drizzle`** | Bright cold plate · Glassy chamber · Tape with hiss · Short bright reverb · Cold convolution · Spring tight · Wide cold air | pp brittle · mp glassy · pp → mp tinged · mp held with cold edge · pp crystalline · mp icy steady · pp suspended | Glass harmonica points · Crystal bell taps · Cold synth pad · Bowed crotales · Detuned glockenspiel · Sine-wave high pings · Tubular bell points |
| **`rain`** | Long warm hall · Tape with longer decay · Plate with depth · Cathedral damped · Convolution of overhang · Wet spring · Wide chamber + air | mp with steady pattering · mp held under pulse · mp → mf gentle build · mp continuous · mp with surface motion · mp rolling under · mp diffuse | Filtered noise bed · Pizzicato cluster · Marimba rolls · Brushed snare patter · Felt piano repeated notes · Soft synth pulse · Tabla-like soft taps |
| **`freezing-rain`** | Cold plate medium · Glassy hall · Tape with sleet hiss · Bright spring · Short cold reverb · Convolution of icy porch · Tight cold chamber | mp brittle pulse · mp with edge · pp → mp pinched · mp glassy steady · mp held + iced · mp clicking subtly · pp ringing | Crystal bell pulse · Cold synth ping · Detuned music box · Bowed metal · Glass percussion · High piano with damper · Glockenspiel + filtered noise |
| **`rain-showers`** | Plate with light air · Short hall · Tape with intermittent flutter · Spring + air · Convolution + wet damping · Wide room with rolloff · Soft chamber + bright tail | mp surging gently · mp → mf and back · mp uneven, natural · mp pulsing in waves · pp → mp → pp · mp building briefly · mp threaded with gusts | Soft pizzicato bursts · Felt piano patter + rest · Vibraphone droplets · Brushed kit + soft cymbal · Marimba arpeggios · Light synth pulse · Plucked guitar bursts |
| **`thunderstorm`** | Cathedral with rumble · Long deep hall · Plate with rumble bed · Tape echo + sub thump · Convolution of distant thunder · Spring with low growl · Wide hall + sub | mp under rumble · mp → ff sudden accent · mp held with deep low · mp with intermittent f · mp with sub pulses · mp swelling unevenly · mp + ff thunder accents | Sub-bass swells · Low timpani rolls · Distant brass clusters · Bowed contrabass tremolo · Detuned low piano · Synth bass pulse · Bass drone + low choir |
| **`thunderstorm-hail`** | Cathedral with rumble + sleet noise · Long deep hall + ice clatter · Plate with rumble + hiss · Tape + crackle layer · Convolution of metal awning · Spring + cold high noise · Wide hall + ice | mp under rumble + sharp hits · mp → ff abrupt · mp with sharp irregular accents · mp + ff stabs · mp surging + crackle · mp held + percussive bursts · mf piercing accents | Sub bass + glockenspiel taps · Timpani + crotales · Low strings + woodblock · Contrabass + ride bell · Synth bass + glass percussion · Low brass + tubular bells · Detuned low piano + high cluster |
| **`snow`** | Long warm hall · Tape with HF rolloff · Cathedral damped · Cloth-damped chamber · Convolution of snow-blanketed space · Wet plate · Wide soft hall | pp throughout · pp very held · ppp → pp soft · pp dim and quiet · pp pillowed · pp suspended · pp slowly breathing | Sustained warm strings · Felt piano sus pedal · Choir pad · Bass clarinet hum · Soft synth bed · Bowed vibraphone · Cor anglais drone |
| **`snow-grains`** | Tape with light hiss · Plate with subtle high noise · Spring damped · Soft chamber + powder · Convolution of muffled outdoor · Wet plate + light hiss · Cathedral with rolloff | pp tessitura with grain · pp with soft noise bed · pp → mp very small · pp with surface texture · pp held + grain · pp filtered · pp threaded | Filtered white-noise bed · Brushed snare grain · Soft glockenspiel taps · Light filtered hiss + pad · Granular synth · Sine pings + air · Bowed vibraphone with bow noise |
| **`snow-showers`** | Wet plate · Cathedral damped · Tape with HF rolloff · Wide soft hall · Convolution of outdoor + flurry · Cloth-damped chamber · Spring damped | pp with soft surges · pp → mp wave · pp held with light pulse · pp building briefly · pp uneven, natural · pp pillowed and breathing · pp threaded with gusts | Soft choir pad · Bowed vibraphone bursts · Felt piano repeated soft notes · Bass clarinet + flute drone · Sustained low pad · Brushed cymbal swell · Plucked harp soft pulses |

### Input: `state.weather.tempC` (continuous → 5 buckets)

Bucketing: `cold` < 5 °C; `cool` 5–14 °C; `mild` 15–22 °C; `warm` 23–28 °C; `hot` > 28 °C.

| Bucket | Tonal warmth (pick one) |
|---|---|
| **cold** | Cold cello drone — bowed long · Glass harmonica — clear, brittle · Bass clarinet — dark and dry · Sub bass + filtered noise · Detuned synth pad — chilled · Bowed crotales — icy points · Solo cor anglais — austere |
| **cool** | Felt piano + warm pad blended cool · Muted trumpet — cool but warmed · Cor anglais + soft strings · Vibraphone with slow tremolo · Soft choir pad — pale · Plucked harp — clean · Soft synth pad — neutral light |
| **mild** | Acoustic guitar resonance · Nylon guitar + soft strings · Felt piano — even · Vibraphone — relaxed · Soft brass halo · Light flute air · Warm pad — neutral |
| **warm** | Rhodes + warm strings · Tenor saxophone — round · Acoustic guitar + warm pad · Flugelhorn — warm bronze · Warm synth pad — analog · Cor anglais — golden · Soft horn section — round |
| **hot** | Hammond organ — saturated · Brass section — bright + warm · Tenor sax + electric piano — burnished · Distorted warm pad · Solo trumpet — warm vibrato · Wide warm strings · Synth pad — saturated analog |

### Input: `state.weather.humidityPct` (continuous → 3 buckets)

Bucketing: `dry` < 40%; `moderate` 40–65%; `humid` > 65%.

| Bucket | Air density (pick one) |
|---|---|
| **dry** | Sparse texture, lots of air · Few voices, tight stereo · Open mid range with silence · Dry articulation, no reverb tail · Bone-dry plate — close mic · Solo voice over thin pad · Spacious arrangement, breathing rests |
| **moderate** | Normal texture, balanced air · Standard reverb tail · Mid-density arrangement · Even stereo field · Layered but breathing · Moderate sustain · Balanced wet/dry |
| **humid** | Thick texture, heavy air · Layered pads + sustained voices · Wet reverb tails · Saturated stereo field · Reverberant low end · Densely overlapping voices · Heavy sustain pedal feel |

### Input: `state.weather.precipitationMmHr` (continuous → 4 buckets)

Bucketing: `none` = 0; `light` 0–2 mm/hr; `moderate` 2–7 mm/hr; `heavy` > 7 mm/hr.

| Bucket | Texture overlay (pick one) |
|---|---|
| **none** | None — clear surface · Faint pad bed only · Soft sine drone · Tape hiss — minimal · Sustained string air · Soft choir suspension · No texture overlay |
| **light** | Soft pizzicato patter · Felt piano repeated notes · Marimba droplets · Brushed cymbal grain · Vibraphone soft pulses · Light synth pulse — even · Plucked harp arpeggios |
| **moderate** | Filtered noise bed — steady · Pizzicato cluster — rolling · Marimba rolls · Brushed snare pattern · Soft synth pulse — denser · Felt piano repeated chords · Tabla-like soft tapping |
| **heavy** | Wide filtered noise bed · Low timpani rolls · Bowed contrabass tremolo · Distorted low pulse · Sub-bass surges · Synth bass + noise layer · Choir pad + low rumble |

### Input: `state.weather.cloudCoverPct` (continuous → 3 buckets)

Bucketing: `clear` < 25%; `partial` 25–75%; `overcast` > 75%.

| Bucket | Brightness mask (pick one) |
|---|---|
| **clear** | Bright pad halo · High glockenspiel sparkle · Sustained high strings · Light vibraphone shimmer · Crystal bell points · Bright synth pad · Plucked harp high accents |
| **partial** | Soft pad with rolloff · Mid-range string halo · Light flute air · Felt piano resonance · Vibraphone — neutral · Soft synth pad · Cor anglais halo |
| **overcast** | Low pad shadow · Bass clarinet wash · Cello drone · Felt piano with damper · Tape hiss bed · Sustained warm strings · Soft synth pad cloud |

### Input: `state.weather.windMps` (continuous → 4 buckets)

Bucketing: `calm` < 2 m/s; `breezy` 2–7 m/s; `windy` 7–14 m/s; `gale` > 14 m/s.

| Bucket | Motion modulation (pick one) |
|---|---|
| **calm** | Static voicing — no movement · Sustained held chord · Slow LFO on pad — barely audible · No tremolo · Stationary stereo image · Held string section · Dronelike pad |
| **breezy** | Gentle tremolo on strings · Slow LFO on pad — drift · Soft side-to-side stereo motion · Felt piano with light release · Vibraphone slow tremolo · Bowed vibraphone gentle drift · Cor anglais soft vibrato |
| **windy** | Wider tremolo on strings · Faster pad LFO — visible motion · Stereo movement — left/right sweep · Brushed cymbal swells · Synth pad with filter sweep · Vibraphone wide tremolo · Pitched air gusts in flute |
| **gale** | Aggressive tremolo · Fast LFO sweeps · Wide stereo motion + delays · Cymbal swells + crashes · Pitch-shifted noise gusts · Filter automations big · Brass swells with vibrato |

### Input: `state.weather.isDay` (boolean)

| Value | Lighting (pick one) |
|---|---|
| **true** | High-register voicing · Bright timbres prioritized · Sparse, lit arrangement · Daylight EQ — open mids and highs · Acoustic instruments forward · Ride cymbal sparkle · High strings + flute layer |
| **false** | Low-register voicing · Dark timbres prioritized · Dense, shadowed arrangement · Nighttime EQ — rolled-off highs · Synth pads forward · Bowed bass + brushed kit · Felt piano + sub bass layer |

### Input: `state.weather.sunriseProximityMin` & `state.weather.sunsetProximityMin` (continuous → bucket if near)

Bucketing: `near` if `|proximity| ≤ 30` minutes; otherwise no accent. Both can fire simultaneously (rare); if both, pick one randomly via the next available quantum byte.

| Bucket | Threshold accent (pick one or none) |
|---|---|
| **near sunrise** | Slow choir swell rising — pp → mp · Solo cor anglais ascending phrase · Bowed cymbal swell — crescendo · Pad opening from low to high register · Soft brass swell — crescendo · Glockenspiel + harp ascending arpeggio · Light strings ascending in fifths |
| **near sunset** | Slow choir swell descending — mp → pp · Solo cor anglais descending phrase · Bowed vibraphone fade · Pad closing from high to low register · Soft brass swell — diminuendo · Glockenspiel + harp descending arpeggio · Warm strings descending in fifths |
| **no accent** | (no element drawn — skip threshold accent) |

---

## Layer 3 — Body

### Input: `state.body.activity` (4 values)

Source enum: `MotionClass`.

| Activity | Tempo adjustment (pick one BPM, stacks on L1) | Articulation (pick one) |
|---|---|---|
| **`still`** | −20, −18, −16, −14, −12, −10 | Legato, fully sustained · Molto legato · Tenuto throughout · Sostenuto · Smooth, held · Unbroken legato · Legatissimo |
| **`walking`** | −2, −1, 0, +1, +2, 0 (with rubato) | Light staccato, natural · Détaché · Portato · Gentle staccato · Mezzo staccato · Lightly articulated · Natural separation |
| **`running`** | +20, +22, +24, +26, +28, +30 | Marcato, accented · Staccatissimo · Sforzando per beat · Accented détaché · Pesante · Martellato · Accented marcato |
| **`vehicle`** | +6, +8, +10, +12, +14, +9 | Smooth, continuous · Legato glide · Tenuto, continuous · Sostenuto, smooth · Non-articulated flow · Cantabile · Connected legato |

### Input: `state.body.motion` (4 values)

Source enum: `MovementPattern`. Distinct from activity — describes the *texture* of motion in the device (variance + autocorrelation).

| Motion | Phrase shape (pick one) |
|---|---|
| **`still`** | Long sustained phrases — no rhythmic emphasis · Drone-like flat phrases · Slow-moving block harmonies · Pad-only melodic motion · Unrhymthmic suspension · Held chord with slow inner motion · No rhythmic figure — pure tone |
| **`steady`** | Even regular phrasing — predictable cadence · Walking phrases — measured · Ostinato-style consistency · Pulsed quarter-note phrases · Even half-note phrases · Steady eighth-note motion · Lightly syncopated but predictable |
| **`rhythmic`** | Strong rhythmic ostinato · Cross-rhythm patterns — interlocking · Polyrhythmic layers — 3 against 2 · Driving syncopated patterns · Rhythmic hocket between voices · Pulsing cyclic patterns · Compound meter feel |
| **`erratic`** | Broken phrasing — sudden stops · Irregular rhythmic groupings — odd meters · Fragmented melodic lines · Jittery cross-rhythms · Asymmetric phrase lengths · Polyrhythmic conflict · Rubato with sharp dynamic shifts |

### Input: `state.body.intensity` (3 buckets)

Already bucketed by transform (`low`, `moderate`, `high`).

| Intensity | Dynamic range / amplitude (pick one) |
|---|---|
| **`low`** | Quiet throughout — pp to mp range · Narrow dynamic range — flat at p · Sparse arrangement — few voices at once · Long sustained quiet phrases · Whisper-quiet ambient feel · pp dynamics throughout · ppp suspension |
| **`moderate`** | Mid-range dynamic span — mp to mf · Balanced expressive range · Standard ensemble density · mp baseline with mf highlights · Comfortable mid dynamic level · mp throughout with light swells · mf relaxed |
| **`high`** | Wide dynamic range — pp to ff · Dense arrangement, all voices active · Strong expressive contrasts · Dramatic crescendos · ff peaks frequent · Energetic and forward · Loud, full ensemble at mf to ff |

---

## Final BPM → classical term mapping

Fixed musicological lookup, intentionally not expanded. Final BPM is L1 base + L4 activity adjustment.

| Final BPM range | Classical term + context |
|---|---|
| 24–45 BPM | Grave — deep night/witching + still |
| 45–60 BPM | Lento — night + still, or heavy weather |
| 60–66 BPM | Larghetto — night base, witching base |
| 66–76 BPM | Adagio — slow movement, fog, still morning |
| 76–108 BPM | Andante — morning/dusk baseline, walking |
| 108–120 BPM | Moderato — noon baseline |
| 120–156 BPM | Allegro — noon + running, or vehicle (app cap) |
| 156–176 BPM | Vivace — edge case only, cap here |

---

## Final prompt structure

The worker assembles all picks into a single directorial block prefixed to (or merged into) the system prompt before calling `compose_song`:

> *Compose an instrumental piece. Tempo: [L1 base ± L3 activity adjustment → classical term + BPM]. Key: [L1 phase]. Instrumentation: [L1 phase base + L1 day accent + L2 condition color + L2 weather continuous timbres (tonal warmth + air density + brightness mask + motion modulation + lighting + threshold accent if any)]. Reverb: [L2 condition reverb]. Dynamics: [L2 condition dynamics + L3 intensity dynamic range]. Articulation: [L3 activity articulation]. Phrase shape: [L3 motion phrase shape]. Texture overlay: [L2 precipitation overlay]. Sections must explicitly embed BPM (or a narrow range), key/mode, lead instrumentation, and intensity descriptor in the prose.*

Each bracketed value is drawn independently from its source layer's option list using the song's quantum bytes. The L1 → L3 BPM combination then maps deterministically to the classical term in the BPM table above.

Location context (`state.location.placeType`, `place.type`, `place.name`, `city`, `country`), `userInput`, `vibes`, `nearby`, and `recentHistory` are appended to the prompt as context for Claude to read alongside the picks — they shape prose and intent without changing the deterministic musical scaffolding.

Claude's role: honor the constraints, but choose how — section count, prompt prose, transitions, intros and outros, modal flavoring within the chosen key, dynamic arc within the dynamic range. Treat the constraints as a constellation, not a recipe.
