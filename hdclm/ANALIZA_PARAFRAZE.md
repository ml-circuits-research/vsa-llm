# Parafraze: „același sens, o singură ecuație” pe arhitectura curentă

Analiză doar din citit (cod, specificație, DECIZII/REZULTATE, datele bAbI qa1). Nimic nu a fost modificat sau rulat în afara unei numărători pe `data/babi/qa1_train.jsonl`.

## 0. Faptele din care pornesc

- **Identitatea unei unități este lista copiilor** (`store.mjs:intern`, cheia `items.join(',')`). Două parafraze au copii diferiți, deci sunt *întotdeauna* atomi diferiți. „Aceeași ecuație” nu poate însemna „același id”; poate însemna doar „aceeași rescriere” (`APP` cu același tipar și aceleași valori) sau „același vector `deep`”.
- **Alegerea** (`CHOICE`) spune „aceste valori au stat în același loc” (`propose.mjs:choiceFor` o construiește strict din coloana unui loc). Nu spune nimic despre sens: {Mary, John} și {moved, went} sunt, pentru sistem, același fel de obiect.
- **Un loc aparține unui singur tipar** (I5, `invariants.mjs`), iar `deep(aplicare) = tag(tipar) + Σ bind(tag(loc), enr(valoare))` (`vectors.mjs:deep`). Două tipare cu copii ficși diferiți au etichete diferite și locuri diferite, deci `deep` pentru „Mary moved to the bathroom.” și „Mary went to the bathroom.” sunt **ortogonale**, oricât de identice ar fi valorile. Asta este, în vectori, exact opusul a ceea ce vrea autorul.
- **Gruparea aliniază de la început și cere același număr de copii** (`group.mjs:candidateGroups`, cheia `level|n|F|fixed`). Pe bAbI qa1 (tokeni-cuvânt): „Mary moved to the bathroom.” are 6 copii, „Daniel went back to the hallway.” are 7. Cu `f_max = 2` apar patru tipare `[S, moved|went|journeyed|travelled, to, the, S, .]` (F = {0, 4}) și un al cincilea, de 7 copii, cu „went back”. Alegerea de verbe nu poate apărea deloc: ar cere F = {0, 1, 4}, deci `f_max = 3`.
- **Ridicarea cere același tipar q pentru toată coloana** (`propose.mjs:findLift`, inclusiv filtrul `items.length === n`). O regulă de paragraf se fragmentează deci după combinația de verbe ale faptelor, exact diagnosticul din D10 pe G11 (77 de tipare de propoziție, 3 reguli).
- **Judecata în biți** (`size.mjs:defSize`): o aplicare costă `lg P + Σ lg |alegere|`. Un loc nou cu 4 verbe costă 2 biți la *fiecare* aplicare; pe qa1 (2.000 de fapte) înseamnă ~4.000 de biți, în timp ce trei definiții de tipar economisite valorează ~200. **Abstracția verbului nu se plătește singură în biți**; se plătește doar dacă prăbușește regulile de deasupra (D3 include dependenții, dar numai pe cei din același pachet).
- bAbI qa1, numărat: 5 forme de verb aproape echilibrate (moved to 392, went to 418, went back to 390, journeyed to 406, travelled to 394), 4 nume, 6 locuri, 1.000 de întrebări „Where is X?”. Răspunsul nu depinde niciodată de verb. Este cel mai curat caz de „aceeași semnificație, altă formă” pe care îl avem.

## 1. Ce poate însemna „același sens ca o singură ecuație”

Patru definiții, toate exprimabile pe modelul de date; le ordonez după cât de ușor se măsoară.

**(S1) Echivalență de rescriere.** x ~ y dacă `canon(x) = canon(y)`, unde `canon(u) = (M, valorile locurilor purtătoare de sens)`, M fiind o clasă de tipare, nu un tipar. Nu toate valorile: „Mary moved to the bathroom.” și „John moved to the bathroom.” au același tipar și *nu* sunt parafraze. Deci S1 cere două lucruri noi: (i) o clasă de tipare M (locul lui `pattern` din `APP`); (ii) o împărțire a locurilor în **purtătoare de sens** și **inerte** (de formă). Cu ele, parafrazele au ecuații canonice identice și `deep` identic dacă `deep` se calculează din M și numai din locurile purtătoare. Este definiția operațională pe care o recomand.

**(S2) Echivalență funcțională.** Doi membri a, b ai unei alegeri (sau două tipare) sunt echivalenți dacă nicio regulă nu *leagă* valoarea lor: în niciun tipar viu care îi cuibărește (`items[].sub`, `args`) locul respectiv nu este legat de alt loc și nu apare în răspuns. Se citește direct din memorie, prin `parents` și `slotValues` (`context.mjs:slotValues`). Pe G7 regula `[Fapt(S1,S2), Întrebare(S2), Răspuns(S1)]` leagă S1 și S2; un loc de verb nu ar fi legat niciodată → inert → variantele lui sunt formă, nu sens. **Aceasta este singura definiție care desparte sinonimele {moved, went} de co-hiponimele {Mary, John} pe bAbI**, pentru că la nivel de propoziție contextele celor două alegeri sunt la fel de omogene; doar întrebarea-răspuns le desparte. Este și „F3 în termenii codului”: forma este ceea ce regulile nu leagă.

**(S3) Echivalență distribuțională.** a ~ b dacă mulțimea contextelor (tipar părinte, poziția, valorile celorlalte locuri) ale lui a și b coincide peste `parentIndex`. Măsurabilă ieftin (Jaccard pe contexte), dar **nu distinge sinonimele de antonime și nici de co-hiponime** („went to”/„left” au aceleași contexte; „Mary”/„John” la fel). Bună ca *propunere* (principiul 4), nu ca criteriu.

**(S4) Echivalență prin regulă de rescriere.** Un tipar-regulă R = [P_act(S1,S2)] ↔ [P_pas(S2,S1)] care spune că o formă se poate rescrie în alta cu locurile permutate. Este cazul topicii/diatezei. Se reprezintă în modelul existent ca o clasă de tipare cu `args` permutate (vezi P1), deci S4 este un caz particular al lui S1 cu o aliniere a locurilor, nu un mecanism separat.

Concluzie: **S1 cu locurile împărțite prin S2** este definiția realizabilă și măsurabilă. S3 rămâne generator de candidați. Identitatea vectorială a lui `deep` iese ca o consecință, nu ca scop.

## 2. Ce dau mecanismele de azi și ce le lipsește

| Mecanism | Ce dă pentru parafraze | Ce lipsește |
| --- | --- | --- |
| alegeri (`propose.mjs:choiceFor`, contopire la θ_merge) | clase de echivalență *de loc*; cu `f_max = 3` ar da {moved, went, journeyed, travelled} pe qa1 | nu apar cu `f_max = 2`; nu se plătesc în biți (secțiunea 0); nu se deosebesc de {Mary, John}; „went back to” (7 copii) rămâne afară |
| îmbogățirea (`similarity.mjs:simE`, `vectors.mjs:enr`) | doi membri ai aceleiași alegeri au simE = w²/(1+w²) = 0,2 la w = 0,5: un semnal slab că „seamănă” | semnalul e același pentru nume și verbe; nu urcă în `deep`, unde locul și eticheta tiparului domină |
| interpretări multiple, `interpretAs` (`match.mjs`) | o unitate poate fi citită prin orice tipar cu același număr de copii | lecturile sunt tot *tipare de formă*; nu există o lectură „prin clasa M” |
| gruparea abstractă (`group.mjs`, cheia `A|sig|eq`) | reguli fără copii ficși, cu structura repetițiilor | cheia conține lungimea copiilor (`u3:6` ≠ `u3:7`) și cere la ridicare același q: regulile se fragmentează pe verbe |
| judecata (`package.mjs:Judge.gain`, D3) | câștigul include dependenții din pachet | nu vede regulile care *s-ar* forma deasupra după o unificare de tipare; `altLookahead` există dar e oprit |
| validarea (`pass.mjs:validateSplit`) | respinge ce strică predicția | nu *promovează* nimic: o unificare neutră în biți dar bună la predicție nu intră |
| `deep` (`vectors.mjs:deep`) | valoarea unui loc se scoate prin `unbind` | parafrazele sunt ortogonale (etichete de tipar și de loc diferite); nu există vector „de sens” |
| F3 din specificație | experimentul exact pentru întrebare | nu există încă perechi și nici cod de măsurat; prognoza mea pe codul actual: **forma câștigă** la orice D |

## 3. Propuneri, ordonate după valoare / cost

### P1. Locuri inerte și ecuația canonică (cost mic, valoare mare: definește „sensul” fără a schimba memoria)

- **Ce.** O funcție de citire `inertSlots(pattern)`: locul s al tiparului q este inert dacă în toate tiparele vii care îl cuibăresc (`choiceUsers`/`parents` peste `items[].sub`) argumentul corespunzător lui s nu apare în alt loc al regulii și nu apare într-o poziție de răspuns; plus (opțional) dacă nu este legat în nicio aplicare de deasupra. `canon(app) = (clasa(pattern), fills[fără inerte])`. `deepMeaning(app)` = `deep` fără termenii locurilor inerte.
- **Unde.** Nou în `memory/` (doar citire; nu atinge `store.mjs`). `vectors.mjs:deep` primește o variantă `deep(app, { meaning: true })`.
- **De ce rămâne în principii.** Nu rescrie nimic (3 neatins); forma exactă rămâne adevărul (5); vectorii se calculează din ea (I14). Nu adaugă cunoaștere de limbă: „inert” este o proprietate a grafului de reguli.
- **Judecată.** Nu se judecă (e o măsurătoare), dar este precondiția pentru P2–P3 și pentru metricile din secțiunea 4.
- **Risc.** Pe date fără întrebări (TinyStories) aproape toate locurile sunt inerte, deci P1 nu separă nimic acolo; sensul vine din ce leagă regulile, iar fără reguli nu există sens în acest sistem. Trebuie spus deschis.
- **Experiment.** Pe G7/G8/G10 după somn: locurile legate din reguli ies „purtătoare”, nimic altceva. Regula de decizie: 100% din locurile legate în reguli sunt ne-inerte și niciun loc de verb (G-PARA) nu e purtător.

### P2. Gruparea tiparelor ca unități: „tipare care diferă într-un copil fix” (cost mic–mediu)

- **Ce.** O trecere nouă în somnul adânc (lângă `alternatives.mjs`) care aplică exact `candidateGroups` pe *tipare*, nu pe unități: copiii sunt `items` (copil fix sau loc, locurile identificate prin alegerea acceptată). Un grup `[S_nume, moved, to, the, S_loc, .]`, `[S_nume, went, …]`, … cu F = {1} dă tiparul `[S_nume, S_v, to, the, S_loc, .]` cu alegerea {moved, went, journeyed, travelled}; aplicările vechi se rescriu cu o valoare în plus, tiparele vechi mor (costă 0, cum e deja). Locul S_v iese inert prin P1 → clasă de formă.
- **Unde.** `sleep/unify.mjs` (nou) + `propose.mjs:proposeGroup` refolosit pe o „memorie de tipare”; commit prin `store.mjs:commit` cu `rewrites` (rescrierea păstrează id-ul, I1/I2 țin).
- **Judecată.** În biți pierde la nivelul propoziției (secțiunea 0). Se plătește doar prin regulile de deasupra, care devin una în loc de câte una pe combinație de verbe. Deci trecerea trebuie judecată **cu privire înainte** (`altLookahead` deja implementat: `alternatives.mjs` aplică pachetul pe copie și rulează `sleepPass`) și pe **totalul real**, nu pe estimare. Dacă rămâne neutră în biți, propun regula simetrică la cea existentă: se acceptă dacă eroarea pe validare scade strict (`pass.mjs:validateSplit` are tot ce trebuie; azi doar respinge).
- **Risc.** Unifică orice tipare ce diferă într-un copil fix, inclusiv `[S, has, the, S, .]` cu `[S, drops, the, S, .]` (sens opus). Nu e o problemă pentru *ecuația de formă* (e tot o alegere), dar devine una dacă locul verbului iese inert *greșit*: pe date în care răspunsul depinde de verb, locul va fi legat de reguli și P1 îl va declara purtător. Deci riscul e acoperit de P1, nu de P2.
- **Limită.** Nu prinde „went back to” (altă lungime) și nici topica. Pentru ele, P3.

### P3. Clasa de tipare M („alegere de tipare”) cu aliniere a locurilor (cost mediu; schimbare mică de model de date)

- **Ce.** Un nou fel de definiție `{ type: 'PCHOICE', members: Map(patternId -> pondere), arity, align: Map(patternId -> [indexul locului lui M pentru fiecare loc al membrului]) }`, cu nivelul membrilor. În tipare, un copil cuibărit poate fi `{ sub: M, args }` unde M e o clasă; aplicarea unei reguli reține și membrul ales (o valoare în plus, cu costul `lg |M|`). `appChildren` rezolvă prin membrul ales și `align`. Locurile membrilor rămân ale lor (I5 neatins); M are *roluri* comune, iar `deep` al unei aplicări prin M = `tag(M) + Σ bind(tag(rol), valoare) + bind(tag(care), tag(membru))`: parafrazele diferă într-un singur termen din k+2 (sim ≈ 1 − 1/(k+2)), iar `deepMeaning` (P1) le face identice.
- **Cum se descoperă.** Două surse, în această ordine: (a) din reguli — regulile `[Fapt_v(S1,S2), Fapt_w(S3,S4), Unde(S1), Răspuns(S2)]` care diferă doar prin q la aceeași poziție `sub` și au aceeași structură de legare (cheia `eq` din gruparea abstractă) spun că q_v și q_w sunt interschimbabile *funcțional* — este S2 la nivel de tipar și prinde și „went back to” (7 copii), pentru că M nu cere aceeași lungime; (b) din valori — două tipare de aceeași aritate ale căror mulțimi de tupluri de valori coincid (modulo o permutare π a locurilor) sunt candidate; π devine `align`. (b) este S3 și prinde activ/pasiv când corpusul conține ambele forme cu aceleași perechi.
- **De ce rămâne în principii.** Un vector ține puține lucruri (M adaugă un termen); cheile diferă (rolurile lui M), valorile seamănă (membrii lui M sunt tipare cu `detect` apropiat); refacerea este exactă (membrul ales e stocat); asemănarea (b) propune, judecata hotărăște; forma exactă rămâne adevărul.
- **Judecată.** Aceeași ca la P2, cu privire înainte; aici câștigul în biți e real pe date cu întrebări (25 de reguli pe perechi de verbe → 1 regulă + `lg 5` pe aplicare).
- **Risc.** (b) contopește antonime („went to”/„left”) dacă apar cu aceleași perechi de valori; de aceea (b) trebuie confirmat de (a) sau de validare, niciodată singur. Costul: `appChildren`, `matchPattern` (un `sub` cu clasă încearcă fiecare membru), `defSize`, `checkInvariants` (I6 pe membrul ales), `describe`. Estimez câteva zile, nu minute; după P1 (principiul P1 din DECIZII cere notarea explicită).

### P4. Deplasarea / golul (D4, D9–D10) ca precondiție pentru bAbI întreg (cost mediu–mare, deja planificat)

Nu e mecanism de parafrază, dar fără ea nicio regulă de paragraf nu apare pe poveștile bAbI de 15 rânduri (structura repetițiilor variază pe fiecare poveste; `candidateGroups` nu le va grupa). Pentru experimente, o ocolesc tăind qa1 în ferestre de 2 fapte + întrebare (secțiunea 4). Menționez ca să nu se pună pe seama parafrazelor un eșec care vine din altă parte.

### P5. Echivalența distribuțională pe membrii alegerilor (cost mic, valoare mică singură)

Jaccard pe contextele din `parentIndex` pentru fiecare pereche de membri ai unei alegeri; perechile cu Jaccard ≥ θ sunt propuse ca „atomi de sens”. Merită doar ca generator de candidați pentru P3(b) și ca măsurătoare pentru F3. Singură, pe bAbI, pune {Mary, John} și {moved, went} în același coș și nu are cum să le despartă (argumentul de la S3).

### Ce nu recomand

- **(b) Forma canonică prin reprezentanți de clasă la valori** („Mary” → reprezentantul alegerii de nume): contopește sensuri diferite. Reprezentantul are sens doar pentru clasele de *formă* (locurile inerte), adică exact P1.
- **(d) Atomi de structură globali, partajați între tipare** (schimbarea lui I5): ar face `deep` identic fără clasa M, dar strică „cheile trebuie să difere” (același rol în tipare neînrudite dă diafonie la `unbind`) și cere o regulă de aliniere a locurilor care tot o clasă M este. P3 obține același efect păstrând I5.

## 4. Plan experimental minimal

**Date.**

- **bAbI-2**: din `qa1_train.jsonl`, pentru fiecare întrebare se ia fereastra celor două fapte dinainte; se păstrează numai cazurile în care răspunsul este locul din unul dintre ele (în qa1 este întotdeauna faptul mai recent despre persoana întrebată). Format G10: `meta = { prompt, answer, verbs: [v1, v2], pos }`. Împărțire pe documente 80/10/10; `heldout` = combinațiile (nume, verb, loc) nevăzute la învățare. Mod tokeni-cuvânt, ca G7–G11.
- **G-PARA** (în `data/generate.mjs`, ca G10): 8 nume, 6 locuri, 5 obiecte; două *sensuri* cu câte 4 forme fiecare: MOVE = {`N went to the P.`, `N moved to the P.`, `N travelled to the P.`, `N went back to the P.`} (lungimi 6 și 7) și HAVE = {`N has the O.`, `N holds the O.`, `N picked up the O.`, `N is holding the O.`}; o **capcană de antonim**: LEAVE = {`N left the P.`} cu aceleași contexte ca MOVE, dar răspunsul la „Where is N?” nu e P (povestea conține un MOVE anterior către alt loc, care e răspunsul); întrebări „Where is N?” → P și „What does N have?” → O; povești de 2 fapte + 1 întrebare, ca G10. **Puse deoparte:** (i) 20% din combinațiile (formă, nume, loc); (ii) două forme (`travelled to`, `is holding`) apar la învățare numai în poveștile în care *nu* sunt întrebate, deci răspunsul prin ele cere clasa, nu memorarea. Semințele 1–3, raportat cum iese (principiul P2 din DECIZII).

**Metrici** (toate calculabile din `describe`, `answerAccuracy`, `total`, plus `canon`/`deepMeaning` din P1):

1. *Puritate/completitudine* ale claselor descoperite (alegeri de verbe la P2, clase M la P3) față de aurul {MOVE}, {HAVE}, {LEAVE}: puritate = partea membrilor din clasa majoritară; contopiri false = perechi din sensuri diferite puse în aceeași clasă (în special LEAVE∪MOVE).
2. *Fracția perechilor de parafraze cu `canon` identic* și, în vectori (bipolar, D = 4096), asemănarea `deepMeaning` pentru perechi parafrază vs. perechi „aceeași formă, alt sens” (exact F3; prognoza pe codul actual: parafrazele ≈ 0, formele ≈ 0,8).
3. *QA* pe pus-deoparte (ii) și pe capcană; *eroarea de predicție* pe validare; *totalul în biți* și numărul de reguli de paragraf.

**Experimente.**

- **E0 — referința, fără nicio schimbare de cod** (rulabil azi, minute): bAbI-2 și G-PARA cu configurarea implicită și cu `f_max = 3`. Se numără tiparele de propoziție pe verb și regulile pe combinații de verbe (reproducerea diagnosticului D10), QA pe (ii). Decizie: dacă QA(ii) ≥ 90% deja, parafraza nu e gâtul de sticlă și P2/P3 au valoare doar de compresie; dacă `f_max = 3` dă alegerea de verbe dar judecata o respinge, se confirmă calculul în biți din secțiunea 0.
- **E1 — P1 pe memoriile existente** (G7, G8, G10, E0): locurile legate ies purtătoare, locurile de verb inerte; metrica 2 cu `deepMeaning`. Decizie: `canon` identic pentru ≥ 95% din perechile MOVE de aceeași lungime pe G-PARA (cu P2) și 0% contopiri MOVE–LEAVE; altfel criteriul „inert” e prea slab și se încearcă varianta „legat în nicio aplicare”.
- **E2 — P2 cu privire înainte**: G-PARA și bAbI-2, trei configurări ale judecății (biți; biți + lookahead; biți + lookahead + acceptare la scăderea erorii). Decizie: rămâne configurația cu QA(ii) ≥ 90% și eroare de validare ≤ referința; dacă totalul în biți crește iar QA scade, P2 se oprește.
- **E3 — P3 din reguli (sursa a), apoi din valori (b)**: pe bAbI-2 regulile pe perechi de verbe trebuie să devină una cu M = {5 forme, inclusiv „went back to”}; pe G-PARA (b) este *lăsat* să propună LEAVE∪MOVE și se măsoară dacă (a) sau validarea îl respinge. Decizie: puritate ≥ 0,95, completitudine ≥ 0,8 (4/5 forme), contopiri false 0 pe semințele 1–3; QA(ii) ≥ 90% față de ≤ 50% la E0. Un rezultat în care (b) singur contopește LEAVE și numai validarea îl respinge este *acceptabil și informativ*: confirmă că asemănarea propune și criteriul hotărăște.

## 5. Evaluare sinceră

**Plauzibil.** P1 e aproape sigur: locurile legate de reguli sunt exact cele din care se scot răspunsurile, iar G7–G10 arată că regulile apar. P2 pe forme de aceeași lungime e mecanic (același cod de grupare, pe alt șir), iar pe G-PARA clasa de 3 forme MOVE va ieși; întrebarea reală e judecata, pentru că în biți nu se plătește la nivel de propoziție. P3(a) are cea mai bună șansă să dea „aceeași ecuație” în sensul tare (inclusiv lungimi diferite), pentru că fragmentarea regulilor pe verbe este deja observată (D10) și e exact semnalul care îl alimentează.

**Neplauzibil pe termen scurt.** Parafraze pe text adevărat (TinyStories): fără întrebări nu există reguli care să lege locuri, deci S2 nu are ce măsura, iar S3 va contopi sinonime cu antonime și cu co-hiponime fără a le putea deosebi. Topica/diateza (f) cere ca ambele forme să apară cu aceleași perechi de valori, ceea ce în text natural e rar; pe G-PARA se poate simula, dar rezultatul nu se transferă. Și GPT-2 (D2/D12): „ She”/„She” și „ went”/„went” sunt tokeni diferiți, deci clasele se vor dubla; P2 le-ar putea chiar uni (diferă într-un copil fix), un efect secundar de urmărit, nu de proiectat.

**Rezultat tare / slab.** Tare: pe bAbI-2, cu P3(a), o singură regulă de paragraf cu M = toate cele 5 forme, QA(ii) ≥ 90% pe semințe nevăzute la proiectare, LEAVE neunificat, `deepMeaning` al parafrazelor > 0,9. Slab: clasa apare doar cu `f_max = 3` sau doar cu acceptarea prin validare, fără câștig în biți; sau apare pe G-PARA și nu pe bAbI-2 (ar însemna că am croit pe set).

**Riscuri principale.** (1) Antonimele și co-hiponimele sub S3: tratate prin S2 și validare, dar S2 cere date cu întrebări. (2) Măsura în biți penalizează locul nou la fiecare aplicare; câștigul vine doar de deasupra, deci judecata are nevoie de privire înainte (cost: o trecere pe copie pentru fiecare candidat, problema deja notată în D6/O6). (3) P3 schimbă `appChildren`, `matchPattern`, `defSize`, invarianții: e o extindere a secțiunii 6 din specificație și trebuie decisă explicit de autor. (4) bAbI întreg rămâne blocat de deplasare (P4), nu de parafraze; dacă experimentele se fac doar pe ferestre, afirmația „merge pe bAbI” nu e acoperită.
