# Model de limbaj HDC din text: specificație (v1.0)

Oct 11, 2026 · @Sînică Alboaie

Sistemul citește text ca șir de tokeni și îl ține minte ca ecuații. În veghe codează automat, fără nicio decizie. În somn grupează ecuațiile care seamănă, scoate din ele tipare și rescrie memoria mai scurt. Prezice ce urmează din tiparele și textele ținute minte.

Documentul are trei părți: ce este sistemul (secțiunile 1–3), cum se implementează în Node.js (4–16) și cum se verifică (17–19). Starea: nimic nu a fost implementat sau rulat. Valorile care sunt alegeri de pornire stau în tabelul de parametri, fiecare cu experimentul care o hotărăște. Termenii speciali sunt explicați în anexă.

## 1. Esența

1. Textul intră ca șir de tokeni, tăiați de un tokenizer standard de LLM.
2. **Veghe:** fiecare bucată de text devine automat o ecuație: copiii ei, în ordine. Nu se ia nicio decizie.
3. Fiecare ecuație primește un nume, un atom de sens. Nivelul de deasupra se construiește din aceste nume: tokeni, cuvinte, părți de propoziție, propoziții, paragrafe, document.
4. **Somn:** sistemul grupează ecuațiile care seamănă, scoate din fiecare grup un tipar și rescrie ecuațiile ca aplicări ale tiparului. Memoria devine mai scurtă, iar textul se poate reface exact.
5. **Predicție:** tiparele și textele din memorie care seamănă cu începutul unui text spun ce urmează.
6. Tot ce se învață stă în memorie, într-o formă exactă, care se poate citi. Vectorii HDC sunt a doua formă a acelorași ecuații, folosită la căutare.
7. Veghea și somnul alternează: când s-a adunat destul text nou, rulează un somn. Nimic din ce s-a citit nu se aruncă.

## 2. Cinci principii

Orice decizie de implementare se verifică față de ele.

1. **Un vector ține puține lucruri.** O ecuație are cel mult K termeni (K = 16 la pornire). Textele lungi se țin pe niveluri, nu în ecuații lungi.
2. **Cheile trebuie să difere, valorile trebuie să semene.** Cu ce legi (ordinea, atomii de structură) trebuie să fie distinct. Ce legi (tokeni, atomi de sens) trebuie să semene când este de același fel.
3. **Tot ce se rescrie trebuie să se poată reface.** Din orice formă rescrisă se obține exact textul inițial.
4. **Asemănarea propune, criteriul hotărăște.** Asemănarea găsește candidați. Un tipar rămâne numai dacă scurtează memoria și nu strică predicția.
5. **Forma exactă este adevărul, vectorii o aproximează.** Vectorii se calculează din forma exactă și nu se păstrează ca sursă de adevăr. Orice decizie luată cu vectori se poate verifica pe forma exactă.

## 3. Concepte

**Piese**

| Piesă | Rol | De unde vine |
| --- | --- | --- |
| Token | valoare | dat de tokenizer; câte un atom random pentru fiecare |
| Atom de sens, N | valoare | numele unei ecuații din memorie |
| Atom de structură, S | cheie cu sens | creat în somn, pentru un loc liber dintr-un tipar |
| Ordinea, ρ | cheie fără sens | operație: al k-lea copil este permutat de k ori |
| Înglobarea, ν | cheie fără sens | operație: a doua permutare, aplicată unui atom de sens când intră în ecuația de deasupra |

**Cele patru feluri de definiții.** Fiecare atom de sens are în memorie exact o definiție, de unul din aceste feluri.

| Fel | Ce spune | Exemplu |
| --- | --- | --- |
| Înșiruire | „acești copii, în această ordine”. Așa arată orice unitate imediat după veghe | N3 = \[N1, N2, \[.\]\] |
| Alegere | „unul dintre acești membri” | N5 = {N1, N4} |
| Tipar | o înșiruire în care unii copii sunt ficși, iar alții sunt locuri libere | N6 = \[S1, N2, \[.\]\], unde S1 acceptă N5 |
| Aplicare | un tipar, cu ce s-a pus la fiecare loc liber | N3 = N6(S1: N1) |

```
„Ana citește.”      tokeni: [An][a][ cit][ește][.]        (împărțirea este ilustrativă)

după veghe:   N1 = [[An], [a]]            cuvântul „Ana”
              N2 = [[ cit], [ește]]       cuvântul „citește”
              N3 = [N1, N2, [.]]          propoziția

după somn:    N5 = {N1, N4}               „Ana sau Maria”
              N6 = [S1, N2, [.]]          „cineva citește.”
              N3 = N6(S1: N1)             aceeași propoziție, rescrisă
```

- **Copiii unei unități nu se schimbă la rescriere.** N3 are aceiași copii și ca înșiruire, și ca aplicare. Se schimbă doar felul în care sunt ținuți minte.
- **Loc legat.** Același atom de structură poate apărea de mai multe ori într-un tipar; atunci poartă de fiecare dată același lucru.
- **Tipar cuibărit.** Un copil al unui tipar poate fi alt tipar, cu locurile lui legate de locurile celui de deasupra. Așa un tipar devine o regulă:

```
„Ana are cartea. Cine are cartea? Ana.”

T1 = [S1, [ are], S2, [.]]            „cineva are ceva.”
T2 = [[Cine], [ are], S2, [?]]        „Cine are ceva?”
T3 = [S1, [.]]                        „cineva.”
R  = [T1(S1, S2), T2(S2), T3(S1)]     regula: răspunsul este cel din primul fapt

textul = R(S1: Ana, S2: cartea)
```

## 4. Reguli generale de implementare

- **Mediu.** Node.js 20 sau mai nou. Fișiere `.mjs`, cu `"type": "module"` în `package.json`.
- **Fără dependențe.** Niciun pachet npm. Sunt permise doar modulele `node:fs`, `node:path`, `node:assert`, `node:test`, `node:worker_threads` și `node:os`. Fișierele tokenizerului GPT-2 (vocabularul și regulile de lipire) sunt date, nu cod.
- **Determinism.** Aceeași sămânță, aceeași configurare și aceleași date dau fișiere de ieșire identice, octet cu octet. Sunt interzise `Math.random`, ora curentă în logică și orice rezultat care depinde de ordinea în care termină firele de execuție.
- **Hazard.** Tot hazardul vine dintr-un generator propriu, `rng(seed)` (mulberry32), dat explicit funcțiilor care au nevoie de el.
- **Ordine stabilă.** Orice listă de candidați se sortează după scor descrescător, apoi după id crescător. Două scoruri mai apropiate de 1e-9 se consideră egale.
- **Fără stare globală.** Totul trece prin obiectele `Memory` și `Config`.
- **Un singur loc care scrie.** Memoria se modifică numai în `memory/store.mjs`, prin `intern` (la veghe) și `commit` (la somn). Restul modulelor doar citesc.
- **Numere.** Id-urile sunt întregi fără semn pe 32 de biți. Vectorii sunt `Float32Array`. Ponderile și scorurile sunt `number`.
- **Erori.** O încălcare de invariant aruncă o eroare cu numărul invariantului (de exemplu `I2`). Nu se continuă niciodată în tăcere.
- **Jurnal.** Fiecare rulare scrie `runs/<nume>/log.jsonl`: o linie pentru fiecare trecere de somn, cu versiunea memoriei, totalul, numărul de tipare și alegeri și timpul.
- **Fără cunoștințe de limbă în cod.** Singura cunoaștere dată este tabelul de granițe din secțiunea 8. Nu se adaugă liste de cuvinte, categorii gramaticale sau reguli pentru o limbă anume.

## 5. Structura proiectului

```
hdclm/
  package.json              "type": "module", fără dependențe
  config/default.json       toți parametrii din secțiunea 16
  src/
    core/rng.mjs            generatorul cu sămânță
    core/invariants.mjs     checkInvariants(memory): verificările din secțiunea 13
    hdc/strategy.mjs        interfața unei strategii și lista strategiilor
    hdc/exact.mjs           strategia exactă, fără vectori
    hdc/bipolar.mjs         prima strategie cu vectori
    hdc/check.mjs           verifică proprietățile oricărei strategii
    text/tokenizer.mjs      tokeni-cuvânt (pentru textul generat) și GPT-2
    text/boundaries.mjs     tăierea în unități: segment() și segmentPrefix()
    memory/store.mjs        atomi, definiții, intern(), commit(), indexuri
    memory/similarity.mjs   asemănarea exactă
    memory/size.mjs         mărimea unei definiții și totalul
    wake/ingest.mjs         text -> unități -> tampon
    sleep/recognize.mjs     potrivirea unităților cu tiparele cunoscute
    sleep/group.mjs         gruparea unităților care seamănă
    sleep/propose.mjs       din grup în tipar: locuri, ridicare, legare, alegeri
    sleep/package.mjs       judecata pachetului
    sleep/pass.mjs          o trecere: memorie + tampon -> pachet -> commit
    sleep/scheduler.mjs     somn ușor, somn adânc, fire de fundal
    predict/distribution.mjs  probabilitatea tokenului următor
    predict/generate.mjs    generarea unui răspuns
    data/generate.mjs       seturile G1–G9
    eval/metrics.mjs        eroare de predicție, refacere, total
    eval/experiments/       câte un fișier pentru fiecare experiment: A1.mjs, A2.mjs, …
    cli.mjs                 comenzi: ingest, sleep, predict, generate, experiment
  test/                     câte un fișier de test pentru fiecare modul
  data/                     texte și fișierele tokenizerului
  runs/                     rezultate; nu intră în controlul versiunilor
```

Dependențele dintre module merg într-un singur sens: `core` → `hdc`, `text` → `memory` → `wake`, `sleep`, `predict` → `eval`. Un modul nu importă niciodată din dreapta lui.

## 6. Modelul de date și memoria

Aceasta este forma exactă. Tot restul se calculează din ea.

```js
// Trei feluri de atomi. Fiecare are un id întreg, unic.
// Token:  { id, kind: 'TOKEN',  text, choices }              text = șirul exact al tokenului
// Sense:  { id, kind: 'SENSE',  level, def, count, choices } choices = alegerile din care face parte
// Struct: { id, kind: 'STRUCT', pattern, accepts }           accepts = id-ul unei alegeri

// def este exact una dintre:
// { type: 'SEQ',     items: [atomId, ...] }                  1..K copii: tokeni sau atomi de sens
// { type: 'CHOICE',  members: Map(atomId -> pondere) }       cel puțin 2 membri
// { type: 'PATTERN', items: [Item, ...], slots: [structId, ...] }
//       Item = { fixed: atomId }                             copil fix
//            | { slot: structId }                            loc liber
//            | { sub: patternId, args: [structId, ...] }     tipar cuibărit; args leagă locurile lui
//       slots = locurile libere distincte, în ordinea primei apariții
// { type: 'APP',     pattern: patternId, fills: [atomId, ...] }   câte o valoare pentru fiecare loc din slots
```

**Niveluri.** 0 token, 1 cuvânt, 2 parte de propoziție, 3 propoziție, 4 paragraf, 5 document. Un tipar sau o alegere are nivelul unităților pe care le descrie.

**Funcțiile memoriei** (`memory/store.mjs`):

| Funcție | Ce face |
| --- | --- |
| `children(id)` | lista copiilor. Pentru o înșiruire: `items`. Pentru o aplicare: tiparul cu locurile înlocuite de valori; un tipar cuibărit dă aplicarea lui |
| `unfold(id)` | lista tokenilor, coborând prin `children` până la tokeni |
| `intern(def)` | întoarce id-ul unității cu acești copii; o creează doar dacă nu există |
| `parents(id)` | unitățile care îl au pe `id` copil, cu poziția |
| `byLevel(level)` | toți atomii de sens de pe un nivel, pe feluri |
| `commit(pachet)` | singura cale prin care somnul modifică memoria; crește `version` cu 1 |

- **O unitate, un id.** Două unități cu aceeași listă de copii au același id. Cuvântul „Ana” este un singur atom, oriunde apare. `count` spune de câte ori a fost citită unitatea.
- **Rescrierea păstrează id-ul.** Când o înșiruire devine aplicare, atomul rămâne același, cu aceiași copii. Părinții lui nu se ating.
- **Tampon și rest.** `buffer[level]` ține unitățile noi, nevăzute încă de somn. `residue[level]` ține înșiruirile pe care somnul le-a văzut și nu le-a putut pune într-un tipar. Ele rămân candidate la somnurile următoare.
- **Citire în timpul unei treceri.** Cât durează o trecere de somn, memoria este doar citită; orice încercare de scriere în afara lui `commit` aruncă eroare.
- **Pe disc.** `atoms.jsonl`, o linie pentru fiecare atom, în ordinea id-urilor. Vectorii nu se salvează; se recalculează.

**Interpretări alternative.** `alternatives[id]` ține celelalte rescrieri posibile ale unei unități, fiecare cu ponderea ei (mărimea grupului din care vine). Prima implementare le păstrează, dar folosește numai rescrierea principală. Somnul adânc poate înlocui principala cu o alternativă, dacă totalul scade.

**Mărimea, pentru criteriul somnului** (`memory/size.mjs`):

| Definiție | Mărime, în termeni |
| --- | --- |
| Înșiruire | numărul de copii |
| Alegere | numărul de membri |
| Tipar | numărul de copii, plus numărul de argumente ale tiparelor cuibărite |
| Aplicare | 1, plus numărul de locuri libere |
| Unitate derivată | 0. Este o unitate care apare numai ca rezultat al unui tipar cuibărit, deci se poate reface din părintele ei |

Totalul este suma mărimilor tuturor atomilor de sens. Fiecare unitate distinctă se numără o singură dată. A doua măsură, în biți, numără pentru fiecare trimitere logaritmul numărului de variante dintre care se alege; care dintre ele rămâne hotărăște experimentul D1.

## 7. Stratul HDC

Felul vectorilor, mărimea lor și felul în care se fac operațiile formează o strategie. Restul sistemului vorbește cu ea numai prin interfața de mai jos, deci strategia se poate schimba fără a schimba altceva.

```js
// src/hdc/strategy.mjs: orice strategie exportă un obiect cu aceste funcții
newAtom(rng)                 // -> V   atom random
bind(key, value)             // -> V   leagă o cheie de o valoare
unbind(key, bound)           // -> V   scoate valoarea înapoi
bundle(vectors, weights)     // -> V   sumă cu ponderi, NErotunjită
order(v, k)                  // -> V   ρ aplicat de k ori
embed(v)                     // -> V   ν
normalize(v)                 // -> V   lungime 1, ponderile relative păstrate
similarity(a, b)             // -> număr între -1 și 1
nearest(query, candidates, n)  // -> [{ id, sim }]  cei mai asemănători n
```

**Proprietăți cerute.** `hdc/check.mjs` le verifică pe 10.000 de încercări pentru orice strategie. Toleranța t este 5/√D, adică 0,078 la D = 4.096.

| Nr. | Proprietate | Verificare |
| --- | --- | --- |
| H1 | doi atomi noi nu seamănă | asemănarea lor este sub t în valoare absolută |
| H2 | legarea se desface exact | `unbind(k, bind(k, v))` este egal cu `v` |
| H3 | legarea ascunde | `bind(k, v)` nu seamănă nici cu `k`, nici cu `v` |
| H4 | legarea păstrează asemănarea | asemănarea dintre `bind(k, a)` și `bind(k, b)` este cea dintre `a` și `b` |
| H5 | suma seamănă cu termenii | pentru trei atomi cu ponderi egale, asemănarea sumei cu fiecare este 0,577 ± t |
| H6 | ponderile se păstrează | pentru `a + 0,9·b`, asemănarea cu `b` este 0,669 ± t, și după `normalize` |
| H7 | ordinea desparte pozițiile | `order(x, 1)` nu seamănă cu `x`; `order` păstrează asemănarea și se poate inversa |
| H8 | înglobarea desparte nivelurile | `embed(order(x, 1))` nu seamănă cu `order(embed(x), 1)`; structurile \[\[a,b\],\[c,d\]\] și \[\[a,c\],\[b,d\]\] au asemănarea sub 0,6 |

**Cum se construiesc vectorii din forma exactă.** Fiecare token, atom de structură, alegere și tipar are un atom random al lui, numit etichetă (`tag`), fixat de sămânță și de id.

```
comp(unitate) = normalize( suma după k din  order( embed( enr(copil_k) ), k ) )      compoziție
enr(x)        = normalize( comp(x) + w · suma etichetelor alegerilor din care x face parte )   îmbogățit
comp(token)   = eticheta tokenului
comp(alegere) = normalize( suma după membri din  pondere · comp(membru) )
detect(tipar) = ca la comp(unitate), cu:  copil fix -> enr(copil);  loc liber -> comp(alegerea acceptată);
                tipar cuibărit -> detect(tiparul cuibărit)
deep(aplicare) = normalize( eticheta tiparului + suma după locuri din  bind( eticheta locului, embed( enr(valoare) ) ) )
```

| Vector | La ce se folosește |
| --- | --- |
| `comp` | asemănarea între unități; din el se construiesc alegerile |
| `enr` | valoarea cu care un atom intră în ecuația de deasupra |
| `detect` | recunoașterea: o unitate nouă seamănă cu `detect` al tiparului ei |
| `deep` | forma cu atomi de structură: din ea se scoate valoarea unui loc prin `unbind` |

**Strategia exactă** (`hdc/exact.mjs`) nu are vectori. Asemănarea ei se calculează direct pe definiții și este referința pentru toate celelalte:

```
simC(x, y) = 1                         dacă x și y sunt același atom
           = 0                         dacă unul este token și sunt diferiți
           = suma după k din simE(copil_k(x), copil_k(y)) / radical(nx · ny)      altfel

simE(x, y) = ( simC(x, y) + w² · |Cx ∩ Cy| ) / radical( (1 + w²·|Cx|) · (1 + w²·|Cy|) )

nx, ny = numărul de copii;  suma merge până la cel mai mic dintre ele
Cx, Cy = alegerile din care fac parte x și y (și un token poate fi membru al unei alegeri)
w      = ponderea îmbogățirii
```

Acestea sunt exact valorile pe care le-ar da `similarity(comp(x), comp(y))` și `similarity(enr(x), enr(y))` cu vectori fără zgomot. Rezultatele se țin minte după perechea de id-uri și versiunea memoriei.

**Prima strategie cu vectori** (`hdc/bipolar.mjs`): atomi cu componente +1 și −1; `bind` și `unbind` sunt înmulțirea pe componente; `bundle` este suma cu ponderi; `order` și `embed` sunt două permutări random independente, generate din sămânță; `similarity` este cosinusul; `nearest` parcurge toți candidații.

Alte strategii de încercat, cu aceeași interfață: binară densă (XOR și majoritate), fazori (adunare de unghiuri), rară pe blocuri. Mărimi: între 1.024 și 65.536 de componente. Strategia și mărimea le aleg experimentele B1–B5.

## 8. Veghea

Veghea transformă un text în unități și le pune în memorie. Nu caută nimic și nu hotărăște nimic: același text dă mereu aceleași unități.

```
ingest(text):
  tokens = tokenize(text)                    // text/tokenizer.mjs
  tree   = segment(tokens)                   // text/boundaries.mjs; nu citește memoria
  pentru fiecare nod din tree, copiii înaintea părintelui:
      dacă nodul are un singur copil și niciun token de închidere: nodul se înlocuiește cu copilul
      dacă nodul are mai mult de K copii: se împarte în bucăți consecutive de cel mult K (repetat, dacă trebuie)
      id = memory.intern({ type: 'SEQ', items: id-urile copiilor })
      memory.count[id] += 1
      dacă id este nou: memory.buffer[nivel].push(id)
  întoarce id-ul documentului
```

**Tokenizerul** are două moduri și întoarce pentru fiecare token: `id`, `text`, `spaceBefore`, `newlineBefore`.

- **Tokeni-cuvânt**, pentru textul generat: fiecare cuvânt și fiecare semn de punctuație este un token.
- **GPT-2**, pentru text adevărat: implementarea regulilor de lipire, citite din fișierele publice ale tokenizerului. Spațiul este lipit de tokenul care urmează.

**Reguli de tăiere** (`segment`). Tokenul care închide o unitate este ultimul ei copil.

| Nivel | Unitate | Se închide |
| --- | --- | --- |
| 1 | cuvânt | înaintea unui token cu `spaceBefore` sau `newlineBefore` |
| 2 | parte de propoziție | după \[,\] \[;\] \[:\] |
| 3 | propoziție | după \[.\] \[!\] \[?\], dar numai dacă tokenul următor are `spaceBefore` sau `newlineBefore`, ori textul s-a terminat |
| 4 | paragraf | înaintea unui token cu `newlineBefore` |
| 5 | document | la sfârșitul textului |
| 2 | pereche | de la ( \[ { „ până la perechea ei; ambele semne sunt copii ai unității. O deschidere fără pereche este un token obișnuit |

- **Regula de formă** de la nivelul 3 face ca punctul din „3.14”, din „a.b” sau dintr-o adresă web să nu închidă propoziția. Punctul din „Dr. Pop” o închide greșit; cât de des se întâmplă măsoară experimentul C3.
- **Unități cu un singur copil** nu se creează: un cuvânt făcut dintr-un singur token este chiar acel token. Așa nu apar lanțuri de atomi care spun același lucru.
- **Granițele sunt tokeni obișnuiți.** Rămân în ecuație și își capătă sensul prin învățare: \[?\] și \[.\] la capătul unei propoziții dau unități diferite.
- **`segmentPrefix(tokens)`** este a doua funcție a modulului. Primește un început de text și întoarce unitățile încă deschise, pe niveluri, fiecare cu copiii de până acum. Predicția o folosește, deci veghea și predicția taie textul cu același cod.
- **Tabelul de mai sus este singura cunoaștere dată de noi.** Ține de felul în care este scris textul, nu de limbă.

## 9. Somnul: o trecere, pas cu pas

O trecere citește memoria, face un pachet de propuneri și îl aplică la sfârșit, dintr-odată. Cât durează trecerea, memoria nu se schimbă.

```
sleepPass(memory):
  memory.beginPass()                                   // de aici memoria este doar citită
  pachet = []
  pentru nivel de la 1 la 5:                           // de jos în sus
      unități = buffer[nivel] + residue[nivel]         // numai înșiruiri
      (potrivite, rămase) = recognize(unități)         // pasul 1
      grupuri   = group(rămase)                        // pasul 2
      propuneri = propose(grupuri)                     // pasul 3
      pachet   += potrivite + propuneri
  pachet = judge(pachet)                               // pasul 4
  memory.commit(pachet)                                // pasul 5; version += 1
```

Nivelul de deasupra vede tiparele propuse mai jos în aceeași trecere, pentru că are nevoie de ele la pasul 3. Asemănările rămân însă cele de la începutul trecerii.

**Pasul 1: recunoaștere.** Fiecare unitate se încearcă pe tiparele cunoscute de pe nivelul ei, cu același număr de copii. Tiparul se parcurge copil cu copil:

- copil fix: copilul unității trebuie să fie exact acel atom;
- loc liber: copilul unității devine valoarea locului. Este acceptat dacă este membru al alegerii, sau dacă asemănarea lui medie cu membrii este cel puțin θ\_accept; atunci se propune ca membru nou;
- loc legat (același loc a doua oară): copilul trebuie să fie exact valoarea deja pusă;
- tipar cuibărit: copilul trebuie să fie o aplicare a acelui tipar, cu valori care se potrivesc cu locurile deja puse.

Dacă se potrivesc mai multe tipare, câștigă cel cu cei mai puțini membri noi, apoi cel cu cei mai mulți copii ficși, apoi cel cu id-ul mai mic. Celelalte se țin ca interpretări alternative.

**Pasul 2: grupare.** Unitățile rămase se grupează după ce au în comun.

```
pentru fiecare unitate u cu n copii, n >= 2:
  pentru fiecare mulțime F de poziții libere, cu 1 <= |F| <= f_max și |F| < n:
      cheie = (nivel, n, F, copiii lui u de pe pozițiile din afara lui F)
      găleată[cheie].push(u)

grup = orice găleată cu cel puțin m_min unități, în care fiecare poziție din F are cel puțin 2 valori diferite
```

- Condiția |F| < n cere cel puțin un copil fix. Așa nu apare tiparul banal, cu toate locurile libere.
- Grupurile se iau în ordine: întâi cele cu mai puține poziții libere, apoi cele mai mari, apoi după cheie. O unitate intră în primul grup care o cuprinde; celelalte grupuri ale ei devin interpretări alternative.
- Cu o strategie cu vectori, candidații se găsesc cu `nearest` peste `comp`, cu pragul θ\_group, și se verifică apoi la fel, pe forma exactă. Aceasta este operația „adună ce seamănă”: în suma unui grup, copiii comuni ies grei, iar pe pozițiile libere se adună valorile.

**Ce nu face prima implementare la grupare.** Grupează numai unități cu același număr de copii, aliniate de la început. Deplasarea, adică același tipar început pe altă poziție („Ieri Ana citește.”), se adaugă pentru experimentul D4, în două variante: aliniere de la sfârșitul unității și un copil sărit.

**Pasul 3: din grup în tipar.** Pentru un grup cu pozițiile libere F:

1. **Coloane.** Pentru fiecare poziție liberă se ia coloana ei: valoarea din fiecare unitate a grupului.
2. **Ridicare.** Dacă toate valorile unei coloane sunt aplicări ale aceluiași tipar q, poziția devine tiparul cuibărit q, iar locurile lui q devin locuri ale tiparului nou, fiecare cu coloana lui. Se repetă cel mult d\_max niveluri în jos.
3. **Legare.** Locurile cu coloane identice devin un singur loc.
4. **Alegeri.** Pentru fiecare loc, valorile coloanei formează o alegere, cu ponderea de câte ori apare fiecare. Dacă există deja o alegere, în memorie sau în pachet, cu care are în comun cel puțin θ\_merge din membri, se folosește aceea și i se adaugă membrii lipsă.
5. **Tipar și aplicări.** Se propune tiparul și, pentru fiecare unitate din grup, rescrierea ei ca aplicare. Dacă există deja un tipar identic, se folosește acela.

```
grup:       [Ana, citește, .]   [Maria, citește, .]   [Ion, citește, .]          F = {0}
coloana 0:  Ana, Maria, Ion

propunere:  alegerea  N5 = {Ana, Maria, Ion}
            tiparul   N6 = [S1, citește, .]        S1 acceptă N5
            rescrieri: fiecare unitate devine N6(S1: …)
```

**Pasul 4: judecata pachetului** (`sleep/package.mjs`).

```
judge(pachet):
  repetă:
      pentru fiecare tipar propus p:
          câștig(p) = totalul fără p  −  totalul cu p
          // fără p: unitățile lui rămân înșiruiri, iar alegerile pe care nu le mai folosește nimeni dispar
      dacă cel mai mic câștig este <= 0: se scoate acel tipar și tot ce depinde de el
  până când toate câștigurile sunt > 0
  dacă există text de validare: eroarea de predicție cu pachetul nu are voie să fie mai mare decât fără el;
      altfel pachetul se împarte în două și se păstrează jumătățile care trec, repetat
```

- **De ce în pachet.** Zece nume, fiecare în „Nume citește.” și „Nume scrie.”, înseamnă 60 de termeni. Rescris doar grupul cu „citește”: 63. Rescrise amândouă, cu aceeași alegere de nume: 56. Judecată singură, prima rescriere s-ar respinge.
- **De ce nu ajunge mărimea.** Tiparul „oraș este capitala țară” reface exact textele citite, dar acceptă și „Paris este capitala Italiei”. Dacă un tipar este bun se vede numai din predicția pe text pus deoparte.
- **Ce nu vede măsura în termeni.** Un tipar cu două locuri libere costă, la fiecare aplicare, un termen mai mult decât două tipare cu câte un loc, deci în termeni nu se plătește aproape niciodată. Măsura în biți nu are această problemă. Este motivul pentru care experimentul D1 compară cele două măsuri.

**Pasul 5: commit.** Într-o singură operație:

1. se creează atomii noi: alegeri, tipare, locuri;
2. unitățile rescrise devin aplicări, cu același id și aceiași copii;
3. unitățile nepotrivite trec din tampon în rest; tamponul se golește;
4. abia acum se actualizează `choices` la membrii alegerilor. Asemănările se schimbă deci numai pentru trecerea următoare;
5. `version` crește cu 1 și se rulează `checkInvariants`.

## 10. Când rulează somnul

**Tamponul de veghe.** Unitățile noi se adună în tampon. Când tamponul ajunge la W unități, se cere un somn. Limita hotărăște când se doarme, nu ce se păstrează: nimic din ce s-a citit nu se aruncă.

| Fel de somn | Când | Ce parcurge | Ce face în plus |
| --- | --- | --- | --- |
| ușor | când tamponul are W unități | tamponul și restul | nimic: o trecere din secțiunea 9 |
| adânc | după fiecare N\_deep somnuri ușoare, sau la cerere | toată memoria | rejudecă tiparele vechi și le desface pe cele care nu se mai plătesc; contopește alegerile care au ajuns să aibă aproape aceiași membri; repetă treceri până când totalul nu mai scade |

- **De ce o limită.** Costul unui somn ușor rămâne mărginit, iar sistemul poate învăța dintr-un șir de texte fără sfârșit. Fără limită, fiecare somn ar parcurge tot ce s-a citit vreodată.
- **De ce și somn adânc.** Un tipar rar poate să nu aibă niciodată destule exemple într-un singur tampon. Exemplele lui așteaptă în rest, iar somnul adânc le vede pe toate împreună.
- **Modul simplu.** Cu W infinit, tot textul se citește întâi, apoi rulează un somn adânc. Blocul A de experimente folosește acest mod. Dacă somnul în trepte dă aceleași rezultate ca modul simplu măsoară experimentul D6.
- **Un tipar se poate desface.** Aplicările lui redevin înșiruiri, fără pierderi, pentru că fiecare unitate își știe copiii.

**Somn în fundal, pe fire de execuție.** Se poate, și decurge din regula că o trecere doar citește memoria:

1. Coordonatorul fixează versiunea memoriei și conținutul tamponului.
2. Munca trecerii se împarte în sarcini independente: recunoașterea pe felii de unități, gruparea pe niveluri, câștigul fiecărui tipar. Fiecare fir (`node:worker_threads`) citește aceeași versiune și întoarce propuneri.
3. Coordonatorul adună propunerile într-o ordine fixă, judecă pachetul și face singurul commit.
4. Veghea merge mai departe în acest timp. Ce citește ea intră în tampon și este văzut de trecerea următoare.

- **Regula de aur:** rezultatul cu fire trebuie să fie identic cu cel fără fire. De aceea firele nu scriu niciodată în memorie, iar ordinea în care termină nu contează.
- **Ordinea de implementare:** întâi varianta pe un singur fir, cu aceeași împărțire în sarcini. Firele se adaugă după ce testele trec, fără a schimba algoritmul.
- **Predicția în timpul somnului** citește ultima versiune încheiată.

## 11. Predicție și generare

Predicția răspunde la o singură întrebare: dat fiind începutul unui text, ce probabilitate are fiecare token să urmeze. Nu modifică memoria.

```
nextToken(tokens):                                  // predict/distribution.mjs
  stiva = segmentPrefix(tokens)                     // unitățile deschise; stiva[l].prefix = copiii de până acum
  întoarce P(stiva, cel mai de jos nivel deschis)

P(stiva, l):
  D = childDistribution(stiva, l)                   // probabilități peste copiii posibili și peste SFÂRȘIT
  rezultat = {}
  pentru fiecare (atom a, probabilitate p) din D:
      rezultat[primulToken(a)] += p                 // se adună toți atomii care încep cu același token
  dacă D[SFÂRȘIT] > 0:
      dacă l este nivelul cel mai de sus:  rezultat[SFÂRȘIT_DE_TEXT] += D[SFÂRȘIT]
      altfel:
          închis = unitatea de pe nivelul l, cu copiii din prefix      // temporară; nu intră în memorie
          rezultat += D[SFÂRȘIT] · P(stiva cu „închis” adăugat la prefixul nivelului l+1, l+1)
  întoarce rezultat
```

**`childDistribution`** combină patru surse. Fiecare se normalizează separat, apoi se amestecă în proporțiile λ1…λ4. Dacă o sursă lipsește, proporția ei se împarte la celelalte.

| Sursă | Ce propune | Când există |
| --- | --- | --- |
| 1. Tiparul | copilul următor al tiparului: copilul fix; valoarea unui loc deja pus; aplicarea unui tipar cuibărit cu toate locurile puse | când prefixul se potrivește cu începutul unui tipar, după regulile de la recunoaștere. Locurile pot fi puse și de unitățile deschise de deasupra |
| 2. Votul unităților | fiecare unitate din memorie, de pe același nivel, votează copilul ei de pe poziția următoare; cele care se termină aici votează SFÂRȘIT | întotdeauna, dacă memoria nu este goală |
| 3. Alegerea | membrii alegerii, după ponderea lor | când copilul următor al tiparului este un loc liber încă nepus |
| 4. Frecvența | orice atom care a fost vreodată copil pe acest nivel, după `count`; plus o parte mică, egală, pentru fiecare token din vocabular | întotdeauna |

```
greutatea votului unei unități v = count(v) · exp( β · (s − 1) )
s = media asemănărilor simE dintre copiii din prefix și copiii lui v de pe aceleași poziții   (s = 1 dacă prefixul e gol)
votează doar cele mai asemănătoare n_vote unități
```

- **Un text, un vot.** O unitate din memorie votează o singură dată, la sursa 2. Tiparul scos din ea nu îi mai adaugă un vot; sursele se amestecă, nu se înmulțesc.
- **Perechile se păstrează.** Votează unități întregi, deci după „Paris este capitala”, unitățile cu Paris seamănă cel mai mult și votează „Franței”.
- **Judecata vine din sursa 1.** La „Maria are ziarul. Cine are ziarul?”, regula din secțiunea 3 are deja locul S1 pus, deci propune „Maria”, chiar dacă propoziția nu a mai fost văzută.
- **Niciun token nu are probabilitatea 0.** Sursa 4 dă fiecărui token din vocabular o parte mică.

**Generarea** (`predict/generate.mjs`) repetă predicția:

```
generate(tokens, { stopLevel, maxTokens, sample }):
  repetă:
      d = nextToken(tokens)
      t = tokenul cel mai probabil din d                  // sau tras la sorți din d cu rng, dacă sample este true
      dacă t este SFÂRȘIT_DE_TEXT: stop
      tokens.push(t)
      dacă s-a închis o unitate de nivel >= stopLevel: stop       // de exemplu: o propoziție, un paragraf
      dacă s-au generat maxTokens: stop
```

Sistemul generează token cu token. Nu planifică de sus în jos: nu alege întâi ce propoziție vrea să spună și apoi cuvintele ei.

## 12. Contextul: intrare, ieșire, comparație cu un LLM

**La intrare nu există o fereastră fixă.** Un text de orice lungime devine un arbore de unități. Fiecare unitate are cel mult K copii, deci adâncimea crește încet: cu K = 16, patru niveluri țin circa 65.000 de tokeni, iar cinci niveluri circa un milion. Unitățile prea lungi se împart în bucăți, ceea ce adaugă niveluri.

**Ce vede predicția la un pas** este drumul de la tokenul curent până sus: unitățile deschise, câte una pe nivel, fiecare cu cel mult K copii de până acum. Cu cinci niveluri sunt cel mult 80 de copii. Cei de jos sunt tokeni exacți. Cei de sus sunt atomi de sens care țin locul unor propoziții și paragrafe întregi.

```
documentul:     [paragraful 1] [paragraful 2] [paragraful 3 …            rezumate
paragraful 3:   [propoziția 1] [propoziția 2] [propoziția 3 …
propoziția 3:   [Maria] [ are] [ ziarul] …                                exact
```

**Ce este departe nu se pierde, dar se vede grosier.** Un paragraf vechi este un singur atom în prefixul documentului. Conținutul lui exact stă în memorie și se poate desfășura. Predicția se uită însă înăuntrul lui numai dacă un tipar leagă un loc de acolo. Cât de departe poate găsi singur faptul util măsoară experimentul A7.

**La ieșire, lungimea o hotărăște tot predicția.** Sfârșitul unei unități este prezis ca orice alt lucru. Sistemul învață unde să se oprească din unitățile din memorie: dacă răspunsurile văzute au câte o propoziție, după o propoziție votul pentru sfârșit este mare. Din afară se pot pune două limite: nivelul la care se oprește (`stopLevel`) și numărul maxim de tokeni.

**Tot ce citește poate deveni memorie.** Nu există o despărțire între învățare și folosire: o întrebare pusă sistemului este un text ca oricare altul. Dacă este ținută minte se hotărăște din configurare (`learnFromInput`).

|  | Un LLM | Sistemul acesta |
| --- | --- | --- |
| Ce vede la un pas | ultimii N tokeni, toți la fel de exact. N este fix: de la câteva mii la peste un milion | unitățile deschise, cel mult K copii pe nivel. Aproape vede exact, departe vede rezumate |
| Limita la intrare | fereastra N | niciuna fixă; adâncimea crește cu lungimea |
| Ce iese din vedere | se pierde | rămâne în memorie |
| Cum alege ce contează | atenție învățată, între oricare doi tokeni din fereastră | tipare cu locuri legate și asemănare cu unitățile din memorie; numai ce a descoperit somnul |
| Lungimea ieșirii | până prezice tokenul de sfârșit sau atinge o limită | la fel: până se închide unitatea cerută sau atinge o limită |
| Cum învață să se oprească | din textele de antrenare, care se termină | din unitățile din memorie, care se închid |
| Când învață | la antrenare; apoi nu se mai schimbă | continuu: ce citește intră în memorie, iar somnul compactează |
| Cost pe token | crește cu N | crește cu numărul de niveluri și cu câtă memorie se caută |

Unde pierde, din construcție: un LLM poate lega oricare doi tokeni din fereastră, iar sistemul leagă doar ce îi spun tiparele. Unde ar putea câștiga: nu uită ce a ieșit din fereastră, învață din mers și memoria lui se poate citi. Niciuna dintre aceste afirmații nu este măsurată încă.

## 13. Invarianți

Trebuie să fie adevărați după fiecare commit. `checkInvariants(memory)` îi verifică pe toți; în teste rulează după fiecare trecere.

| Nr. | Invariant | Cum se verifică |
| --- | --- | --- |
| I1 | **Refacere.** Textul unui atom nu se schimbă niciodată: `unfold(id)` dă aceiași tokeni înainte și după orice commit | se compară `unfold` pentru fiecare atom atins de commit |
| I2 | **Copii neschimbați.** `children(id)` este aceeași listă înainte și după o rescriere | la fel, pentru `children` |
| I3 | **O unitate, un id.** Nu există doi atomi de sens cu aceeași listă de copii | tabela de internare nu are chei duble |
| I4 | **Mărimi.** O înșiruire sau un tipar are între 1 și K copii; o alegere are cel puțin 2 membri | parcurgerea tuturor definițiilor |
| I5 | **Tipar valid.** Fiecare tipar are cel puțin un copil fix sau cuibărit și cel puțin un loc liber; un atom de structură aparține unui singur tipar | parcurgerea tiparelor |
| I6 | **Aplicare validă.** Are câte o valoare pentru fiecare loc al tiparului, iar fiecare valoare este membru al alegerii acceptate de loc | parcurgerea aplicărilor |
| I7 | **Memorie înghețată în trecere.** Între `beginPass` și `commit` nu se scrie nimic în memorie | orice scriere aruncă eroare |
| I8 | **Totalul nu crește.** După un commit de somn, totalul este cel mult cât era înainte, în măsura aleasă | se calculează înainte și după |
| I9 | **Determinism.** Două rulări cu aceeași sămânță dau aceleași fișiere; cu fire și fără fire, la fel | se compară fișierele octet cu octet |
| I10 | **Probabilități.** Distribuția tokenului următor are suma 1 (cu abatere sub 1e-9) și niciun token nu are 0 | verificat la fiecare apel, în teste |
| I11 | **Date despărțite.** Niciun document de validare sau de test nu intră în memorie la învățare | lista documentelor citite se compară cu împărțirea |
| I12 | **Aceeași tăiere.** Unitățile deschise date de `segmentPrefix` pentru primii n tokeni coincid cu drumul din arborele dat de `segment` pe tot textul | test pe texte la întâmplare, pentru fiecare n |
| I13 | **Strategie verificată.** O strategie cu vectori se folosește numai după ce trece `hdc/check.mjs` | verificarea rulează la pornire |
| I14 | **Vectorii vin din forma exactă.** Niciun vector nu se salvează și nu se modifică direct; se recalculează din definiții | nu există funcție care scrie un vector în memorie |
| I15 | **Nimic nu se pierde.** Orice unitate citită rămâne în memorie, ca înșiruire sau ca aplicare | numărul de unități nu scade niciodată |

## 14. Greșeli previzibile

Fiecare este ușor de făcut și strică un principiu. Coloana din dreapta spune ce o oprește.

| Nr. | Greșeala | Ce strică | Ce o oprește |
| --- | --- | --- | --- |
| 1 | rotunjirea sumelor la +1 și −1 | termenii ușori dispar: din `a + 0,9·b` rămâne doar `a` | `bundle` nu rotunjește; proprietatea H6 |
| 2 | o singură permutare pentru ordine și pentru înglobare | structuri diferite dau același vector | două permutări; proprietatea H8 |
| 3 | alegeri construite din vectorul îmbogățit | membrii seamănă pentru că au fost grupați, iar asemănarea confirmă gruparea | alegerile folosesc numai `comp` și `simC` |
| 4 | asemănări recalculate în timpul unei treceri | același cerc | invariantul I7; `choices` se actualizează doar la commit |
| 5 | rescrieri acceptate una câte una | o alegere refolosită nu ajunge niciodată să se plătească | judecata în pachet; experimentul A2 |
| 6 | tipar cu toate locurile libere | soluția banală: nu s-a învățat nimic | condiția `\|F\| < n`; invariantul I5 |
| 7 | id nou pentru unitatea rescrisă | părinții ei arată spre un atom care nu mai există | rescrierea păstrează id-ul; invarianții I1 și I2 |
| 8 | un text numărat de două ori la vot | dovezile par mai multe decât sunt | sursele se amestecă, nu se înmulțesc; o unitate votează o singură dată |
| 9 | probabilitate 0 pentru un token nevăzut | eroarea de predicție devine infinită | sursa 4; invariantul I10 |
| 10 | alegerea atomului cel mai probabil și desfășurarea lui, în loc de suma pe tokeni | probabilitatea tokenului este greșită: „Ana” 0,3 și „Anca” 0,3 dau \[An\] 0,6 | funcția `P` adună toți atomii cu același prim token |
| 11 | tăiere diferită la veghe și la predicție | prefixul nu se mai potrivește cu nimic din memorie | același modul; invariantul I12 |
| 12 | text de validare sau de test ajuns în memorie; parametri aleși pe test | rezultate prea bune, fără valoare | invariantul I11; testul final se folosește o singură dată |
| 13 | `Math.random`, sau rezultate care depind de ordinea firelor | rulările nu se mai pot repeta | `rng(seed)`; sortare stabilă; invariantul I9 |
| 14 | egalitate între scoruri comparată direct | ordinea candidaților se schimbă de la o rulare la alta | pragul 1e-9 și departajarea după id |
| 15 | asemănare sau desfășurare recursivă fără ținere de minte | timp care explodează, pentru că aceeași unitate are mulți părinți | rezultatele se țin după id și versiune |
| 16 | prea multe poziții libere încercate la grupare | numărul de chei explodează | limita f\_max |
| 17 | liste de cuvinte sau reguli de limbă adăugate „ca să meargă” | sistemul nu mai învață doar din text | regula din secțiunea 4; se verifică la revizuirea codului |
| 18 | vectori salvați și folosiți ca sursă de adevăr | forma exactă și vectorii ajung să spună lucruri diferite | invariantul I14 |
| 19 | unități nepotrivite șterse | text pierdut; tiparele rare nu mai apucă să adune exemple | restul; invariantul I15 |
| 20 | aplicare al cărei copil cuibărit nu există ca atom | `children` și `unfold` eșuează | `commit` creează toți copiii înainte de rescriere |

## 15. Teste

Se rulează cu `node --test test/`, fără nimic instalat. Un modul nu este gata până nu are testele lui, iar un experiment nu se rulează cu teste picate.

| Test | Ce verifică | Fișier |
| --- | --- | --- |
| proprietățile strategiei | H1–H8, pentru fiecare strategie și mărime | `test/hdc.test.mjs` |
| exact față de vectori | pe unități la întâmplare, `similarity(comp(x), comp(y))` diferă de `simC(x, y)` cu mai puțin de t | `test/similarity.test.mjs` |
| tăiere | cazuri fixe: „3.14”, paranteze, unitate cu un singur copil, unitate cu mai mult de K copii; invariantul I12 pe texte la întâmplare | `test/boundaries.test.mjs` |
| refacere | după `ingest`, `unfold` dă exact tokenii citiți, pe G1–G9 și pe 1.000 de texte la întâmplare | `test/wake.test.mjs` |
| internare | același text citit de două ori nu creează atomi noi; `count` crește | `test/store.test.mjs` |
| somn, cazuri cu răspuns cunoscut | G1: exact 2 tipare și o alegere cu 10 membri; totalul propozițiilor este 56. G4: niciun tipar. G7: o regulă cu două locuri legate | `test/sleep.golden.test.mjs` |
| judecata | exemplul 60 / 63 / 56: acceptarea una câte una respinge, pachetul acceptă | `test/package.test.mjs` |
| invarianți | `checkInvariants` după fiecare commit, în toate testele de somn | `test/invariants.test.mjs` |
| predicție | suma 1 și niciun 0; „Ana” și „Anca” dau \[An\] 0,6; după „Paris este capitala” câștigă „Franței” | `test/predict.test.mjs` |
| determinism | două rulări dau aceleași fișiere; cu fire și fără fire, la fel | `test/determinism.test.mjs` |
| date | nicio suprapunere între învățare, validare și test | `test/data.test.mjs` |

Fiecare greșeală din secțiunea 14 trebuie să aibă cel puțin un test care pică atunci când greșeala este făcută.

## 16. Parametri

Toți stau în `config/default.json`. Valorile sunt puncte de pornire alese de mine. O valoare se schimbă numai prin experimentul ei și numai pe textul de validare.

| Parametru | Pornire | Ce este | Cine hotărăște |
| --- | --- | --- | --- |
| K | 16 | numărul maxim de copii ai unei unități | B2 |
| strategia, D | bipolară, 4.096 | felul și mărimea vectorilor | B1–B5 |
| w | 0,5 | ponderea îmbogățirii | A4, E3 |
| f\_max | 2 | câte poziții libere se încearcă la grupare | D1 |
| m\_min | 2 | câte unități fac un grup | D1 |
| θ\_accept | 0,5 | asemănarea de la care o valoare nouă este acceptată la un loc liber | D1 |
| θ\_merge | 0,5 | partea comună de la care două alegeri devin una | D1 |
| θ\_group | din B3 | pragul de asemănare la grupare, cu vectori | B3, D1 |
| d\_max | 2 | câte niveluri în jos merge ridicarea | A6 |
| măsura | termeni | cu ce se calculează totalul: termeni sau biți | D1 |
| W | 10.000 | mărimea tamponului de veghe, în unități | D6 |
| N\_deep | 10 | după câte somnuri ușoare vine unul adânc | D6 |
| β | 4 | cât de repede scade votul cu asemănarea | E2 |
| n\_vote | 64 | câte unități votează | E2 |
| λ1 … λ4 | 0,4 / 0,3 / 0,2 / 0,1 | proporțiile celor patru surse de predicție | E2 |
| seed | 1 | sămânța generatorului | nimeni; se notează în jurnal |
| learnFromInput | false | dacă textul primit la predicție intră în memorie | nimeni; ține de folosire |

## 17. Date

Datele urcă pe trepte, de la text în care știm răspunsul la text adevărat. Toate sunt în engleză; limba nu este ce testăm.

| Treaptă | Date | De ce | Pentru blocurile |
| --- | --- | --- | --- |
| 1 | text generat de noi, dintr-o gramatică mică (G1–G6) | știm dinainte tiparele și alegerile adevărate, deci se poate verifica dacă sistemul le găsește | A, B5 |
| 2 | texte cu întrebări, în care răspunsul trebuie scos din ce s-a citit: întâi generate de noi (G7–G9), apoi sarcinile publice [bAbI](https://arxiv.org/abs/1502.05698) | arată dacă sistemul judecă: folosește textul din fața lui, nu doar ce a memorat | A, E |
| 3 | [TinyStories](https://arxiv.org/abs/2305.07759): povești scurte, cu circa 1.500 de cuvinte de bază | propoziții scurte, vocabular mic, multă repetiție. Este textul pe care tiparele ar trebui să apară cel mai ușor | C, D, E, la scară mică |
| 4 | corpusul tbsop: 6,3 milioane de tokeni scriși de oameni, din conversații, cărți, manuale și texte diverse | text variat și adevărat | C, D, E, F |

Textul generat (`data/generate.mjs`). Fiecare set adaugă o singură greutate.

| Set | Ce conține | Ce verifică |
| --- | --- | --- |
| G1 | 10 nume și 2 verbe: „Ana reads.” | două tipare cu aceeași alegere (A1, A2) |
| G2 | G1 plus un obiect | tipare cu două locuri libere (A1) |
| G3 | 20 de orașe, fiecare cu țara lui | perechile (A3) |
| G4 | cuvinte puse la întâmplare | că nu apar tipare acolo unde nu există (A4) |
| G5 | G2 cu un cuvânt în față, uneori | deplasarea |
| G6 | cuvinte făcute din bucăți: rădăcini și terminații | tiparele din interiorul cuvintelor |
| G7 | un fapt și o întrebare despre el: „Ana has the book. Who has the book? Ana.” | răspunsul luat din faptul de alături (A5) |
| G8 | două fapte de combinat | doi pași (A6) |
| G9 | G7 cu propoziții fără legătură între fapt și întrebare | găsirea faptului util printre altele (A7) |

- **Tokeni.** În G1–G5 și G7–G9 se folosește modul tokeni-cuvânt, ca tokenizerul să nu încurce verificarea. De la G6 și pe text adevărat se folosește tokenizerul GPT-2, același peste tot.
- **Împărțire.** Pe documente întregi, nu pe propoziții: 80% învățare, 10% validare, 10% test final. Împărțirea se face o singură dată, din sămânță, și se salvează. Eroarea se raportează separat pe propozițiile care nu apar identic la învățare.
- **Combinații puse deoparte.** În seturile generate, o parte din combinații (de exemplu anumite perechi nume–obiect) nu apar deloc la învățare. Pe ele se măsoară dacă sistemul generalizează.
- **Atenție la treapta 3.** TinyStories este scris de un LLM. Este mai regulat decât textul scris de oameni, deci un rezultat bun acolo este un pas, nu dovada finală.
- **Cod.** Pentru experimentul F2 trebuie adăugat și cod sursă.
- **Ce este propunere.** Treapta 3 și tokenizerul sunt propuneri. O alternativă la treapta 3 sunt datele [BabyLM](https://arxiv.org/abs/2301.11796): 10 milioane de cuvinte, inspirate din ce aud copiii; mai naturale, dar mai puțin repetitive.

## 18. Experimente

Tot ce nu se poate hotărî din principii este mai jos, ca experiment. Niciunul nu a fost rulat.

Reguli:

- **Întâi mecanismul, apoi vectorii.** Blocul A rulează cu strategia exactă, pe text generat. Dacă mecanismul nu merge exact, restul nu se rulează până nu este reparat.
- **O întrebare, o regulă.** Fiecare experiment răspunde la o singură întrebare și are regula de decizie scrisă înainte de rulare.
- **Ordine.** Blocurile se rulează de la A la F. Ce fixează un bloc nu se mai schimbă în blocurile următoare.
- **De la mic la mare.** Pe fiecare treaptă de date, întâi 100.000 de tokeni, apoi un milion, apoi tot.
- **Referința.** Strategia exactă rulează alături de fiecare strategie cu vectori.
- **Jurnal.** Fiecare experiment scrie `runs/<experiment>/result.json`, cu configurarea, sămânța, măsurătorile și decizia. Rezultatul se trece și în acest document.
- **Pragurile** din regulile de decizie sunt alese de mine ca punct de pornire.

**Blocul A: mecanismul.** Strategia exactă, seturile G1–G4 și G7–G9, modul simplu (tot textul, apoi somn adânc).

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| A1 | Găsește sistemul singur două tipare care folosesc aceeași alegere? | seturile G1 și G2 | tiparele și alegerile găsite; totalul; refacerea textelor; eroarea de predicție pe propoziții puse deoparte | trebuie să iasă toate patru: două tipare cu o singură alegere, total mai mic, refacere 100%, eroare mai mică decât fără somn. Altfel se repară mecanismul înainte de orice altceva |
| A2 | Ajunge judecata în pachet? | acceptare una câte una; acceptare în pachet | totalul final | pachetul rămâne dacă dă un total mai mic. Dacă nici el nu ajunge la 56 de termeni, procedura se schimbă |
| A3 | Ține predicția cont de perechi? | setul G3 | probabilitatea dată țării corecte, față de celelalte țări | țara corectă trebuie să primească cea mai mare probabilitate în peste 95% din cazuri |
| A4 | Se confirmă gruparea singură? | setul G4; cu și fără înghețarea memoriei; ponderea îmbogățirii | câte tipare rămân acceptate după fiecare trecere | pe text fără structură nu trebuie să rămână niciun tipar. Ponderea îmbogățirii: cea mai mare la care asta încă ține |
| A5 | Răspunde la o întrebare din faptul de alături? | setul G7; cu și fără locuri legate | cât de des răspunsul corect primește cea mai mare probabilitate, pe combinații puse deoparte | peste 95% cu locuri legate; la întâmplare ar fi 10%. Fără locuri legate mă aștept să pice; dacă nu pică, locurile legate nu sunt necesare |
| A6 | Combină două fapte? | setul G8 | la fel ca la A5 | peste 90%. Altfel sistemul face un pas de judecată, dar nu doi |
| A7 | Găsește faptul util printre altele? | setul G9, cu 1 până la 5 propoziții între fapt și întrebare | răspunsul corect, după câte propoziții stau între | se notează până la câte propoziții rămâne peste 90%. Dacă pică de la prima, sistemul leagă doar propoziții alăturate |

**Blocul B: stratul HDC.** Date generate la întâmplare; la B5, textele din blocul A.

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| B1 | Cât de bine respectă strategia proprietățile H1–H8? | strategia, mărimea | fiecare proprietate, pe 10.000 de încercări | strategia care încalcă o proprietate iese. Abaterile celorlalte se notează |
| B2 | Câți copii ține o unitate? | strategia, mărimea, numărul de copii (2–256), numărul de candidați (până la 100.000) | cât de des un copil este recunoscut greșit din vector | K este cel mai mare număr de copii cu eroare sub 1% |
| B3 | De la ce asemănare în sus două unități „seamănă”? | strategia, mărimea, câți copii au în comun | asemănarea între unități fără legătură și între unități cu toți copiii comuni în afară de unul sau doi | θ\_group este valoarea care le desparte cu eroare sub 1%. Dacă nu există, mărimea este prea mică |
| B4 | Cât costă? | strategia, mărimea | memoria pe unitate; timpul unei căutări printre un milion de unități | dintre strategiile care trec B1–B3 se alege cea mai ieftină |
| B5 | Dă strategia cu vectori aceleași rezultate ca cea exactă? | blocul A, rulat din nou cu fiecare strategie rămasă | aceleași măsurători ca în blocul A | strategia rămâne dacă trece aceleași reguli de decizie |

**Blocul C: veghea.** Cu text adevărat, fără învățare.

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| C1 | Cât de des depășește o unitate K copii? | nivelul | numărul de copii ai unităților | sub 5% depășiri: împărțirea după mărime rămâne. Peste 5%: în D1 se compară cu tăierea la marginea celui mai lung tipar cunoscut |
| C2 | Se reface textul? | strategia; cu și fără definițiile din memorie | câte texte se refac exact, pe fiecare nivel | cu definiții trebuie 100%. Doar din vectori: se notează până la ce nivel merge |
| C3 | Câte granițe sunt înșelătoare? | cu și fără regula de formă | tăieturile greșite, pe 500 de granițe verificate de mână | sub 1%: regula ajunge. Altfel se adaugă reguli de formă |

**Blocul D: somnul, pe text adevărat.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| D1 | Care sunt pragurile somnului și cu ce se măsoară totalul? | f\_max, m\_min, θ\_accept, θ\_merge, θ\_group; măsura: termeni sau biți | totalul după somn; eroarea de predicție pe validare | rămân valorile cu eroarea cea mai mică |
| D2 | Suma unui grup dă într-adevăr tiparul? | mărimea grupului; strategia | cât de des copiii ficși și locurile libere citite din suma vectorilor coincid cu cele citite exact | peste 95%: grupurile se pot găsi și citi din vectori. Altfel vectorii servesc doar la găsirea candidaților |
| D3 | Depinde rezultatul de ordinea în care sunt citite textele? | 5 ordini diferite | cât coincid tiparele găsite; totalul | diferențe sub 5% la total: ordinea nu contează |
| D4 | Cât contează deplasarea? | cu și fără încercarea deplasărilor; aliniere de la începutul sau de la sfârșitul unității | câte tipare în plus se găsesc; totalul | rămâne dacă scade totalul cu peste 2% |
| D5 | Ajută mai mult somn? | numărul de treceri ale somnului adânc, de la 1 la 20 | totalul și eroarea de predicție după fiecare trecere | somnul se oprește când eroarea pe validare nu mai scade |
| D6 | Somnul în trepte dă același rezultat ca somnul pe tot? | W de la 1.000 la infinit; N\_deep | totalul și eroarea de predicție la sfârșit; timpul | rămâne cel mai mic W la care eroarea este cu cel mult 2% peste modul simplu |

**Blocul E: predicția.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| E1 | Prezice mai bine decât metodele simple? | sistemul fără somn și cu somn; numărarea de succesiuni; o rețea mică învățată pe același text | eroarea de predicție pe tokenul următor | somnul ajută dacă scade eroarea față de „fără somn”. Sistemul merită continuat dacă bate numărarea de succesiuni |
| E2 | Care sunt proporțiile celor patru surse și parametrii votului? | λ1…λ4, β, n\_vote | eroarea pe validare | valorile cu eroarea cea mai mică |
| E3 | Generalizează la combinații nevăzute? | cu și fără îmbogățire | eroarea pe combinații de cuvinte nevăzute la învățare | îmbogățirea rămâne dacă scade eroarea |
| E4 | Ajută contextul îndepărtat, chiar grosier? | câte niveluri de deasupra intră în predicție, de la 1 la toate | eroarea de predicție | rămân nivelurile care scad eroarea |
| E5 | Se poate prezice propoziția următoare? | nimic | locul propoziției adevărate între 20 de candidate | la întâmplare ar ieși prima în 5% din cazuri. Peste 15%: nivelurile de sus merg |
| E6 | Judecă și pe texte pe care nu le-am făcut noi? | sarcinile bAbI cu un fapt, cu două fapte și cu deducție; alături, numărarea de succesiuni și o rețea mică | cât de des răspunsul este corect | se compară cu A5–A7. Dacă pe textul nostru merge și aici nu, diferența arată ce lipsește pe text mai variat |
| E7 | Știe să se oprească? | `stopLevel` lăsat liber | lungimea răspunsului generat față de cea a răspunsului adevărat, pe G7 și bAbI | răspunsul se oprește la locul corect în peste 95% din cazuri |

**Blocul F: sensul.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| F1 | Se pot citi atomii? | nimic | un om încearcă să numească 50 de alegeri, 50 de tipare și 50 de locuri libere, după primii 10 membri | se notează câte primesc un nume. Nu schimbă designul |
| F2 | Tokenii cu mai multe roluri ajung în tipare diferite? | text obișnuit și cod | pentru \[.\], \[:\] și \[\*\]: cât de curat desparte fiecare tipar un singur rol | sub 80% curat: tiparul singur nu ajunge și trebuie mai mult context |
| F3 | Gramatică sau sens? | 200 de perechi cu același sens și formă diferită; 200 cu aceeași formă și sens diferit | care perechi ies mai asemănătoare | dacă forma câștigă, se încearcă legarea tiparelor pe nivelul de deasupra și se măsoară din nou |

Perechile din F3 și verificările de mână din C3 și F1 servesc doar la măsurat. Nu intră niciodată în învățare. Rețeaua mică de la E1 și E6 se poate antrena în afara proiectului; aici intră doar numerele ei.

## 19. Ordinea de implementare

Fiecare pas se încheie cu teste care trec. Nu se trece mai departe cu teste picate.

| Pas | Ce se construiește | Gata când |
| --- | --- | --- |
| 1 | `core`; `memory/store.mjs` cu cele patru feluri de definiții, `intern`, `children`, `unfold`; `checkInvariants` | testele de internare trec; invarianții I1–I6 se pot verifica |
| 2 | tokenizerul în modul tokeni-cuvânt; `segment` și `segmentPrefix`; `ingest`; generatorul G1–G9 | toate seturile se citesc și se refac 100%; invariantul I12 trece |
| 3 | asemănarea exactă; somnul fără ridicare: `recognize`, `group`, `propose`, `judge`, `sleepPass`, în modul simplu | G1 dă exact 2 tipare, o alegere și 56 de termeni; G4 nu dă niciun tipar. Se pot rula A1, A2, A4 |
| 4 | `nextToken` și `generate` | testele de predicție trec. Se poate rula A3 |
| 5 | ridicarea, locurile legate, tiparele cuibărite, unitățile derivate | G7 dă regula cu două locuri legate. Se pot rula A5–A7 |
| 6 | interfața strategiei, strategia bipolară, `hdc/check.mjs`; vectorii din secțiunea 7; căutarea candidaților cu `nearest` | H1–H8 trec. Se poate rula blocul B |
| 7 | tokenizerul GPT-2; perechile; citirea textului adevărat | refacere 100% pe TinyStories. Se poate rula blocul C |
| 8 | tamponul, somnul ușor și adânc; la urmă, firele de execuție | aceleași fișiere cu fire și fără fire. Se pot rula blocurile D–F |

După pasul 5 se rulează blocul A. Dacă nu trece, pașii 6–8 nu se încep: se repară întâi mecanismul.

## Anexă: termeni

**Vectori și operații**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| HDC | calcul cu vectori foarte lungi: orice lucru este un vector, iar lucrurile se combină prin câteva operații simple |  |
| Strategie | un fel anume de a face vectorii și operațiile. Se poate schimba fără a schimba restul | bipolară |
| Strategie exactă | strategia de referință, fără vectori și fără zgomot: lucrează direct pe definiții |  |
| Mărime, D | câte componente are un vector | 4.096 |
| Atom | un lucru cu id propriu: token, atom de sens sau atom de structură | \[ cit\], N2, S1 |
| Etichetă | vectorul random al unui token, loc, tipar sau al unei alegeri |  |
| Asemănare | cât de mult seamănă două lucruri: 1 înseamnă identice, 0 înseamnă fără legătură |  |
| Zgomot | abaterea unui răspuns dat de vectori față de răspunsul exact |  |
| BIND | leagă o cheie de o valoare; cu cheia, valoarea se scoate înapoi |  |
| BUNDLE | adună vectori; rezultatul seamănă cu fiecare dintre ei |  |
| Ordine, ρ | permutare fixă; aplicată de k ori, marchează poziția k |  |
| Înglobare, ν | a doua permutare fixă, aplicată unui copil când intră în ecuația părintelui |  |
| Normalizare | aducerea unei sume la lungimea 1, cu ponderile păstrate |  |
| `comp`, `enr`, `detect`, `deep` | cei patru vectori care se pot calcula pentru un atom (secțiunea 7) |  |

**Memorie**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Token | bucată de text dată de tokenizer; poate fi mai mică decât un cuvânt | \[ cit\], \[.\] |
| Unitate | bucata de text dintre două granițe, cu copiii ei | un cuvânt, o propoziție |
| Copii | tokenii sau unitățile din care este făcută o unitate, în ordine |  |
| Nivel | treaptă a ierarhiei | cuvânt, propoziție, paragraf |
| Atom de sens, N | numele unei unități, al unei alegeri sau al unui tipar | N2 = „citește” |
| Atom de structură, S | numele unui loc liber dintr-un tipar | S1 = „cine citește” |
| Definiție | ce ține memoria despre un atom de sens: înșiruire, alegere, tipar sau aplicare |  |
| Internare | regula că două unități cu aceiași copii sunt același atom |  |
| Desfășurare | drumul de la un atom, prin copii, până la tokeni |  |
| Total | suma mărimilor tuturor definițiilor din memorie |  |
| Versiune | numărul care crește cu 1 la fiecare commit |  |

**Veghe și somn**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Veghe | faza în care textul este citit și tăiat în unități, fără nicio decizie |  |
| Graniță | token la care se termină o unitate | punctul, spațiul |
| Tampon | unitățile noi, nevăzute încă de somn |  |
| Rest | înșiruirile văzute de somn care nu au intrat în niciun tipar |  |
| Somn | faza în care memoria este rescrisă mai scurt |  |
| Trecere | o parcurgere a memoriei în somn; memoria nu se schimbă până la sfârșitul ei |  |
| Somn ușor, somn adânc | o trecere peste tampon și rest; respectiv treceri peste toată memoria |  |
| Grup | unități care au aceiași copii, în afară de câteva poziții |  |
| Înșiruire | „acești copii, în această ordine” | \[N1, N2, \[.\]\] |
| Alegere | „unul dintre acești membri” | Ana sau Maria |
| Loc liber | poziția dintr-un tipar la care poate sta orice membru al unei alegeri |  |
| Loc legat | un loc liber care apare de mai multe ori și poartă de fiecare dată același lucru |  |
| Tipar | o înșiruire cu cel puțin un loc liber | „cineva citește.” |
| Tipar cuibărit | un tipar folosit ca un copil al altui tipar, cu locurile lui legate de ale acestuia |  |
| Aplicare | un tipar, cu ce s-a pus la fiecare loc liber | N6(S1: N1) |
| Ridicare | pasul în care locurile unui tipar cuibărit devin locuri ale tiparului de deasupra |  |
| Unitate derivată | unitate care se poate reface din aplicarea părintelui ei, deci nu costă nimic |  |
| Pachet | toate propunerile unei treceri, judecate împreună |  |
| Commit | aplicarea pachetului în memorie, dintr-odată |  |
| Interpretare | una dintre rescrierile posibile ale unei unități |  |

**Predicție și verificare**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Prefix | copiii de până acum ai unei unități încă deschise |  |
| Vot | contribuția unei unități din memorie la ce urmează |  |
| Eroare de predicție | minus logaritmul probabilității date tokenului corect. Mai mic înseamnă mai bine |  |
| Numărare de succesiuni | metodă simplă de comparație: prezice tokenul următor după cât de des a urmat după ultimii câțiva tokeni |  |
| Invariant | o proprietate care trebuie să fie adevărată după fiecare commit | I1: textul se reface |
| Sămânță | numărul din care pornește tot hazardul; aceeași sămânță dă aceeași rulare |  |
