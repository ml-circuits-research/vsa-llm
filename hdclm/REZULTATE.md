# hdclm: implementare și rezultatele blocului A

Implementarea specificației „Model de limbaj HDC din text (v1.0)”, pașii 1–5 din secțiunea 19, cu strategia exactă (fără vectori). Codul stă în acest director și respectă regulile din secțiunea 4: Node.js ≥ 20, fișiere `.mjs`, nicio dependență, `rng(seed)` peste tot.

## Cum se reia pe calculator

```bash
cd hdclm
node --test test/*.test.mjs          # 49 de teste, câteva secunde
node src/cli.mjs experiment A        # A1–A7, câteva secunde
node src/cli.mjs experiment A5,A6    # doar unele
node src/cli.mjs experiment A --seed 2
# variante de parametri (suprascriu config/default.json); HDCLM_TAG pune rezultatele în runs/<tag>/
HDCLM_TAG=bits-alt node src/cli.mjs experiment A --set measure=bits --set alternatives=true
```

Fiecare experiment scrie `runs/<experiment>/result.json`. A5–A7 mai scriu `split.json`, `log.jsonl` (o linie pe trecere de somn) și `atoms.jsonl` (memoria). Două rulări cu aceeași sămânță dau fișiere identice, octet cu octet (verificat pe tot blocul A).

Notă: pe Node 22, `node --test test/` nu merge (ia `test/` drept modul); se folosește `node --test test/*.test.mjs` (și `npm test`).

## Ce este implementat

| Pas | Stare |
| --- | --- |
| 1 | `core` (rng, config, invarianți), `memory/store.mjs` (cele patru feluri de definiții, `intern`, `children`, `unfold`, `commit`), `memory/size.mjs` (termeni și biți, unități derivate) |
| 2 | tokeni-cuvânt, `segment` și `segmentPrefix` din același cod, `ingest`, generatorul G1–G9 (fără G6) |
| 3 | `similarity.mjs` (simC, simE), `recognize`, `group`, `propose`, judecata în pachet, `sleepPass`, somn adânc (modul simplu) |
| 4 | `nextToken` cu cele patru surse, suma pe primul token, recursia pe niveluri; `generate` |
| 5 | ridicarea (un nivel), locurile legate, tiparele cuibărite, unitățile derivate (mărime 0) |
| 6–8 | neîncepute: specificația cere întâi ca blocul A să treacă |

Testele acoperă invarianții I1–I8, I10–I12 și I15, cazurile de aur (G1: 2 tipare, o alegere cu 10 membri, 56 de termeni; G4: niciun tipar; G7: regula cu un loc legat), exemplul 60/63/56, predicția (sumă 1, niciun 0, „Ana”+„Anca” → [An] 0,6, Paris → France), determinismul și împărțirea datelor.

## Interpretări și abateri (de hotărât de autor)

1. **Tăierea propoziției.** Tokenul de închidere este ultimul copil al unității pe care o închide. O propoziție fără virgulă ia direct copiii părții ei unice, deci „Ana reads.” = `[Ana, reads, .]`, ca în exemplul din secțiunea 3. Altfel ar ieși `[[Ana, reads], .]`, iar G1 n-ar da 56.
2. **Tokeni-cuvânt fără spațiu în text.** Identitatea tokenului nu include spațiul (`Ana` la început și ` Ana` în mijloc sunt același token). Altfel locul legat din G7 nu se poate lega. În modul GPT-2 problema va reapărea.
3. **Departajarea grupurilor.** Ordinea din specificație este: mai puține poziții libere, apoi grupuri mai mari, apoi cheia. Am pus înaintea cheii un criteriu nou: **câte locuri rămân după ridicare și legare** (mai puține înseamnă aplicări mai scurte). Fără el, pe G7 câștigă la egalitate gruparea „povești cu același răspuns” în locul celei cu „aceeași întrebare”, iar regula nu apare deloc (total 630, față de 347 cu criteriul).
4. **Câștigul unui tipar include tot ce depinde de el.** Exemplu: tiparul `[S, .]` are câștig −2 luat singur, dar fără el dispar regulile din G7, deci câștigul lui real este mare.
5. **Unități cu un singur copil, la predicție.** Nu se creează, dar memoria numără de câte ori au apărut (`single[nivel]`), ca să poată vota SFÂRȘIT. De exemplu, cuvântul „Ana” dintr-un singur token.
6. **Nivelurile 2 și 3 contopite la predicție.** Cât timp propoziția nu are încă o virgulă, unitatea deschisă este votată de unitățile de pe ambele niveluri.
7. **Predicția pornește de la cel mai de jos nivel cu prefix nevid.** Altfel, după „…?”, cuvântul gol de jos ar pierde contextul.
8. **Lipsuri cunoscute:**
   - perechile ( [ { „;
   - ridicarea pe mai mult de un nivel (`d_max` > 1 nu are efect);
   - locurile puse de unitățile deschise de deasupra, la predicție: din cauza asta generarea după „Ana” continuă propoziția în loc să pună „.”;
   - în somnul adânc: rejudecarea tiparelor vechi și înlocuirea cu interpretări alternative (alternativele se păstrează, dar nu se folosesc);
   - firele de execuție;
   - în măsura în biți, efectul membrilor noi asupra costului aplicărilor altor tipare se ignoră la judecată.

## Rezultate, blocul A (sămânța 1, configurarea implicită)

| Exp. | Rezultat | Decizie |
| --- | --- | --- |
| A1 G1 | 2 tipare (`[S, reads, .]`, `[S, writes, .]`), o alegere cu toate cele 10 nume (inclusiv cele puse deoparte, prin contopirea alegerilor); refacere 100%; eroare pe propozițiile puse deoparte 2,13 → 1,76 biți/token. Total: **48 → 48** în termeni, 233 → 147 în biți | **pică în termeni** (totalul doar nu crește), **trece în biți** |
| A1 G2 | 10 tipare cu un loc (`[S, reads, the, book, .]`, …), o alegere; total 400 → 220; eroare 1,81 → 1,67 | **pică** în ambele măsuri: nu apare tiparul cu două locuri |
| A2 | pachet: 60 → 56; una câte una: 60 → 60, niciun tipar | **trece**: pachetul rămâne |
| A3 | `[S, is, the, capital, of, S, .]`; țara corectă iese prima în 20 din 20 (și fără somn: 20 din 20, din vot) | **trece** |
| A4 | pe G4, 0 tipare la orice w din {0 … 2}, cu și fără înghețare | **trece**; pe G4 înghețarea nu schimbă nimic, deci A4 nu hotărăște w |
| A5 | cu locuri legate: **100%** (15/15 test, 15/15 validare; fără somn 67%); fără locuri legate: 60% | **trece**; locurile legate sunt necesare |
| A6 | f_max = 2: 60% (ca fără somn); f_max = 3: 100%; **date echilibrate, f_max = 2: 100%** | **pică cu valorile de pornire** (vezi mai jos: cauza este dezechilibrul datelor, nu f_max) |
| A7 | 0% la orice număr de propoziții între fapt și întrebare; pe nivelul 4 nu apare niciun tipar | **pică**: sistemul leagă doar ce stă aliniat |

### Ce înseamnă

- **Mecanismul de bază merge.** Internare, refacere exactă, judecată în pachet (exact 60/63/56), alegeri contopite care generalizează la combinații nevăzute, reguli cu loc legat (A5 100%), niciun tipar pe text fără structură.
- **A1 G1 în termeni** pică la limită: cu 8 nume pe verb, cele două tipare costă exact cât înșiruirile (10 + 2·3 + 16·2 = 48). În biți totalul scade clar. Este un argument pentru măsura în biți (D1).
- **A1 G2 este problema de mecanism.** Specificația spune deja că în termeni tiparul cu două locuri „nu se plătește aproape niciodată”. În implementare, tiparul nici nu ajunge să fie propus, oricare ar fi măsura: gruparea ia întâi grupurile cu o singură poziție liberă, iar o unitate intră doar în primul grup. Reparația naturală este cea din secțiunea 10: somnul adânc încearcă interpretarea alternativă (grupul cu `F = {0, 3}`) și o păstrează dacă totalul scade, în biți.
- **A6.** Prima mea concluzie („trebuie f_max = 3”) era prea tare. Cu date echilibrate (toate combinațiile nepuse deoparte în învățare), A6 trece și cu f_max = 2. Cauza reală este cea din secțiunea „Reparația”, mai jos.
- **A7** pică din construcție: povești de lungimi diferite nu se grupează (aceeași lungime, aliniere de la început), iar distractorii diferă. Ține de deplasare (D4) și de un mecanism de „sărire”. Votul singur dă tot 0%.

## Reparația: interpretări alternative în somnul adânc

### Ce s-a adăugat (toate sunt opțiuni, oprite implicit)

| Parametru | Ce face |
| --- | --- |
| `alternatives` | După ce trecerile obișnuite nu mai scad totalul, o *trecere de alternative* regrupează toate unitățile unui nivel, inclusiv cele rescrise deja. Fiecare grup se aplică pe o copie a memoriei, iar câștigul se măsoară pe totalul real (forma exactă). Se păstrează cel mai bun, dacă scade totalul; se repetă până nu mai găsește niciunul. Unitățile cuibărite într-o regulă nu se mută. |
| `altCandidates` | câte grupuri se încearcă pe un nivel (200) |
| `altLookahead` | judecă fiecare alternativă după încă o trecere de somn pe copie (să vadă ce se formează deasupra) |
| `shadowLift` | la ridicare, dacă valorile unei coloane sunt aplicări ale unor tipare diferite, caută un grup pierdut la atribuirea lacomă care le cuprinde pe toate și le mută la tiparul lui |

### Consecințe pentru toată lumea (și cu opțiunile oprite)

- **Definiția totalului s-a schimbat:** un tipar fără aplicări și o alegere nefolosită de niciun tipar viu costă 0. Ele rămân ca atomi (id-urile nu se schimbă), dar nu mai recunosc și nu mai prezic. Rezultatele vechi nu se schimbă, pentru că până acum nu existau tipare moarte.
- **Judecata vede tiparele vechi:** o unitate deja rescrisă poate trece la alt tipar, iar costul tiparului vechi dispare dacă rămâne fără aplicări.
- **Cu măsura în biți, estimarea judecății nu e exactă.** Costul fiecărei aplicări depinde de numărul de tipare și de mărimea alegerilor din toată memoria. La prima încercare, invariantul I8 a oprit o alternativă care creștea totalul real. De aceea alternativele se verifică pe copie. Trecerile obișnuite păstrează estimarea și n-au încălcat I8 în niciun test.

### Rezultate (sămânța 1; în fiecare celulă, varianta implicită a experimentului)

| Configurare | A1 G1 | A1 G2 | A2 | A3 | A4 | A5 | A6 | A7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| termeni (implicit) | pică (48=48) | pică (10 tipare) | trece | trece | trece | **100%** | 60% | 0% |
| termeni + alternative | pică | pică | trece | trece | trece | **100%** | 60% | 0% |
| biți | trece | pică | trece* | trece | trece | 86,7% | 66,7% | 0% |
| **biți + alternative** | trece | **trece** (2 tipare, 2 alegeri comune) | trece* | trece | trece | 86,7% | 66,7% | 0% |
| termeni + shadowLift | pică | pică | trece | trece | trece | 86,7% | 60% | 0% |
| biți + alternative + shadowLift | trece | trece | trece* | trece | trece | 86,7% | 60% | 0% |
| oricare, **date echilibrate** | | | | | | **100%** | **100%** | |

\* în biți fiecare tipar din G1 se plătește singur, deci judecata în pachet nu mai este necesară (nu este nici mai rea).
Rezultatul A1 de mai sus rulează mereu ambele măsuri (G1/G2 în tabel = măsura din rând). Fișierele: `runs/<configurare>/<experiment>/result.json`.

### Ce înseamnă

1. **Reparația merge pentru A1/G2, dar numai în biți.** În termeni tiparul cu două locuri nu se plătește (315 față de 260 de termeni pe G2), cum spunea deja specificația. Alegerea măsurii nu mai e opțională: A1 cere biți.
2. **Biții strică A5 (100% → 86,7%), iar alternativele nu repară asta.** Cauza a apărut din această investigație. Cu datele împărțite 80/10/10, grupurile pe obiect și pe nume nu mai au mărimi egale. Atribuirea lacomă pune unele propoziții „X has the ball.” în tipare pe nume (`[Dan, has, the, S, .]`). În termeni, judecata le respinge (sunt mici), deci unitățile rămân libere. În biți, aproape orice tipar se plătește, așa că rămân, iar regula de paragraf nu se mai poate ridica pentru acele obiecte. Alternativele nu ajung la ea: ar trebui schimbate două niveluri deodată, iar privirea înainte nu ajută, pentru că paragrafele sunt deja rescrise de o regulă mai slabă.
3. **Cu date echilibrate, A5 și A6 trec 100% în orice configurare**, chiar și cu f_max = 2. Deci slăbiciunea mecanismului nu e A6 în sine, ci **sensibilitatea la dezechilibru**: o decizie pe un nivel nu vede câștigul de pe nivelul de deasupra. Pe text adevărat datele nu sunt niciodată echilibrate.
4. **`shadowLift` scoate la iveală o problemă de design, nu de cod.** Cu el apare a doua familie de reguli, la fel de bună ca mărime: „Dan has the S. Who has the S? Dan.” (răspunsul fix) lângă „S has the box. Who has the box? S.” (răspunsul liber). Familiile concurează pe aceleași unități, iar grupul mai mare câștigă. Regulile pe nume nu generalizează la nume noi, deci A5 scade (86,7%). Diferența dintre familii nu se vede în mărime, doar în predicție.
5. **A7 nu se schimbă** cu niciuna dintre reparații: are nevoie de deplasare / sărire (D4).

## Pași următori propuși

1. **Hotărârea de design (o cere punctul 4):** o unitate ar trebui să poată rămâne în mai multe interpretări, iar predicția să le folosească pe toate (sursa 1 din toate tiparele care o cuprind, nu doar din cel principal). Specificația spune acum „folosește numai rescrierea principală”; aceasta ar fi schimbarea. Alternativa este alegerea între familii după eroarea pe validare (principiul 4: „nu strică predicția”), care cere date de validare la fiecare trecere și e mai scumpă.
2. Măsura: biți (cere A1), dar numai împreună cu punctul 1, altfel pierde A5.
3. Pentru A7: deplasarea / copilul sărit (D4).
4. Abia apoi pașii 6–8.

