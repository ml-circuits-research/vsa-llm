# hdclm: implementare și rezultatele blocului A

> **Starea curentă (etapa 2 din PLAN.md încheiată):** cu configurarea implicită (biți, alternative, interpretări multiple, grupare abstractă), A1–A6 trec pe semințele 1, 2 și 3; A7 trece parțial. Detalii în secțiunea „Etapa 2”, la sfârșit. Secțiunile intermediare descriu drumul până aici, cu configurările de atunci.

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
| `shadowLift` | (scos în etapa 2, înlocuit de `multiInterp`) la ridicare, muta unitățile la un grup pierdut la atribuirea lacomă |

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


## Măsura amestecată (`--set measure=mix:α`)

`mix:α` = α·termeni + (1−α)·biți / log2(V), adică biții exprimați în „termeni echivalenți”. Cu alternative, sămânța 1:

| măsura | G1 | G2 | A5 | A6 | G4 |
| --- | --- | --- | --- | --- | --- |
| termeni, mix 0,75 … 0,25 | 2 tipare, err 1,76 | 10 tipare, err 1,67 | 100% | 60–67% | 0 tipare |
| mix 0,15 … 0,05 | 2 tipare | 10 tipare | 86,7% | 66,7% | 0 tipare |
| biți | 2 tipare | 2 tipare, 2 alegeri, err 1,68 | 86,7% | 66,7% | 0 tipare |

Niciun α nu le are pe amândouă: A5 scade înainte să apară tiparul cu două locuri pe G2. Pe G2, abstractizarea nu îmbunătățește predicția (1,67 față de 1,68), pentru că fiecare pereche verb–obiect apare la învățare. Câștigul ei s-ar vedea doar pe perechi verb–obiect nevăzute.

## Etapa 1 din PLAN.md: testul care justifică biții (G2P)

G2P = G2 fără perechile „writes the poem” și „reads the note” la învățare (pentru niciun nume); testul este pe aceste 20 de propoziții. `node src/cli.mjs experiment G2P`

| | eroare pe perechi nevăzute | eroare pe învățare | tipare |
| --- | --- | --- | --- |
| fără somn | 2,064 | 1,624 | 0 |
| termeni + alternative | **2,114** (mai rău decât fără somn) | 1,507 | 8 specifice (`[S, writes, the, story, .]` …) |
| biți + alternative | **1,871** | 1,531 | 2: `[S, writes, the, S, .]`, `[S, reads, the, S, .]`, alegerea „obiect” cu toate 5 |

Concluzie: termenii învață că perechile nevăzute nu există. Biții creează categoria „obiect” și generalizează (−0,24 biți/token), cu un cost mic pe ce s-a văzut (+0,02). **Decizia „biți” este susținută de date.**

Corectură în trecerea de alternative: candidații nu se mai filtrează după estimarea judecății, ci se verifică toți pe forma exactă. Pe G2P estimarea în biți îi elimina pe toți, inclusiv pe cel bun.


## Etapa 2 din PLAN.md: mai multe interpretări și gruparea abstractă

### Ce s-a schimbat (acum implicit în `config/default.json`)

| Parametru | Ce face |
| --- | --- |
| `measure: "bits"` | biții hotărăsc ce se învață; K = 16 rămâne limita de termeni pe ecuație |
| `alternatives: true` | trecerea de alternative din etapa 1 |
| `multiInterp: true` | o unitate se poate citi ca aplicare a oricărui tipar cu care se potrivește, nu doar a celui principal: la ridicare (somn) și la tiparele cuibărite (predicție). Când o regulă citește un copil prin tiparul q, copilul trece principal la q. Dacă niciun tipar nu acoperă o coloană, se propune unul nou din valorile ei |
| `abstractGroups: true` | unitățile se grupează și după **forma** copiilor (nivel, lungime), nu doar după copii identici. Așa se găsesc reguli fără niciun copil fix, ca regula R din secțiunea 3 a specificației |

Un tipar este „viu” dacă are aplicări sau dacă e cuibărit într-un tipar viu. Doar tiparele și alegerile vii costă.

### Rezultate (configurarea implicită)

| Exp. | sămânța 1 | 2 | 3 |
| --- | --- | --- | --- |
| A1 (biți) | G1 și G2 trec | trec | trec |
| A2 | trece (în biți pachetul nu e necesar) | trece | trece |
| A3 | 20/20 | trece | trece |
| A4 | 0 tipare pe G4 | 0 | 0 |
| A5 | **100%** (fără locuri legate 60%) | 100% (53%) | 100% (80%) |
| A6 | **100%** | 100% | 100% |
| A7 | > 90% până la 1 propoziție | până la 3 | până la 2 |
| G2P | biți 1,871 față de termeni 2,114 | la fel | la fel |

Regulile găsite, citite din memorie:

- **G7** (4 tipare în toată memoria, total 3779 → 753 biți): `[S, .]`, `[Who, has, the, S, ?]`, `[S1, has, the, S2, .]` și regula **`[Fapt(S1, S2), Întrebare(S2), Răspuns(S1)]`**. Aceasta este exact regula R din specificație: „cineva are ceva; cine are acel ceva? acel cineva”.
- **G8:** **`[Fapt1(S1, S2), Fapt2(S1, S3), Unde(S2), Răspuns(S3)]`**: „cineva are ceva; acel cineva e undeva; unde e ceva? acolo”. Doi pași de judecată, într-o singură regulă.
- **A7 (G9):** câte o regulă pentru fiecare număr de propoziții dintre fapt și întrebare (11 reguli). Merge pentru 1–3 propoziții, nu și pentru 4–5. Gruparea cere încă același număr de copii, deci deplasarea (D4) rămâne de făcut.

### Consecințe

1. **Ce s-a câștigat:** regulile sunt generale, nu câte una pe nume sau pe obiect. Ele nu mai depind de echilibrul datelor (motivul pentru care A5/A6 picau) și generalizează la combinații nevăzute. Memoria e mult mai mică.
2. **Valorile de aur din specificație** (G1: 56 de termeni; 60/63/56) rămân valabile pentru mecanismul de bază, măsurat în termeni. Testele lor fixează explicit acea configurare. În biți, G1 dă tot 2 tipare și o alegere, iar judecata în pachet nu mai e necesară.
3. **Costul de calcul:** trecerea de alternative copiază memoria pentru fiecare candidat (până la 200 pe nivel). Pe G-uri durează secunde. Pe text adevărat va trebui o contabilitate incrementală. Asta e o problemă pentru etapele 6–7, nu de corectitudine.
4. **Ce rămâne slab:**
   - A7 la 4–5 propoziții între fapt și întrebare;
   - seturile de test sunt mici (15 povești puse deoparte);
   - generarea după răspuns tot nu pune punctul: locurile puse de unitățile de deasupra nu sunt implementate la predicție.
5. **Termenii, cu aceleași reparații:** A5 și A6 trec, dar A1 și G2P pică. Concluzia din etapa 1 rămâne.


## Etapa 4 (în lucru): verificarea că nu am croit mecanismul pe G7, și A7

**Nimic nu e hardcodat.** În mecanism nu apare niciun cuvânt și niciun nume de set (verificat cu grep). Tiparele și regulile ies din date. Singura cunoaștere dată rămâne tabelul de granițe.

**Riscul real era ca designul să fie croit pe G7.** Pentru asta am adăugat **G10, un set de control** cu alte cuvinte și altă structură: două fapte și o întrebare despre *unul dintre ele*. De exemplu: „Mira lives in Oslo. Tom lives in Rome. Where does Tom live? Rome.” Rulare: `node src/cli.mjs experiment G10`.

- **Prima rulare, fără nicio schimbare: pică** (56% / 20% / 45% pe semințele 1–3). Gruparea abstractă punea în același grup poveștile cu întrebare despre primul fapt și pe cele despre al doilea. Pe un grup amestecat nu există o legare comună.
- **Reparația (generală):** cheia grupării abstracte conține și **structura repetițiilor**, adică ce valori se repetă și pe ce poziții. Un loc legat înseamnă exact o valoare care se repetă, deci nu e cunoaștere de limbă.
- **După reparație: G10 100% pe toate cele trei semințe** (fără somn 20–52%; în termeni 36–56%). Regulile găsite sunt `[Fapt(S1,S2), Fapt(S3,S4), Unde(S1), Răspuns(S2)]` și `[… Unde(S3), Răspuns(S4)]`, plus variante pentru poveștile în care ambele fapte au, întâmplător, același oraș.
- **Atenție:** după reparație, G10 nu mai este nevăzut. Pentru o verificare curată trebuie un alt set de control (G11), neatins până la rulare.
- Blocul A rămâne neschimbat pe semințele 1–3. Pe G8 apare, pe lângă regula generală (54 de povești), o regulă mică pentru 2 povești cu o repetiție întâmplătoare.

**A7 (G9):** regulile se fragmentează: câte una pentru fiecare număr de propoziții intercalate și pentru fiecare formă a lor. Rezultat: > 90% până la 1–3 propoziții. Vezi decizia propusă mai jos.

## G11: set de control orb (proiectat fără acces la mecanism, rulat o dată)

`node src/cli.mjs experiment G11`: **pică**. 3,7% / 0% / 0% pe semințele 1–3; fără somn 0%. Predicția de top după întrebare este „The”, adică începutul unui fapt nou. Cauzele (deplasarea, forma verbului, fragmentarea) sunt în DECIZII.md, D10. Rezultatul rămâne consemnat așa; o reparație ulterioară îl va face „văzut”.

## Blocul B, pasul 6

- **B1** (`node src/cli.mjs experiment B1`, 99 s): bipolar și phasor trec H1–H8 la D = 1024, 4096 și 16384. **Binary iese**: pică H5 și H6 (majoritatea rotunjește sumele, greșeala 1 din specificație) și H8 la D ≤ 4096. D = 65536 nu a fost rulat.
- **Exact față de vectori** (`test/similarity.test.mjs`): pe G7 după somn, |sim(comp x, comp y) − simC(x, y)| și aceeași diferență pentru enr sunt sub t = 0,078, la bipolar și phasor, D = 4096. Un bug găsit pe drum: etichetele nenormalizate făceau ca „.” să acopere numele în sume (abatere 0,40). Reparat.
- **B2** (capacitatea; `experiment B2`, 146 s pe 4 fire): eroare de recunoaștere a unui copil sub 1% până la K = 24 / 64 / ≥ 256 (bipolar, D = 1024 / 4096 / 16384) și K = 48–64 / 128 / ≥ 256 (phasor). M = 100.000 de candidați nu a fost rulat. **Rezervă:** la M = 10.000 s-au făcut doar ~20–80 de decodări pe valoare.
- **B3** (pragul de grupare; 48 s): separare fără nicio eroare observată, la orice D încercat; θ = 0,17 / 0,30 / 0,39 pentru 3 / 5 / 8 copii (D = 4096). Asemănările măsurate urmează valorile exacte (n − j)/n.
- **B4** (costul; 36 s): bipolar e cel mai ieftin. La D = 4096 ocupă 16 KB pe vector și o căutare durează ~2,1 s printre 100.000 de vectori, deci ~21 s printre 1 milion (extrapolat). Phasor e de 2× mai scump.
- **B5** (225 s): bipolar și phasor la D = 4096 dau **aceleași decizii și aceleași totaluri** ca strategia exactă pe A1, A3, A5, A6, G2P (de exemplu, A6: 1236,385 la toate trei). Sunt de ~12× (bipolar) și ~24× (phasor) mai lente.
- **Decizia (DECIZII.md, D11):** bipolar, D = 4096, θ_group = 0,17. Implicit rămâne strategia exactă până la optimizarea O7.
- Corectură: B2 folosea `node:child_process`, care nu este permis de specificație (secțiunea 4). A fost trecut pe `node:worker_threads`, cu rezultat determinist.

## bAbI, sarcina 1: formalizare (`node src/cli.mjs experiment BABI1`)

200 de povești la învățare, 1000 de întrebări de test, tokeni-cuvânt, configurarea implicită; somnul durează 23 s.

- **Categorii descoperite singure, toate exacte:**
  - {bathroom, hallway, garden, office, bedroom, kitchen} = locuri;
  - {Mary, John, Daniel, Sandra} = persoane;
  - **{moved, went, journeyed, travelled} = verbele de mișcare, 4 din 4, fără niciun intrus.**
  
  Categoria verbelor vine din tiparul `[S1, S2, to, the, office, .]`, în care verbul este un loc liber.
- **Ce lipsește pentru „același sens = aceeași ecuație”:**
  - rămân și tiparele câte unul pe verb (`[S, moved, to, the, S, .]` …); nu există o formă canonică unică;
  - „went back to” are un token în plus și rămâne un tipar separat (deplasarea).
- **Răspunsuri corecte:** 22,5% fără somn, 22,9% după somn (la întâmplare ~17%). Sarcina cere „ultimul fapt despre X”, ceea ce regulile cu poziții fixe nu pot exprima (aceeași limită ca la A7 și G11).

## Revenirea la ținta inițială: atomi de structură și de sens (D15, D16)

**Măsura nouă** (`src/eval/formal.mjs`, experimentul `FORMAL`, setul `GPARA`):
- acoperirea cu tipare;
- atomii de structură raportați la rolurile distincte (redundanța);
- categoriile duplicate;
- puritatea claselor față de aur și contopirile false;
- **fracția reformulărilor cu aceeași ecuație canonică.** Ecuația canonică = (clasa tiparului, valorile care poartă sens). Un loc poartă sens dacă o regulă îl leagă (`src/memory/meaning.mjs`).

GPARA are aceleași sensuri în mai multe forme (MOVE: went / moved / travelled / went back to; HAVE: has / holds / picked up / is holding) și o capcană de antonim (LEAVE: left).

| | Referința (E0) | Cu clase și formă după nivel, semințele 1 / 2 / 3 |
| --- | --- | --- |
| GPARA: reformulări cu aceeași ecuație | 2% / 4% / – | **58% / 71% / 79%** |
| GPARA: capcane MOVE/LEAVE contopite | 0% | **0%** pe toate semințele |
| GPARA: contopiri false între sensuri | – | 0 |
| GPARA: răspunsuri pe puse deoparte | 40% / 37% / – | 63% / 57% / 46% |
| BABI2: reguli de paragraf / răspunsuri | 131 / 44% | 111 / 45–46% |
| Blocul A | A1–A6 trec | A1–A6 trec pe toate semințele; A7: 1 / 2 / 5 propoziții |
| G10 / G11 (control orb) | 100% / 0% | 100% / **0%** |

**Ce s-a obținut.** Pe GPARA, clasa MOVE = {went back, moved, went, travelled} e descoperită corect, cu două roluri comune (agent, loc) și cu forma păstrată ca loc separat. Reguli generale peste clasă:
- `[M(agent, loc; formă), M(…), Where(agent), Răspuns(loc)]`;
- varianta cu capcana LEAVE.

LEAVE nu intră în clasă.

**Ce nu merge încă.**
- **HAVE nu își formează clasa:** zeci de reguli mici, ultra-specifice („Kurt holds the wallet. What does Kurt have? wallet.”) consumă poveștile înaintea regulii generale. E ordinea lacomă a grupării; varianta „grupurile mari întâi” generalizează prea mult (reformulări 0%).
- **BABI2:** tiparele principale ale faptelor sunt „pe loc” (verbul ca loc liber), deci clasele nu ajută acolo.
- **G11** rămâne la 0%: corespondența dintre formele verbului („carried” → „carry”) nu e o repetiție.

Detaliile și ce s-a încercat fără succes sunt în DECIZII.md, D15 și D16.

## Controlul orb GBLIND: preînregistrare (scrisă înainte de rulare)

Set: `src/data/gblind.mjs` (alte nume, locuri, obiecte și verbe; 2 sau 3 fapte; alte întrebări; capcane LOOK și NEG). Experimentul: `node src/cli.mjs experiment BLIND --seed N`.

Se rulează o singură dată, pe semințele 1–3. Nicio reparație nu se face după rezultate, iar rezultatele se trec aici așa cum ies. Configurările fixate dinainte:

- **B0** (implicit, D1–D16): `node src/cli.mjs experiment BLIND --seed N`
- **B1** (concepte în grupare, D17 cu clasele vii D20, somn până se oprește): `--set concepts=true --set maxDeepPasses=80`

Tipurile locurilor (D18) și inducția (D19) **nu** intră în rulare: încă nu sunt măsurate pe seturile de dezvoltare cu judecata unică.

Măsuri:
- reformulări cu aceeași ecuație;
- capcane contopite (LOC/LOOK, LOC/NEG);
- QA pe poveștile puse deoparte, pe sens și pe capcană;
- numărul de tipare și de clase.

## Controlul orb GBLIND: rezultate (rulat o singură dată, nimic reparat după)

| Configurare | Sămânța | Reformulări cu aceeași ecuație | Capcane contopite | QA puse deoparte | Tipare | Clase |
|---|---|---|---|---|---|---|
| B0 implicit | 1 | 9% (129) | 0% (61) | 14% (58) | 33 | 0 |
| B0 implicit | 2 | 5% (109) | 0% (78) | 7% (57) | 30 | 0 |
| B0 implicit | 3 | 47% (106) | **71%** (78) | 14% (58) | 33 | 1 |
| B1 concepte | 1 | 9% | 0% | 14% | 33 | 0 |
| B1 concepte | 2 | 5% | 0% | 5% | 30 | 0 |
| B1 concepte | 3 | 20% | **27%** | 10% | 35 | 1 |

**Concluzie: pică.** Unificarea reformulărilor și regulile de poveste nu se generalizează pe setul orb. Conceptele (B1) nu schimbă nimic important. Pe sămânța 3, B0 face o contopire falsă LOC+LOOK+NEG, iar B1 una LOC+LOOK.

**Diagnostic** (după rulare, fără reparații; GBLIND devine de acum set văzut):
- **Învățare față de generalizare** (sămânța 1, B0): QA 85% pe poveștile de antrenare, dar 17% pe poveștile de test obișnuite și 14% pe cele puse deoparte. Sistemul memorează, nu generalizează.
- **Nivelul propozițiilor iese bine.** Apar toate formele generale (`[S is in the S .]`, `[S is not in the S .]`, `[S looked at the S .]`, `[S grabbed the S .]` …) și cele două întrebări.
- **Nivelul poveștilor pică.** Nu apare nicio regulă generală de tipul `[LOC(x,p), S, In which room is x?, p]`, doar 11 reguli mici (2–3 folosiri), legate de anumite propoziții.
- **Cauza probabilă, aceeași ca pe BABI2 (D15, Revizuire).** Unele propoziții au ca rescriere principală forme „pe loc”: `[Bram S in the office .]`, `[S S in the kitchen .]`. Astfel, aceeași coloană a poveștii conține aplicări ale unor tipare diferite, iar ridicarea pică. Pe GPARA, efectul a fost mai mic.
- **Contopirea falsă** (sămânța 3) vine prin `classLift`: LOC, LOOK și NEG primesc aceleași feluri de valori, iar cuvintele prin care diferă nu se repetă în restul poveștii. Criteriul 2 din D15 nu le oprește, cum anticipa analiza din PROPUNERI_LACUNE.md.

**Ce înseamnă.** Rezultatele bune de pe GPARA (D15–D17) au fost în mare parte potrivite pe acel set. Problemele de bază sunt două:
1. alegerea rescrierii principale a propozițiilor, care fragmentează regulile;
2. clasele care unesc sensuri cu aceleași tipuri dar funcții diferite.

Ambele trebuie rezolvate înaintea lacunelor din PROPUNERI_LACUNE.md. Verificarea se va face pe un set orb nou (GBLIND2), proiectat înainte de reparații.

## Testul de decizie pe GBLIND2: preînregistrare (scrisă înainte de rulare)

**Context.** După GBLIND, reparațiile s-au făcut pe GBLIND, care e de acum set văzut:
- D21: curriculumul pe niveluri;
- D22: alternativele încearcă și grupuri numai din înșiruiri;
- D23: subgrupurile abstracte după o coloană;
- judecata unică în biți (descrierea totală);
- clasele surori disjuncte la inducție.

Pe GBLIND, sămânța 1: QA pe testul obișnuit a urcat de la 17% la 39–56%, iar pe poveștile puse deoparte de la 14% la 24%. Numerele sunt mici, deci zgomotoase.

**Setul.** GBLIND2 (`src/data/gblind2.mjs`), proiectat de un subagent care nu a avut acces la mecanism și nerulat până acum. Are:
- vocabular nou și 2–4 fapte pe poveste;
- câte două formulări de întrebare pentru fiecare sens;
- trei sensuri-capcană (LEAVE, DREAM, PAINT).

**Configurări, fiecare rulată o singură dată, pe semințele 1–3:**
- **G0 (implicit):** `node src/cli.mjs experiment BLIND --seed N --set blindSet=GBLIND2`
- **GF (tot ce s-a adăugat):** în plus `--set levelCurriculum=true --set altSeqGroups=true --set splitAbstract=true --set slotTypes=true --set concepts=true --set induction=true --set maxDeepPasses=80`

**Criteriile de trecere pentru GF, pe toate cele 3 semințe:**
- QA pe poveștile puse deoparte ≥ 70%;
- reformulări cu aceeași ecuație ≥ 60%;
- capcane contopite 0%.

**Așteptare declarată dinainte:** pe GBLIND, GF dă doar 24% pe poveștile puse deoparte, deci probabil pică. Contează cât câștigă GF față de G0, adică dacă reparațiile sunt generale și nu potrivite pe GBLIND.
