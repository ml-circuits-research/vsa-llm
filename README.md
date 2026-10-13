# vsa-llm: model de limbaj HDC care învață din text

Experimentul din `hdclm/` implementează specificația „Model de limbaj HDC din text (v1.0)”, copiată în `hdclm/SPECIFICATIE.md`. Viziunea autorului e în `vision/vision.md`.

**Întrebarea de cercetare:** poate un sistem să traducă singur textul din ecuații cu atomi de poziție și de tokeni (cuvântul 1, cuvântul 2, …) în ecuații cu atomi de structură și de sens? De exemplu, `PLACE(agent=Ada, loc=mill)`, unde reformulările („rests in”, „lingers in”, „is hiding in”) dau aceeași ecuație. Totul fără reguli de limbă scrise de mână, doar prin comprimare (MDL), cu vectori HDC care propun ipoteze.

Acest fișier spune cum se rulează, ce s-a făcut și unde s-a ajuns, ca lucrul să poată continua pe alt calculator.

---

## 1. Cum se rulează

**Cerințe:** Node.js ≥ 20 (testat pe 22.22). Nu e nevoie de `npm install`: nu există dependențe, se folosesc doar modulele Node (`fs`, `path`, `assert`, `test`, `worker_threads`, `os`, `url`).

```bash
git clone https://github.com/ml-circuits-research/vsa-llm
cd vsa-llm && git checkout ccr-452dc26f-vdua28      # branch-ul de lucru
cd hdclm

npm test                                           # regresii + obiective semantice (intenționat roșii acum)
npm run test:unit                                  # numai regresiile mecanismelor și evaluatorului
npm run eval:goals -- --out runs/goals-v1            # evaluare a țintei generale pe semințele 1,2,3
```

**Ținta generală este fixată prin TDD în [hdclm/GOALS.md](hdclm/GOALS.md).** Suita cere canonizare pe intrări nevăzute, grafuri semantice compoziționale, negație și cuantificare, ambiguitate, text liber în mai multe domenii și raționament numai peste grafuri. Eșecurile sunt aserțiuni reale, fără `skip`/`todo`, și intră în `npm test`. Acest set este public de dezvoltare, nu un benchmark orb.

### Chat CLI: vezi ce poate modelul acum

Din rădăcina proiectului:

```bash
npm --prefix hdclm run chat
npm --prefix hdclm run chat -- --profile algoritm
npm --prefix hdclm run chat -- --empty
npm --prefix hdclm run chat -- --load ./corpus.txt --max-tokens 24
```

Implicit se antrenează pe partea de antrenare a setului sintetic G7, apoi afișează o întrebare de test pe care o poți încerca. Folosește mecanismul existent de tipare și variabile, local, fără LLM extern. Răspunsul este completarea unei reguli învățate, cu argumentele și finalul păstrate împreună. Dacă nu există o completare determinată sau regulile propun răspunsuri diferite, chatul spune că nu poate determina răspunsul. Nu are încă înțelegerea conversațională a unui chatbot general. Memoria sesiunii nu se salvează automat.

Exemple în sesiune:

```text
Ana has the book. Who has the book?
/why
/context
Ana has the pen.
Who has the pen?
/context
/next Ana has the book. Who has the book?
/continue Ana has the book. Who has the book?
/inspect Ana has the book.
/patterns
/stats
/teach Ada reads the report.
/teach Boris reads the report.
/sleep
/next Ada reads the
/help
/quit
```

Întrebările se termină cu `?`. Celelalte mesaje se păstrează în contextul conversației, fără antrenare; astfel poți introduce un enunț și apoi pune întrebarea separat. `/why` afișează regulile folosite sau motivul abținerii. Acest control al interfeței nu este o regulă semantică despre vocabular.

`/continue TEXT` folosește generarea liberă de tokeni, care poate fi incoerentă. `/next` afișează primii 5 tokeni și probabilitățile. `/inspect` arată vocabularul cunoscut, tiparele recunoscute, umplerile și cheile canonice actuale; acestea nu sunt încă grafuri semantice complete. `UNK` înseamnă token necunoscut, iar `EOT` sfârșitul textului. `/context TEXT` setează contextul fără să îl învețe; `/context` îl șterge. `/load CALE` citește un fișier UTF-8, iar `/sleep` caută tipare. Întrebările și continuările generate nu se adaugă la antrenare. `/demo G8` înlocuiește memoria cu alt set sintetic; `/reset` o golește.

**Experimentele** scriu în `runs/<experiment>/result.json`. `runs/` nu e în git. Cu `HDCLM_TAG=nume`, rezultatele merg în `runs/nume/<experiment>/`.

```bash
node src/cli.mjs experiment A --seed 1               # blocul A (A1–A7), configurarea implicită
node src/cli.mjs experiment A,G10 --seed 2           # mai multe experimente
node src/cli.mjs experiment FORMAL --seed 1          # formalizarea pe GPARA și BABI2
node src/cli.mjs experiment BLIND --seed 1                           # set de control GBLIND
node src/cli.mjs experiment BLIND --seed 1 --set blindSet=GBLIND2    # set de control GBLIND2

# profilul cel mai bun de acum (ALGORITM.md, D21–D26); deocamdată nu e implicit, vezi secțiunea 4
node src/cli.mjs experiment BLIND --seed 1 --profile algoritm
node src/cli.mjs experiment A,G10 --seed 1 --profile algoritm

# orice parametru din config/default.json se poate suprascrie
node src/cli.mjs experiment FORMAL --seed 1 --profile algoritm --set maxDeepPasses=40
```

**Durate orientative** (un nucleu): blocul A ~1 minut, FORMAL ~5 minute, BLIND ~2–5 minute pe sămânță. Pe calculator se pot rula în paralel mai multe semințe (câte un proces fiecare), cum s-a făcut aici.

**Diagnostic** (`tools/diag/`, cu README): de ce lipsesc reguli, ce clase se contopesc, ce întrebări pică.

```bash
OV='{"judgeAll":true}' node tools/diag/blinddiag.mjs 1        # QA pe antrenare / test / puse deoparte, regulile
FAILS=1 SET=GBLIND2 node tools/diag/blinddiag.mjs 2           # și întrebările greșite, cu clasele
HDCLM_TRACE=1 node ...                                        # urma formării claselor (classLift) pe stderr
```

**Date:**
- seturile G1–G11, GPARA, GBLIND, GBLIND2 se generează din cod (`src/data/`), după sămânță;
- bAbI qa1 e în `data/babi/`;
- tokenizerul GPT-2 e în `data/gpt2/`;
- TinyStories nu e în git (19 MB), se descarcă după `data/tinystories/README.md`.

**Determinism:** aceeași sămânță dă aceleași fișiere, octet cu octet.

---

## 2. Unde e ce

| Fișier | Conținut |
|---|---|
| `hdclm/SPECIFICATIE.md` | specificația v1.0 (modelul de date, somnul, invarianții I1–I15, experimentele) |
| **`hdclm/ALGORITM.md`** | **definiția algoritmului, aprobată**: limbajul ecuațiilor (operatorii O1–O7), criteriul unic, bucla traducere/descoperire, rolul HDC, limitele, planul |
| `hdclm/DECIZII.md` | deciziile D1–D26, fiecare cu context, alegere, dovezi, consecințe și revizuire, inclusiv cele care au picat |
| `hdclm/REZULTATE.md` | toate rezultatele, în ordine, cu preînregistrările seturilor oarbe |
| `hdclm/PLAN.md` | planul inițial pe blocuri (A–F din specificație) |
| `hdclm/PROPUNERI_LACUNE.md` | propunerile pentru morfologie (MAP), negație și distanțe lungi |
| `hdclm/ANALIZA_PARAFRAZE.md`, `OPTIMIZARI.md` | analiza reformulărilor; optimizările de viteză |
| `hdclm/config/default.json` | parametrii impliciți (comportamentul din specificație) |
| `hdclm/config/profiles/algoritm.json` | profilul ALGORITM (opțiunile noi împreună) |
| `hdclm/src/memory/` | memoria: atomi, tipare, clase, alegeri tipizate, commit, mărimi, concepte |
| `hdclm/src/sleep/` | somnul: grupare, propuneri, judecată, alternative, concepte, tipuri, inducție, judecata unică |
| `hdclm/src/predict/` | predicția (următorul token) |
| `hdclm/src/hdc/`, `src/memory/vectors.mjs` | strategiile HDC (bipolar, phasor, binar) și vectorii |
| `hdclm/src/eval/experiments/` | experimentele (A1–A7, B1–B5, C1–C3, G10, G11, FORMAL, BLIND, BABI1, S1) |
| `hdclm/tools/diag/` | scripturi de diagnostic |

---

## 3. Ce s-a făcut (pe scurt, în ordine)

1. **Specificația, implementată și verificată:** memoria cu atomi, tipare, alegeri, commit cu un singur scriitor și invarianți, somnul (recunoaștere, grupare, propunere, judecată MDL) și predicția din patru surse. **Blocul A trece** pe trei semințe (A1–A6, A7 parțial).
2. **Măsura în biți și interpretările multiple (D5–D7):** apar regulile generale din specificație.
3. **Blocul B (vectorii HDC):** strategiile bipolară, phasor și binară trec proprietățile H1–H8 (I13). Vectorii reproduc asemănarea exactă.
4. **Blocul C:** tokenizerul GPT-2, TinyStories, granițele de propoziție (D12–D13). Pe TinyStories, predicția (7,8 biți) e încă sub bigram (7,0).
5. **Formalizarea și unificarea semantică** (cererea principală a autorului):
   - clase de tipare cu roluri comune (D15, schimbarea lui I5);
   - concepte din comportament (analiza formală a conceptelor, D17);
   - alegeri tipizate: tipul unui loc este un concept (D18);
   - inducție prin consecințe (D19);
   - judecata unică a generalizărilor (D20).
6. **Seturile de control oarbe** (P2: proiectate înainte, rulate o singură dată):
   - **GBLIND** a picat (QA 5–14%). Diagnosticul a arătat că rezultatele de pe GPARA fuseseră potrivite pe acel set.
   - Reparații generale: curriculum pe niveluri (D21), alternative pe înșiruiri (D22), despărțirea grupurilor (D23).
   - **GBLIND2**, testul de decizie preînregistrat, a picat la QA, dar unificarea reformulărilor s-a generalizat (1–3% → 58–100%).
   - Contopirea capcanelor venea din înlănțuirea claselor; reparată cu Jaccard (D24).
7. **ALGORITM.md (aprobat):** un limbaj închis de operatori, un singur criteriu, o singură buclă. Judecata unică acum peste tot (D25). Costul alegerii dintre N candidați (D26), ca să nu apară tipare pe text fără structură.

---

## 4. Unde s-a ajuns

Cu `--profile algoritm`. GPARA, GBLIND și GBLIND2 sunt de acum seturi văzute; detaliile sunt în `REZULTATE.md`.

| Set | Măsura | Implicit | Profil ALGORITM |
|---|---|---|---|
| Blocul A | A1–A6, G10 | trec | trec |
| | A7 (câte propoziții între fapt și întrebare) | 1 / 2 / 5 | 1 / 5 / 5 |
| GPARA | reformulări cu aceeași ecuație / QA puse deoparte | 58% / 63% | **100% / 100%** |
| GBLIND | reformulări / capcane contopite / QA | 5–47% / până la 71% / 7–14% | **100% / 0% / 56–69%** |
| GBLIND2 | reformulări / capcane contopite / QA | 0–3% / 0% / 6–11% | **60–82% / 0% / 23–30%** |
| BABI2 | QA | 45% | **31% (mai prost)** |

**Ce merge:**
- Sistemul descoperă singur formele propozițiilor, clasele de sinonime (PLACE = {rests in, lingers in, hurried, …}), formulările echivalente ale întrebărilor, rolurile comune și regulile de poveste.
- Pe date nevăzute, reformulările primesc aceeași ecuație și capcanele („is leaving”, „dreams of”, „looked at”, „is not in”) rămân separate.
- Textul se reface exact.

**Ce nu merge încă:**
1. **QA pe povești cu număr variabil de fapte.** Regulile au lungime fixă, deci poveștile cu 3–4 fapte rămân fără regulă (pe GBLIND2: 0 din 14 povești cu 4 fapte, chiar și pe antrenare).
2. **BABI2.** „Ultimul fapt despre X” cere ordinea în timp. Profilul acceptă „oricare fapt despre X” ca distractor.
3. **Vectorii HDC încă nu ajută la generalizare.** Prin construcție (I13) copiază asemănarea exactă: pe GBLIND, cu sau fără vectori, rezultatul e identic. Rolul lor de generator de ipoteze e planificat (ALGORITM.md §5), nu e făcut.
4. **Text liber (TinyStories):** predicția e sub bigram.

---

## 5. Pașii următori (ALGORITM.md §9)

1. **O6, mulțimea de fapte** (aprobat, schimbă modelul de date). O poveste devine o mulțime de fapte cu timpul ca rol, iar regulile devin interogări peste mulțime: `Q(x) ∧ F(x, p) ∈ S ⇒ p`. În HDC: poveste = Σ bind(fapt_i), răspuns = unbind. Ar trebui să rezolve punctele 1 și 2 de mai sus.
2. **HDC ca generator de candidați** pentru sinonime (O4) și tipuri (O5): vecinătăți vectoriale → propuneri; criteriul exact decide.
3. **O7, corespondența (MAP):** carried ↔ carry (G11), oraș → țară.
4. **După fiecare pas, un set orb nou (GBLIND3, …),** proiectat de un subagent sau de altcineva care nu cunoaște mecanismul, cu criteriile scrise în REZULTATE.md înainte de rulare.
5. **Date mai multe:** bAbI qa1–qa3 întreg, apoi TinyStories.
6. **Profilul ALGORITM devine implicit** după ce O6 repară BABI2.

## 6. Reguli de lucru (de păstrat)

- **P1:** dacă alternativa mai generală costă doar minute de cod și de verificare, se alege ea.
- **P2:** nimic codat de mână, nimic falsificat:
  - în codul modelului (`src/sleep`, `src/memory`, `src/predict`, `src/core`) nu apare niciun cuvânt din date;
  - o reparație făcută uitându-te la un set îl face „văzut”;
  - generalitatea se arată doar pe seturi oarbe, rulate o singură dată.
- **Orice opțiune nouă e oprită implicit,** iar configurarea implicită rămâne cea din specificație. O decizie nouă intră în `DECIZII.md` cu dovezi, inclusiv ce a picat.
- **Rezultatele se trec în `REZULTATE.md` așa cum ies.**
