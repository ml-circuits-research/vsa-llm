# Propuneri pentru cele trei lacune: morfologie, negație, distanțe lungi

Analiză făcută de un subagent (Fable), doar din citirea codului, la commit-ul 599ce69. Textul e păstrat ca propunere de discutat; deciziile se iau separat, în DECIZII.md.

## 0. Premise verificate în cod

- **Legarea de azi este egalitate strictă de coloană** (`propose.mjs`: `colIndex`; `match.mjs`: `put`). Nu există nicio altă relație între două locuri.
- **Gruparea aliniază de la început și cere același număr de copii** (cheile din `group.mjs`). D4 (aliniere de la sfârșit, copil sărit) nu e implementat.
- **Judecata unică (D20) se poate refolosi** pentru orice lărgire.
- **Sub-tokenii GPT-2 nu ajută la morfologie.** „ carried” / „ carry”, „ found”, „ dropped” sunt tokeni unici. O tăiere pe caractere n-ar da nici ea corespondența: found/find nu au sufix comun, iar went/go nu au nimic comun. Morfologia nu se poate scoate general din forma cuvântului; se poate scoate doar din **comportament**.

## 1. Corespondența între forme („carried” ↔ „carry”): legarea prin corespondență (atom `MAP`)

- **Mecanismul.** Azi, „locul j are aceeași valoare ca locul i”. Propunerea: „locul j are valoarea M(locul i)”, unde M e un atom de sens nou, o **alegere de perechi** învățată din coloanele unui grup. Identitatea e cazul particular. Lexemul este perechea de forme, descoperită din comportament. Prinde și formele supletive (go/went) și perechi nemorfologice (oraș → țară).
- **Reprezentarea.**
  - Definiție nouă `{ type: 'MAP', pairs }`, funcțională.
  - Item nou în tipar: `{ link, from, map }`. Valoarea lui `link` e derivată, deci nu se stochează în aplicare.
  - Se schimbă: `appChildren`, `commit`, `matchPattern`, invarianții I4/I5/I6, mărimea (MAP = 2·|perechi|·lg V), vectorii (M ≈ Σ bind(a, b), un „vector-operator”), `canon`.
- **Descoperirea.**
  - În `proposeGroup`, pentru fiecare pereche de coloane, harta rând cu rând col_i → col_j. Dacă e consistentă, nu e identitate și măcar o pereche se repetă, coloana j devine `link`.
  - Un MAP existent se refolosește (θ_merge).
  - Judecata: pachetul, apoi verificarea exactă; adăugarea de perechi trece prin D20. În biți se plătește singur: o pereche văzută o singură dată costă mai mult decât economisește.
- **Riscuri.**
  - Corespondențe întâmplătoare pe seturi mici; le oprește măsura, fără prag.
  - Formele nevăzute nu se tratează (limita corectă).
- **Cost:** ~300–400 de linii.
- **Validare:** set orb G13: verbe neregulate și supletive, plus o corespondență nemorfologică multe-la-unu (oraș → țară).

## 2. Negația ca operator

- **Ce se vede din date.** Aceleași atribute de tip (T), dar funcție diferită (F): la LOC, rolul „loc” e legat de răspuns; la NEG nu e legat niciodată. „Răspunsul e întotdeauna celălalt” nu se poate exprima în tipare, dar nici nu trebuie: inerția rolului e un semnal suficient.
- **Limita onestă.** Un operator se deosebește de „încă un tipar” doar când **același modificator** apare pe ≥ m_min clase. GBLIND are o singură formă negată, deci acolo comportamentul corect e NEG ca tipar separat. Operatorul cere un set-curriculum.
- **Mecanismul.**
  - Operatorul e un MAP între forme (baza → forma modificată).
  - În PCLASS: `mod[m] = op`. NEG∘LOC(x,p) devine membrul clasei LOC cu modificatorul NEG. Regula devine generică, cu `link` pe locurile de formă.
  - `canon` include modificatorul, deci LOC și NEG rămân despărțite în ecuație.
  - Vector: `bind(tag(NEG), deep(bază))` (legare cu eticheta operatorului, nu permutare).
- **Riscuri.**
  - Absorbția lui NEG ca sinonim prin `classLift`; de măsurat întâi pe BLIND.
  - Operatori „goi” (back, again).
  - Negația care schimbă și forma verbului depinde de lacuna 1.
- **Cost:** ~200–300 de linii peste lacuna 1.
- **Validare:**
  - BLIND acum, ca referință.
  - Set-curriculum GOP: ≥ 3 clase cu aceeași formă modificată, un control cu operator gol, o clasă pusă deoparte.

## 3. Distanțe fără reguli pe lungimi (A7, D4): golul (`star`)

- **Alternativele.**
  - Regula recursivă: infezabilă fără a schimba segmentarea (I2, I12).
  - Alinierea de la sfârșit și copilul sărit sunt cazuri particulare ale golului.
- **Mecanismul.** Un item care acceptă orice șir de 0..K unități dintr-o alegere, eventual tipizată (D18). Exemplu: `[FACT(x,o), *:ORICE_PROPOZIȚIE, Q(o), x]`.
- **Reprezentarea.**
  - `{ star }` este un loc, iar valoarea lui în aplicare e un tablou de copii literali (refacere exactă).
  - Cel mult un gol pe tipar; I4 se verifică pe unitate.
  - Costul aplicării: lg(K+1) pentru lungime, plus costul fiecărui element.
  - Se schimbă: `matchPattern` (lungime unică la potrivirea întreagă, enumerare deterministă la prefix), predicția (următorul copil poate fi încă un element sau item-ul de după gol), `slotValues`, vectorii.
- **Descoperirea.**
  - Găleți cu gol: prefix de a copii și sufix de b copii aliniați, cu cel puțin două lungimi diferite ale mijlocului (condiție structurală).
  - Pe datele deja rescrise intră prin `alternativePass`: o regulă înlocuiește ~11 reguli pe lungimi.
- **Riscuri.**
  - Explozia de candidați (O(n²) pe unitate).
  - „Ultimul fapt despre X” din bAbI cere un gol care exclude faptele despre X, o constrângere negativă care nu se poate exprima. Golul ridică A7 și G11, dar nu rezolvă singur bAbI.
- **Cost:** ~400–600 de linii.
- **Validare:** set orb G14: 0–7 distractori, faptul oriunde; numărul de reguli de nivel 4 nu trebuie să depindă de distanță.

## 4. Ordinea recomandată

1. **BLIND, rulat o dată, acum**, fără cod nou: referința pentru capcana NEG.
2. **Golul**: pur structural (fără risc de unificare falsă), deblochează A7, G11, ferestrele bAbI și textul liber.
3. **Legarea prin corespondență**: ieftină, judecată de măsura în biți fără prag nou; închide G11 împreună cu golul.
4. **Operatorul**: depinde de MAP și cere setul-curriculum.

Cost total estimat: 2–3 săptămâni, cu un set de control orb proiectat înainte de fiecare rulare.
