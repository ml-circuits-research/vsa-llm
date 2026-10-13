# Algoritmul: din ecuații cu atomi de poziție în ecuații cu atomi de sens

Document de definiție, de discutat înainte de cod. Fixează trei lucruri: **limbajul** în care se scriu ecuațiile, **criteriul** după care se aleg și **bucla** care le învață. După ce documentul e acceptat, mecanismele noi nu se mai adaugă după fiecare eșec: ce nu se poate exprima în limbaj e o limită declarată (secțiunea 8).

Starea de acum, pe scurt: D1–D24 sunt corecte luate fiecare în parte, dar au fost adăugate pe rând, după eșecuri. Secțiunea 7 le așază în cadrul de mai jos și le marchează pe cele care sunt doar euristici de căutare.

## 0. Ce înseamnă „traducere”

Corpusul intră ca **ecuații sintactice**. Fiecare document e un arbore de unități, iar o unitate e „copilul 1, copilul 2, …, copilul n”. Singurii atomi sunt tokenii și pozițiile. Exemplu:

```
u = SEQ(Ada, rests, in, the, mill, .)          // atomi: tokeni + poziții 1..6
```

Ținta sunt **ecuațiile semantice**:

```
u = PLACE(agent = Ada, loc = mill ; formă = „rests in”)
```

Aici PLACE e un atom de sens (o clasă), `agent` și `loc` sunt atomi de structură (roluri), iar forma păstrează ce trebuie pentru refacerea exactă a textului.

Pentru o poveste, ținta este:

```
poveste = { PLACE(Ada, mill), THING(Bram, flute) } ; Q_loc(Ada) ; răspuns = mill
regulă:   Q_loc(x) ∧ PLACE(x, p) ∈ fapte  ⇒  răspuns = p
```

**Traducerea este rescrierea corpusului în ecuațiile cele mai scurte posibile într-un limbaj fix.** Atomii semantici nu se dau, apar ca prescurtări care se plătesc. Descoperirea atomilor și traducerea sunt același proces, privit din două părți (secțiunea 4).

Condiția de bază (I15): din ecuațiile semantice se reface textul exact, octet cu octet. Nimic nu se aruncă. Forma rămâne, dar devine un detaliu, nu un atom de sens.

## 1. Obiectele

| Obiect | Ce este | În cod |
|---|---|---|
| token | atom de intrare | `TOKEN` |
| unitate | nod din arborele unui document (cuvânt, propoziție, paragraf, document) | `SEQ` / `APP` |
| tipar | ecuație cu părți fixe și locuri | `PATTERN` |
| loc / rol | atom de structură: o variabilă a unui tipar sau a unei clase | `STRUCT` |
| alegere | mulțimea valorilor permise unui loc (valori văzute sau tipuri) | `CHOICE` (`typed`) |
| clasă | atom de sens: tipare cu aceeași funcție, roluri comune, forma ca loc separat | `PCLASS` |
| mulțime de fapte | unitate ai cărei copii nu au ordine relevantă | **nou** (O6) |
| corespondență | funcție învățată între valorile a două locuri | **nou** (O7) |

Fiecare unitate are o **ecuație principală**, rescrierea ei, și poate avea alternative. Mărimea memoriei se calculează din ecuațiile principale.

## 2. Limbajul: șapte operatori

Fiecare operator elimină un singur fel de redundanță și are o inversă exactă, deci refacerea textului rămâne posibilă. Lista e închisă: un mecanism nou trebuie să fie un caz al unuia dintre ei sau o compunere a lor, altfel se discută ca schimbare a acestui document.

### O1. Abstracția: o formă care se repetă devine tipar

- **Intrare:** k ≥ m_min unități de aceeași lungime, cu aceleași părți fixe pe aceleași poziții.
- **Ieșire:** un tipar cu locuri pe pozițiile care variază; unitățile devin `APP(tipar, valori)`.
- **Elimină:** repetarea părților fixe.
- **Cod:** `group.mjs`, `propose.mjs` (`proposeGroup`).

### O2. Legarea: o valoare care se repetă devine variabilă

- **Intrare:** două locuri care primesc pe fiecare rând aceeași valoare.
- **Ieșire:** un singur loc, folosit de două ori.
- **Elimină:** repetarea unei valori, de exemplu persoana din fapt și din întrebare, sau locul din fapt și răspunsul.
- **Aici apar relațiile**, nu doar formele.
- **Cod:** `colIndex` în `propose.mjs`.

### O3. Compunerea: o coloană de aplicări devine tipar cuibărit

- **Intrare:** o coloană în care fiecare valoare e o aplicare a aceluiași tipar q.
- **Ieșire:** regula cuibărește q și îi leagă locurile (`{sub: q, args}`).
- **Elimină:** referința la unitate, înlocuită de structura ei. Regulile ajung să vorbească despre fapte, nu despre cuvinte.
- **Cod:** `findLift`.

### O4. Sinonimia: tipare diferite cu aceeași funcție devin o clasă

- **Intrare:** o coloană în care valorile sunt aplicări ale unor tipare diferite, cu aceeași aritate și cu aceleași valori efective pe roluri.
- **Ieșire:** o clasă cu roluri comune. Membrul folosit devine un loc de formă.
- **Elimină:** câte o regulă pentru fiecare formă de suprafață.
- **Aici se nasc atomii de sens.**
- **Condiția de corectitudine (D24):** suprapunerea pentru refolosirea unei clase se măsoară pe reuniune; altfel clasele se înlănțuie.
- **Cod:** `classLift`.

### O5. Tipul: o listă de valori devine concept

- **Intrare:** o alegere ale cărei valori sunt aplicări ale unor tipare sau clase (sau, la nivelul cel mai de jos, tokeni care apar în aceleași locuri).
- **Ieșire:** o alegere tipizată, care acceptă orice aplicare a tipului, și una nevăzută.
- **Elimină:** enumerarea valorilor văzute.
- **Aici apare generalizarea la date noi.**
- **Ierarhia:** un concept mai general este un tip ale cărui membri sunt concepte (`isa`).
- **Cod:** `types.mjs` (D18), `concepts.mjs` (rețeaua).

### O6. Mulțimea: ordinea care nu contează se elimină (nou)

- **Intrare:** o unitate ai cărei copii sunt aplicări (fapte), pentru care descrierea nu depinde de ordinea lor, adică aceeași regulă le explică în orice permutare văzută.
- **Ieșire:** unitatea se scrie ca **mulțime de fapte**, plus permutarea (necesară doar pentru refacerea textului). Regulile de deasupra se scriu peste mulțime, ca interogări: `Q(x) ∧ F(x, p) ∈ S ⇒ p`.
- **Elimină:** atomii de poziție dintre fapte. O regulă înlocuiește câte o regulă pentru fiecare lungime și fiecare poziție a faptului întrebat.
- **De ce nu „golul”:** golul (PROPUNERI_LACUNE.md, lacuna 3) elimină aceeași redundanță în limbajul secvențelor. Mulțimea o elimină în limbajul faptelor, unde trebuie să ajungă traducerea. În HDC, mulțimea e chiar suprapunerea (bundling), iar interogarea e `unbind`.
- **Limită:** „ultimul fapt despre X” (bAbI) cere ordinea temporală. Atunci ordinea nu se elimină, ci devine atribut al faptului (timp = poziție). Asta e tot O6: o mulțime de fapte cu rol de timp.

### O7. Corespondența: o funcție între valori devine atom (nou)

- **Intrare:** două coloane ale unui grup, cu o funcție consistentă între valori, care nu e identitatea și în care măcar o pereche se repetă.
- **Ieșire:** un atom `MAP` (perechi). Al doilea loc devine derivat: `loc_j = M(loc_i)`. Identitatea (O2) este cazul particular.
- **Elimină:** câte o regulă pentru fiecare pereche (carried ↔ carry, oraș → țară).
- **Negația ca operator** e o compunere O4 + O7: un MAP între forme, aplicat membrilor unei clase. Nu e un operator separat.

### Ce lipsește intenționat

Aritmetica, numărarea, negația ca operație logică (nu doar ca formă), coreferința la distanță, formele niciodată văzute (morfologie fără exemple). Vezi secțiunea 8.

## 3. Criteriul unic

Se minimizează **lungimea descrierii**, în biți:

```
L = L(memorie) + L(date | memorie)
```

- `L(memorie)`: tiparele, clasele, alegerile, corespondențele, adică ce măsoară azi `size.mjs` pentru definiții.
- `L(date | memorie)`: aplicările, adică alegerea tiparului și a valorilor pentru fiecare unitate. Azi e inclusă în același total.
- Pentru generalizare, adică pentru ce încă nu e în date, termenul de mai sus nu ajunge. Se adaugă **costul predicției** unităților pe care schimbarea le revendică nou și, dacă există, al textului de validare. Asta e judecata unică (D20): o schimbare trece dacă Δ(memorie) + Δ(predicție a ce revendică) < 0 și validarea nu crește.

**Orice operator, la orice nivel, trece prin aceeași judecată.** Nu există praguri de acceptare. Pragurile care rămân (θ_merge, m_min) servesc doar la **căutare**, adică la ce candidați se propun. Nu decid ce se păstrează.

## 4. Bucla: traducere și descoperire, pe rând

Ca la EM: nu poți ști atomii fără să parsezi, nici nu poți parsa fără atomi. Se alternează:

```
repetă până nu mai scade L:
  T (traducere):   pentru fiecare unitate, de jos în sus, ecuația principală = cea mai scurtă
                   rescriere în atomii de acum (recunoaștere + alternative)
  D (descoperire): candidații = aplicări posibile ale operatorilor O1–O7 pe corpusul tradus
                   (generați de grupare și de vecinătățile HDC, secțiunea 5)
                   pentru fiecare candidat: ΔL exact, pe o copie
                   se aplică cel mai bun candidat cu ΔL < 0 (sau un pachet compatibil)
```

Proprietăți, care țin de algoritm, nu de euristici:
- **De jos în sus.** Un nivel se descoperă după ce cel de dedesubt s-a stabilizat. Curriculumul pe niveluri (D21) e o consecință, nu o opțiune.
- **Cel mai bun întâi, după ΔL exact,** nu după numărul de poziții libere. Ordinea din specificație (grupurile cu mai puține locuri întâi) a blocat regulile de poveste pe GBLIND (D22). E o abatere de la specificație, de aprobat.
- **Fără blocaje.** Un candidat respins nu își păstrează unitățile.
- **Determinism.** Aceleași date și aceeași sămânță dau aceeași memorie (I9).

## 5. Rolul HDC

Vectorii nu decid nimic. **Propun**, ieftin, iar criteriul exact (secțiunea 3) **verifică**. Până acum vectorii doar copiau asemănarea exactă (I13), deci nu puteau propune nimic nou. Asta se schimbă:

| Raționament | Ce face HDC | Exemplu |
|---|---|---|
| **inducție** (de la cazuri la regulă) | vecinătăți între ecuații: aplicări cu vectori de structură apropiați → candidați O1 / O3 | două povești cu aceeași structură rol ⊗ valoare |
| **abducție** (cea mai bună explicație) | vecinătăți între forme și valori → candidați O4 (sinonime) și O5 (tipuri); concept = suprapunerea membrilor | „is sitting in” e aproape de {is in, stays in} → candidat de sinonimie |
| **deducție** (de la regulă la caz) | predicția: legare / dezlegare pe ecuația semantică | poveste = Σ bind(fapt_i); `unbind(poveste, agent=Ada)` → loc |

Codări:
- **Aplicare:** `bind(tag(tipar), Σ bind(rol_j, valoare_j))`.
- **Clasă:** suprapunerea membrilor.
- **Mulțime de fapte:** suprapunerea faptelor (O6).
- **Corespondență:** `Σ bind(a, b)` (O7).

Exactitatea rămâne la memorie (I14): vectorul e doar un index pentru propuneri.

## 6. Ce rămâne fix

- Limbajul: O1–O7 și compunerile lor.
- Criteriul: L, cu judecata unică.
- Bucla: T/D de jos în sus, cel mai bun candidat întâi.
- Parametrii de căutare: θ_merge, m_min, f_max, numărul de candidați. Pot schimba viteza și ce se găsește, nu ce se acceptă.
- Seturile oarbe: proiectate înainte, rulate o singură dată, cu criteriile scrise dinainte.

## 7. Harta mecanismelor de acum

| Mecanism | Operator | Rol | Ce se face cu el |
|---|---|---|---|
| tipare, locuri (spec.) | O1 | limbaj | rămâne |
| locuri legate (spec.) | O2 | limbaj | rămâne |
| ridicarea, interpretări multiple (D7, `findLift`) | O3 | limbaj | rămâne |
| clasele (D15), Jaccard (D24) | O4 | limbaj | rămâne |
| criteriul „formele nu se repetă sistematic” (D15) | O4 | euristică de acceptare | **de înlocuit cu judecata unică** |
| alegeri tipizate (D18) | O5 | limbaj | rămâne |
| rețeaua de concepte (D17) | O4 / O5 | generator de candidați | rămâne, doar ca propunere |
| inducția (D19) | O4 | judecată pe candidat | se contopește cu D |
| gruparea abstractă (D16), forma conceptuală (D17), despărțirea (D23) | O1 / O3 | generator de candidați | rămân, doar ca propunere |
| alternativele pe înșiruiri (D22) | buclă | reparația ordinii | **devine regula buclei (cel mai bun întâi)** |
| curriculumul (D21) | buclă | ordine | **devine regula buclei (de jos în sus)** |
| judecata unică (D20) | criteriu | criteriu | **se aplică tuturor**, inclusiv trecerii obișnuite |
| ordinea „mai puține locuri întâi” (spec. §9) | buclă | euristică | **se înlocuiește** (de aprobat) |
| gol (propus) | O6 în limbajul secvențelor | | **nu se face**; se face O6 |
| MAP (propus) | O7 | limbaj | se face după O6 |

## 8. Ce nu poate învăța (limite declarate)

1. **Forme nevăzute.** Fără exemple nu există dovadă. Abducția prin HDC poate propune („seamănă cu”), dar acceptarea cere date.
2. **Constrângeri negative,** de tipul „orice fapt, *în afară de* cele despre X”. Se ocolesc parțial prin timp (O6).
3. **Calcul:** numărare, aritmetică, comparații.
4. **Coreferința** („he”, „she”) fără un operator de legare între propoziții. Ar fi O2 peste mulțimi și ar trebui definit separat.
5. **Text liber, fără repetiție structurală.** Dacă nimic nu se repetă, nimic nu se prescurtează. Pe TinyStories, aici e locul unde se măsoară cât ajunge.

## 9. Planul

1. **Discuția acestui document.** Deciziile de luat sunt în secțiunea 10.
2. **Judecata unică peste tot.** Trecerea obișnuită și ridicarea trec prin ea; criteriul „formele nu se repetă” se scoate. Verificare: blocul A, GPARA, GBLIND și GBLIND2 (văzute).
3. **Bucla T/D** cu „cel mai bun întâi” și „de jos în sus” ca reguli. D21 și D22 dispar ca opțiuni.
4. **O6, mulțimea de fapte,** cu timpul ca rol, și vectorul HDC al mulțimii.
5. **HDC ca generator de candidați** pentru O4 și O5.
6. **O7, corespondența.**
7. **Un set orb nou, GBLIND3, după fiecare dintre pașii 4–6,** proiectat dinainte de un subagent fără acces la mecanism.
8. **Date mai multe:** bAbI întreg (qa1–qa3), apoi TinyStories, cu limitele din secțiunea 8 măsurate cinstit.

## 10. Decizii pentru autor

1. **Lista operatorilor.** Accepți lista închisă O1–O7, cu negația ca O4 + O7?
2. **O6 în loc de gol.** Mulțimea de fapte e o schimbare a modelului de date: un nou fel de unitate, cu permutarea păstrată pentru refacere.
3. **„Cel mai bun întâi” în locul ordinii din specificație** (§9: grupurile cu mai puține locuri întâi).
4. **Rolul HDC.** Vectorii propun, criteriul exact decide. I13 rămâne pentru proprietățile H1–H8, dar vectorii nu mai trebuie să copieze asemănarea exactă pentru propuneri.
