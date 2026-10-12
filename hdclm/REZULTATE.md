# hdclm: implementare și rezultatele blocului A

Implementarea specificației „Model de limbaj HDC din text (v1.0)”, pașii 1–5 din secțiunea 19, cu strategia exactă (fără vectori). Codul stă în acest director și respectă regulile din secțiunea 4: Node.js ≥ 20, fișiere `.mjs`, nicio dependență, `rng(seed)` peste tot.

## Cum se reia pe calculator

```bash
cd hdclm
node --test test/*.test.mjs          # 46 de teste, circa 1 s
node src/cli.mjs experiment A        # A1–A7, câteva secunde
node src/cli.mjs experiment A5,A6    # doar unele
node src/cli.mjs experiment A --seed 2
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
| A6 | f_max = 2: 60% (ca fără somn); **f_max = 3: 100%** | **pică cu valorile de pornire, trece cu f_max = 3** |
| A7 | 0% la orice număr de propoziții între fapt și întrebare; pe nivelul 4 nu apare niciun tipar | **pică**: sistemul leagă doar ce stă aliniat |

### Ce înseamnă

- **Mecanismul de bază merge.** Internare, refacere exactă, judecată în pachet (exact 60/63/56), alegeri contopite care generalizează la combinații nevăzute, reguli cu loc legat (A5 100%), niciun tipar pe text fără structură.
- **A1 G1 în termeni** pică la limită: cu 8 nume pe verb, cele două tipare costă exact cât înșiruirile (10 + 2·3 + 16·2 = 48). În biți totalul scade clar. Este un argument pentru măsura în biți (D1).
- **A1 G2 este problema de mecanism.** Specificația spune deja că în termeni tiparul cu două locuri „nu se plătește aproape niciodată”. În implementare, tiparul nici nu ajunge să fie propus, oricare ar fi măsura: gruparea ia întâi grupurile cu o singură poziție liberă, iar o unitate intră doar în primul grup. Reparația naturală este cea din secțiunea 10: somnul adânc încearcă interpretarea alternativă (grupul cu `F = {0, 3}`) și o păstrează dacă totalul scade, în biți.
- **A6** arată că pentru doi pași de judecată trebuie trei poziții libere pe paragraf (fapt 1, fapt 2, răspuns). Deci A6 hotărăște `f_max`, nu `d_max`.
- **A7** pică din construcție: povești de lungimi diferite nu se grupează (aceeași lungime, aliniere de la început), iar distractorii diferă. Ține de deplasare (D4) și de un mecanism de „sărire”. Votul singur dă tot 0%.

## Pași următori propuși

1. Interpretările alternative în somnul adânc (pentru A1 G2), apoi rularea din nou a lui A1 cu măsura în biți.
2. Hotărârea măsurii (termeni sau biți) și a lui `f_max` (3 rezolvă A6). Atenție la costul gruparii, care crește cu f_max.
3. Pentru A7: alinierea de la sfârșitul unității și copilul sărit (D4), măcar pe nivelul paragrafului.
4. Abia după acestea, pașii 6–8 (vectori, GPT-2, text real).
