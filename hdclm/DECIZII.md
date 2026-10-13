# Registrul deciziilor

Fiecare decizie are: contextul, ce s-a ales, alternativele, dovezile, consecințele și condiția în care trebuie revizuită. Deciziile noi se adaugă la sfârșit. Una revizuită nu se șterge: se marchează „înlocuită de Dn” și rămâne ca istoric.

## Principii de lucru (stabilite cu autorul)

- **P1. Alternativa mai generală.** Între două variante, se ia cea mai generală dacă costă doar câteva minute de cod și de validare. Dacă e mai scumpă, se notează aici și se hotărăște explicit.
- **P2. Fără croire și fără „fake”.**
  - Mecanismul nu conține cuvinte, nume de seturi sau reguli de limbă; singura cunoaștere dată rămâne tabelul de granițe (secțiunea 8).
  - O reparație făcută uitându-mă la un set face setul „văzut”, iar asta se spune.
  - Generalitatea se verifică pe un set de control nou, rulat o singură dată, cu rezultatul raportat așa cum iese.
- **P3. Consecințele se spun înainte.** Orice schimbare de mecanism vine cu efectele ei asupra rezultatelor deja obținute.
- **P4. Valorile de aur ale specificației rămân testate** în configurarea pentru care au fost scrise (mecanismul de bază, măsura în termeni).

---

## D1. Tăierea propoziției fără virgulă

- **Context.** Secțiunea 8 spune că tokenul de închidere este ultimul copil al unității. Aplicat literal, „Ana reads.” ar fi `[[Ana, reads], .]`.
- **Ales.** O propoziție fără graniță de parte de propoziție ia direct copiii părții ei unice: `[Ana, reads, .]`.
- **Dovezi.** Exemplul din secțiunea 3 (`N3 = [N1, N2, [.]]`) și valoarea de aur G1 = 56 de termeni.
- **Consecințe.** Nivelul 2 apare doar când există virgulă. La predicție, nivelurile 2 și 3 sunt contopite până la prima virgulă.
- **Revizuire.** Dacă pe text adevărat (blocul C) structura de propoziție iese incoerentă.

## D2. Tokenii-cuvânt nu includ spațiul în identitate

- **Context.** În modul tokeni-cuvânt, „Ana” de la început și „ Ana” din mijloc ar fi tokeni diferiți.
- **Ales.** Identitatea tokenului este textul fără spațiu; spațiul e un atribut al apariției.
- **Consecințe.** Locurile legate funcționează pe textul generat. În modul GPT-2 problema reapare, pentru că acolo spațiul face parte din token.
- **Revizuire.** Obligatoriu la pasul 7 (GPT-2).

## D3. Câștigul unui tipar include tot ce depinde de el

- **Context.** Un tipar mic, de exemplu `[S, .]`, poate să nu se plătească singur, dar să fie necesar unei reguli de deasupra.
- **Ales.** Câștigul se calculează scoțând tiparul împreună cu toate tiparele care îl cuibăresc.
- **Dovezi.** Fără asta, regulile din G7 nu apar.
- **Revizuire.** Nu se anticipează.

## D4. Departajarea grupurilor: mai puține locuri după ridicare și legare

- **Context.** La egalitate de poziții libere și de mărime, specificația departajează după cheie, ceea ce e arbitrar.
- **Ales.** Înainte de cheie se folosește numărul de locuri care rămân după ridicare și legare (aplicări mai scurte).
- **Dovezi.** Pe G7, fără acest criteriu nu apare regula (total 630 față de 347).
- **Consecințe.** Ordinea depinde de tiparele propuse mai jos în aceeași trecere.
- **Revizuire.** Dacă pe text adevărat ordinea produce tipare evident proaste.

## D5. Măsura: biții hotărăsc ce se învață, termenii rămân limită

- **Context.** Specificația lasă alegerea pe seama experimentului D1. Măsura în termeni nu plătește un loc liber nou decât dacă tiparele specifice ar avea sub circa 4 aplicări, oricât text s-ar citi.
- **Ales.** `measure: "bits"`. Limita de K = 16 termeni pe ecuație rămâne (capacitatea vectorului, principiul 1).
- **Alternative.**
  - Termeni: simplu, dar nu creează categorii semantice.
  - Amestec α·termeni + (1−α)·biți: niciun α nu le are pe amândouă.
  - Alegere locală: totalul nu ar mai scădea după nicio măsură, deci I8 nu s-ar mai putea verifica.
- **Dovezi.**
  - G2P: pe perechi verb–obiect nevăzute, eroarea este 1,871 în biți față de 2,114 în termeni; termenii sunt mai răi decât fără somn (2,064).
  - A1/G2: doar biții dau tiparul cu două locuri.
- **Consecințe.**
  - Totalul e în aceeași unitate ca eroarea de predicție.
  - Costurile depind de toată memoria, deci estimarea judecății nu e exactă: alternativele se verifică pe forma exactă.
  - În biți, judecata în pachet nu mai e necesară pe G1.
- **Revizuire.** Dacă pe text adevărat (D1) termenii dau eroare de validare mai mică.

## D6. Interpretări alternative în somnul adânc

- **Context.** Gruparea lacomă nu propune niciodată tiparul cu mai multe locuri, dacă unitățile au fost luate deja de grupuri cu mai puține locuri.
- **Ales.** După trecerile obișnuite, o trecere regrupează și unitățile rescrise. Fiecare candidat se aplică pe o copie a memoriei; se păstrează cel cu cel mai mare câștig real.
- **Dovezi.** A1/G2 în biți trece; fără verificarea pe copie, invariantul I8 prindea creșteri ale totalului.
- **Consecințe.**
  - Tiparele și alegerile fără folosință costă 0 (rămân ca atomi).
  - O copie a memoriei pentru fiecare candidat: pe text adevărat trebuie contabilitate incrementală.
- **Revizuire.** Când costul devine prea mare, la blocul D.

## D7. Interpretări multiple (`multiInterp`)

- **Context.** Specificația spune: „prima implementare folosește numai rescrierea principală”. Pe date dezechilibrate, poveștile se împart între reguli parțiale și unele rămân neacoperite.
- **Ales.**
  - O unitate se poate citi prin orice tipar care i se potrivește: la ridicare (somn) și la tiparele cuibărite (predicție).
  - Când o regulă citește un copil prin tiparul q, copilul trece principal la q.
  - Dacă niciun tipar nu acoperă o coloană, se propune unul nou din valorile ei.
  - Un tipar e viu dacă are aplicări sau dacă e cuibărit într-un tipar viu.
- **Alternative.**
  - `shadowLift` (mutarea la grupuri pierdute): a creat două familii de reguli în concurență și a scăzut A5. Scos.
  - Alegerea între familii după eroarea pe validare: mai scumpă și neîncercată.
- **Dovezi.** Împreună cu D8: A5 și A6 trec 100% pe trei semințe, pe date dezechilibrate.
- **Consecințe.** Abatere de la specificație: alternativele nu doar se păstrează, ci se folosesc.
- **Revizuire.** Dacă pe text adevărat apar prea multe citiri și predicția se diluează.

## D8. Gruparea abstractă (`abstractGroups`), cu structura repetițiilor

- **Context.** Regula generală din secțiunea 3 (`R = [T1(S1,S2), T2(S2), T3(S1)]`) nu are niciun copil identic între unități, deci gruparea după copii identici nu o poate găsi.
- **Ales.**
  - Unitățile se grupează și după forma copiilor (nivel, număr de copii).
  - Se ține cont și de structura repetițiilor: ce valori se repetă și pe ce poziții.
  - Pozițiile pe care valorile diferă devin tipare cuibărite.
- **Dovezi.**
  - G7 dă exact R; G8 dă regula cu doi pași.
  - G10, setul de control: fără structura repetițiilor pica (20–56%); cu ea, 100% pe trei semințe.
- **Consecințe.**
  - Pot apărea tipare fără niciun copil fix (permise de I5).
  - Repetițiile întâmplătoare creează reguli mici în plus.
  - **G10 a devenit „văzut”** prin această reparație (P2).
- **Revizuire.** La setul de control următor (G11) și pe text adevărat.

## D9. A7 rămâne măsurătoare; deplasarea (D4 din specificație) se face în blocul D

- **Context.** Pe G9, regulile se fragmentează după numărul și forma propozițiilor intercalate: > 90% până la 1–3 propoziții, mai puțin la 4–5.
- **Ales.** A7 se notează așa cum iese, conform specificației („se notează până la câte propoziții”). Variantele de deplasare din specificație (alinierea de la sfârșit, copilul sărit) se fac în blocul D, unde le plasează specificația.
- **Alternative.**
  - Deplasarea acum: ajută doar la o propoziție în plus.
  - Un „gol” de lungime variabilă în tipare: extindere a modelului de date (secțiunea 6); nu costă minute (P1), deci nu s-a făcut acum.
- **Consecințe.** Un fapt aflat departe de întrebare nu e găsit de reguli dacă formele diferă.
- **Revizuire.** Obligatoriu la E6 (bAbI), care are exact fapte amestecate cu propoziții fără legătură. Atunci se decide „golul”.

## D10. G11 (control orb) pică; D9 se revizuiește: deplasarea vine înainte de blocul D

- **Context.** G11 a fost proiectat de un subagent care n-a avut acces la mecanism. Conține 2 sau 3 fapte tranzitive („The girl carried the rope.”) și o întrebare despre unul dintre ele, cu forma verbului schimbată și cu locul întrebat variabil („What did the girl carry?” / „Who found the bell?”). A fost rulat o singură dată, fără nicio modificare înainte.
- **Rezultat.** 3,7% / 0% / 0% pe semințele 1–3 (fără somn 0%). Consemnat așa cum a ieșit.
- **Diagnostic (fără reparații):**
  1. **Numărul de fapte variază.** Votul și gruparea aliniază de la început. În poveștile cu 3 fapte, pe poziția 3 urmează un fapt, deci după întrebare predicția de top este „The”. Este problema de deplasare.
  2. **Forma verbului se schimbă** („carried” → „carry”). Nu e o repetiție, deci locul legat nu poate face legătura. Ar trebui învățată o corespondență între forme (o pereche, ca orașul și țara din G3).
  3. **Fragmentare:** 77 de tipare de propoziție, câte unul pe verb, și doar 3 reguli de paragraf, pentru 133 de povești.
- **Revizuirea lui D9.** Deplasarea nu mai poate aștepta textul adevărat: e necesară deja pentru întrebări cu un număr variabil de fapte. Se programează după blocul B, ca etapă separată, cu un set de control nou (G12) rulat orb după reparație. Pentru punctul 2 (corespondențe între forme) nu există încă mecanism; e o problemă deschisă, de discutat.
- **Consecință pentru afirmații.** Rezultatele bune de pe G7–G10 arată că mecanismul găsește reguli de legare când faptele au poziții fixe și valorile se repetă identic. Nu arată încă generalitate pe structuri variabile.

## D11. Blocul B: strategia bipolară, D = 4096, θ_group = 0,17; implicit rămâne strategia exactă

- **Dovezi:**
  - **B1:** bipolar și phasor trec H1–H8 la D = 1024, 4096 și 16384. Binary iese: pică H5 și H6 (majoritatea rotunjește), plus H8 la D ≤ 4096.
  - **B2:** la D = 4096 și M = 10.000, K ajunge la 64 (bipolar) și 128 (phasor), deci K = 16 e susținut. Prima rulare avea puține decodări pe celulă; vezi rularea țintită din REZULTATE.md.
  - **B3:** pragul separă perfect neînrudite de „toți copiii comuni în afară de 1–2” la orice D. Depinde de numărul de copii: 0,17 / 0,30 / 0,39 pentru n = 3 / 5 / 8, la D = 4096.
  - **B4:** bipolar e cel mai ieftin (16 KB pe vector la D = 4096). O căutare printre 1 milion de unități ar dura ~21 s.
  - **B5:** bipolar și phasor dau aceleași decizii și aceleași totaluri ca forma exactă pe A1, A3, A5, A6 și G2P.
- **Ales.**
  - Strategia pentru vectori: bipolar, D = 4096.
  - θ_group = 0,17, cea mai mică valoare din B3, care nu pierde unitățile scurte; pentru unitățile lungi e mai permisivă, dar grupul se verifică oricum pe forma exactă.
  - K rămâne 16, deși B2 permite 64: principiul 1, iar M real (vocabularul + unitățile) va fi mult mai mare decât 10.000.
- **Implicit rămâne `strategy: "exact"`.** Nu e o abatere de la rezultat: B5 arată că deciziile sunt identice, iar specificația cere ca strategia exactă să ruleze ca referință alături. Motivul e timpul (~12× mai lent cu vectori). Se trece pe bipolar ca implicit după optimizarea O7 (biți împachetați).
- **Consecințe.** Fără O7 și fără un index, căutarea cu vectori nu scalează la text adevărat (21 s pe căutare la 1 milion de unități, 16 GB).
- **Revizuire.** După O7; la blocul C, cu M real; dacă K = 64 se dovedește necesar pe text adevărat (experimentul C1).

## D12. GPT-2: tokenul de rând nou închide paragraful și este ultimul lui copil

- **Context.** Expresia regulată a GPT-2 face din „\n\n” două tokenuri „\n”. Cu regula „paragraful se închide înaintea unui token cu rând nou”, fiecare „\n” ar închide un paragraf și ar apărea paragrafe false, formate doar dintr-un „\n”.
- **Ales.** Un token format numai din spații albe care conține un rând nou este închizătorul paragrafului (ultimul copil), cum este [.] pentru propoziție. Rândurile noi consecutive se adaugă tot la el, iar paragraful se închide la primul token care nu e spațiu alb.
- **Consecințe.** Refacerea rămâne exactă. Același paragraf urmat de un rând nou sau de două este o unitate diferită.
- **Legat de D2.** În GPT-2, spațiul face parte din token („ She” ≠ „She”), deci același cuvânt la început de propoziție și în mijloc sunt tokeni diferiți. Asta afectează locurile legate pe text adevărat; de urmărit în blocul D.
- **Alte observații** (subagentul tokenizerului):
  - caracterele UTF-8 tăiate de BPE dau tokeni cu text gol, care se contopesc într-un singur atom; refacerea rămâne exactă;
  - identitatea tokenului este textul, nu id-ul GPT-2.

## D13. Regula de formă extinsă: grupuri de semne care conțin [.!?] închid propoziția

- **Context (C3).** GPT-2 lipește semnele vecine: `."`, `!"`, `?"`. Pe 100.000 de tokeni din TinyStories, 871 din 8.443 de sfârșituri de propoziție (10,4%) sunt astfel de grupuri. Regula literală din tabelul secțiunii 8 („după [.] [!] [?]”) nu le vede, deci propozițiile din dialog se lipesc de cele următoare.
- **Ales.** Un token format numai din semne (fără litere, cifre sau spații în interior) care conține [.!?] închide propoziția; unul care conține [,;:] și nu [.!?] închide partea de propoziție. Regula „următorul token are spațiu în față” rămâne.
- **Dovezi.** Cu extensia: 0,1% granițe probabil greșite (11, după abrevieri ca „Mr.”). Fără ea: 10,4%. Estimarea e automată, după formă; verificarea de mână a celor 500 de granițe din `runs/C3/granite.tsv` nu e făcută.
- **De ce nu e cunoaștere de limbă.** Regula privește doar forma tokenului (semne, fără litere), la fel ca tabelul din secțiunea 8. Ghilimelele nu sunt numite nicăieri.
- **Consecințe.** În modul tokeni-cuvânt nu se schimbă nimic (semnele sunt tokeni separați). Testele vechi trec neschimbate.
- **Revizuire.** După verificarea de mână a eșantionului din C3 și pe corpusul tbsop, unde punctuația e mai variată.

## D14. Verificarea exactă a pachetului și în trecerile obișnuite

- **Context.** La 10k tokeni de TinyStories, o trecere obișnuită de somn a crescut totalul în biți (99537,64 → 99537,85). Invariantul I8 a oprit-o. Cauza e cea din D5: estimarea judecății ignoră efectele globale ale măsurii în biți. Pe seturile G nu apăruse.
- **Ales.** Înainte de commit, pachetul se aplică pe o copie și se măsoară totalul real. Dacă totalul crește, iese propunerea cu cel mai mic câștig estimat (cu tot ce depinde de ea) și se reîncearcă. Pe copiile de măsurare nu se verifică invarianții; commit-ul real îi verifică.
- **Consecințe.** O copie a memoriei în plus la fiecare trecere (cost liniar). Rezultatele de pe seturile G sunt identice octet cu octet, iar setul de referință e mai rapid: 22,4 → 18,6 s, pentru că invarianții nu se mai verifică pe copii.
- **Revizuire.** Când există contabilitatea incrementală (O6), copia se înlocuiește cu un calcul pe regiune.

## D15. Clase de tipare cu roluri comune (schimbarea lui I5), cu forma ca loc separat

- **Context.** Ținta inițială: trecerea de la atomi poziționali și de tokenizare la atomi de structură semantică și de sens. Măsurat (FORMAL, E0): pe GPARA doar 2% din reformulări aveau aceeași ecuație. Fiecare formă („moved”, „went”, „went back”, „travelled”) avea tiparul ei, cu locuri proprii, iar redundanța era de 3,3 atomi de structură pe rol. Regulile se fragmentau pe forme.
- **Ales (aprobat de autor, inclusiv schimbarea lui I5).**
  - Un nou fel de definiție, `PCLASS`: membri (tipare), roluri comune (atomi de structură ai clasei, `STRUCT.pclass`) și alinierea locurilor fiecărui membru la roluri.
  - Un tipar poate cuibări o clasă: `{ sub: M, args: roluri, form: loc }`. Locul `form` reține membrul folosit și acceptă o alegere de tipare.
  - **I5 devine:** un loc aparține unui singur tipar, *sau* este rolul unei clase, comun membrilor ei.
- **Cum se descoperă (dovadă funcțională).** Când o regulă ridică o coloană în care valorile sunt aplicări ale unor tipare diferite, acestea intră într-o clasă numai dacă:
  1. au același număr de locuri și, pe fiecare loc, **valorile primite efectiv** se suprapun (≥ θ_merge);
  2. cuvintele prin care diferă **nu se repetă sistematic** (în ≥ θ_merge din rânduri) în restul unității. O repetiție sistematică, cum e obiectul din fapt repetat în întrebare, arată conținut, nu formă.
- **Ce s-a încercat și a picat.**
  - Compatibilitatea prin alegerea acceptată: o alegere poluată (locuri + obiecte) a unit MOVE cu HAVE.
  - Fără criteriul repetiției: A5 a scăzut la 93,3% (s-au unit tipare ca „has the book” cu „has the pen”).
  - Criteriul repetiției în orice rând: GPARA a scăzut la 41%, din cauza repetițiilor întâmplătoare.
  - Ordinea „grupurile mari întâi”: generalizează prea mult (reformulări 0%, A1/G1 pică).
- **Corectură legată, generală.** O alegere nouă care face punte între două alegeri disjuncte nu se mai contopește cu niciuna.
- **Recomandarea analizei Fable, urmată parțial.** Analiza recomanda atomi de structură *nu globali*, ci comuni în interiorul unei clase de tipare înrudite (P3), ca să nu se amestece rolurile la `unbind`. Asta s-a făcut. Atomi de structură globali nu s-au introdus.
- **Revizuire.**
  - HAVE nu își formează clasa pe GPARA: regulile mici, ultra-specifice, consumă poveștile înaintea regulii generale.
  - BABI2 nu se îmbunătățește: tiparele principale sunt „pe loc”, cu verbul ca loc liber.
  - De revăzut odată cu ordinea grupării și cu D4 (deplasarea).

## D16. Gruparea abstractă după nivelul copiilor, nu după lungimea lor (`abstractShape: "level"`)

- **Context.** Cheia grupării abstracte conținea numărul de copii ai fiecărei propoziții. Povești cu propoziții de lungimi diferite (de exemplu distractorii din G9) nu intrau în același grup, iar regulile se fragmentau.
- **Ales.** Cheia folosește doar nivelul copilului; diferențele de lungime se rezolvă la ridicare (tipar comun, interpretări multiple sau clasă).
- **Dovezi.** Pe sămânța 1, schimbarea singură: A5 100%, A6 100%, G10 100%, iar **A7 trece până la 5 propoziții între fapt și întrebare** (înainte: 1). Împreună cu clasele (D15), A7 dă 1 / 2 / 5 pe semințele 1–3: clasele anulează câștigul pe sămânța 1. Cauza nu e încă înțeleasă.
- **Consecințe.** Grupuri mai eterogene; coloanele care nu se pot ridica devin locuri simple, iar judecata decide.

## D17. Concepte din comportament (analiza formală a conceptelor) care ghidează gruparea (`concepts: true`, opțional)

- **Context.** Întrebarea autorului: „dacă merge ca o rață și măcăne ca o rață…”. Sistemul vede din date că tipare diferite au aceeași intensiune (aceleași feluri de valori pe locuri, aceleași funcții în reguli), deci sunt același concept? Până la D16, clasele (D15) apăreau doar când o regulă ridica o coloană cu tipare diferite. Regula generală pentru HAVE nu apărea: gruparea abstractă amesteca fapte HAVE și MOVE, iar ridicarea pica.
- **Ales.**
  1. `src/memory/concepts.mjs` (doar citire):
     - **concepte de valori**: valorile care apar în aceleași locuri, grupate cu legătură medie Jaccard ≥ 0,5. Dau persoane / locuri / obiecte fără nume date de noi.
     - **profilul fiecărui tipar**: tipurile locurilor (după conceptele de valori) și funcțiile lui în reguli (loc legat de răspuns, de exemplu).
     - **rețeaua de concepte închise**: intensiune ↔ extensiune, cu părinții direcți (`isa`).
  2. `src/sleep/concepts.mjs` (`conceptPass`): pentru fiecare concept cu ≥ 2 tipare de aceeași aritate, cu roluri tipate, creează o clasă de tipare (PCLASS) marcată `concept: {kind, intent}`:
     - `sens`: confirmat și de funcții în reguli;
     - `ipoteză`: doar după tipuri. Ipotezele nu se folosesc dacă au sub 2 atribute.
  3. Trecerea de concepte rulează după ce alternativele nu mai schimbă nimic, de cel mult `conceptRounds` (2) ori. Apoi somnul continuă.
  4. În gruparea abstractă, un copil al cărui tipar principal e într-o clasă de concept are forma `k{clasă}`, nu doar nivelul. Unitățile cu fapte de același concept intră în același grup, iar cele cu concepte diferite nu se mai amestecă. Copiii fără concept păstrează forma după nivel (D16).
- **Dovezi (FORMAL, GPARA, semințele 1/2/3).**

  | Măsură | Fără concepte | Cu concepte |
  |---|---|---|
  | Reformulări cu aceeași ecuație | 58 / 71 / 79% | **79 / 76 / 84%** |
  | QA pe poveștile puse deoparte | 63 / 57 / 46% | **84 / 63 / 94%** |
  | Capcane MOVE/LEAVE contopite | 0% | 0% |

  - Pe sămânța 1, clasa HAVE apare (has / picked up / holds, puritate 1) și cu ea regula generală `[HAVE(x,o), S, What does x have?, o]`, folosită de 14 ori. Fără concepte, clasa HAVE nu apărea.
  - BABI2 nu se schimbă (45%).
- **Ce s-a încercat și a picat (păstrat ca lecție).**
  - **Concepte înaintea poveștilor (`conceptsFirst`, curriculum).** Ipotezele doar după tipuri au unit MOVE cu LEAVE (capcane contopite 100%). Concluzie: o ipoteză de tip trebuie confirmată funcțional. De aceea trecerea de concepte rulează după ce există reguli.
  - **Forma `p{tipar}` pentru copiii fără concept.** A fragmentat grupurile, pentru că tiparele principale sunt prea specifice: reformulări 11%, QA 33%, 0 clase.
  - **Cheia abstractă cerea măcar un copil `u`.** Unitățile formate numai din copii cu concept nu intrau în grupuri abstracte. Corectat: contează și `k`.
- **Corectură (după commit-ul inițial al lui D17).** Pe GPARA, somnul adânc atinge limita de 20 de treceri (`maxDeepPasses`) înainte ca alternativele să se oprească. **Trecerea de concepte nu a rulat deloc în măsurătorile din tabel.** Câștigul vine numai din punctul 4: forma conceptuală din cheia grupării. Clasele folosite acolo sunt cele apărute prin ridicare (D15, MOVE și HAVE), nu cele din rețeaua de concepte. Mecanismul care a contat: „copiii cu același concept intră în același grup”, cu conceptul dat de clasele descoperite funcțional. Rețeaua de concepte rămâne neverificată în somn (vezi D18).
- **Blocul A cu `concepts: true`** (semințele 1–3): identic cu implicitul (A1–A6 trec, A7 1 / 2 / 5, G10 100%).
- **Consecințe.**
  - Implicit `concepts: false`: rezultatele vechi rămân octet cu octet (verificat pe FORMAL, semințele 2–3, și pe cele 73 de teste). Cu `true`, se adaugă o trecere (cost mic: o rețea pe zeci de tipare).
  - Clasele-ipoteză nefolosite nu costă: dimensiunea numără doar atomii vii.
- **Revizuire.**
  - „is holding” nu intră încă în clasa HAVE.
  - Locurile pentru propoziții-distractor acceptă doar propozițiile văzute (o alegere de unități), nu „orice fapt”. Asta explică majoritatea greșelilor HAVE rămase.
  - Ciclul de inducție (ipoteză → test prin reguli → rafinare sau despărțire) nu e încă explicit.
  - De decis dacă devine implicit, după blocul A cu `concepts: true`.

## D18. Alegeri tipizate: tipul unui loc este un concept (`slotTypes`, opțional)

- **Context.** Un loc acceptă doar valorile văzute. O propoziție-distractor nouă nu se potrivește cu regula, chiar dacă e de un fel cunoscut.
- **Ales.**
  - O alegere poate deveni tipizată (`typed`): membrii ei pot fi tipare sau clase și înseamnă „orice aplicare a lor”. Câte valori acoperă alegerea, pentru măsura în biți, se numără din aplicările tipurilor.
  - Liveness: tipurile acceptate de un tipar viu rămân vii.
  - La commit, o valoare pe care tipul nu o mai acoperă rămâne membru direct (I6).
  - Trecerea de tipuri (`src/sleep/types.mjs`) propune tipizarea, iar judecata unică (D20) decide.
- **Dovezi.**
  - Fără gardă: pe GPARA, QA 88/76/94% (față de 84/76/92%), dar pe BABI2 QA scade de la 48–52% la 32–37%. O „deplasare oarecare” ca distractor acceptă și mutarea aceleiași persoane.
  - Cu judecata unică: pe GBLIND, două tipizări acceptate.
- **Revizuire.** Rămâne de remăsurat BABI2 cu judecata unică.

## D19. Inducția: ipotezele testate prin consecințe (`induction`, opțional)

- **Ales.** O ipoteză de concept care cuprinde strict o clasă vie propune formele în plus. Fiecare formă se testează pe o copie (adăugare, apoi somn) față de un martor identic fără adăugare, prin judecata unică. Clasele surori rămân disjuncte: o formă confirmată deja într-o altă clasă vie nu e propusă.
- **Dovezi.** Pe GBLIND, sămânța 1, inducția **nu a avut candidați** în rularea finală. „is sitting in” a intrat în clasa LOC prin ridicare, nu prin inducție (o afirmație anterioară în conversație era greșită). Într-o rulare anterioară, fără disjuncție, „is in” intrase și în clasa capcanelor; de aici regula disjuncției.
- **Revizuire.** Inducția nu e încă dovedită pe date.

## D20. Judecata unică a generalizărilor

- **Ales.** Orice lărgire (tipizare, adăugare la clasă) se judecă la fel, pe o copie (`src/sleep/generalize.mjs`):
  - **MDL:** câștigul exact al memoriei;
  - **contraexemple:** biții de predicție ai unităților văzute pe care schimbarea le revendică nou;
  - **validare:** eroarea pe textul de validare, dacă există.
- **Criteriul.** În biți, schimbarea trece dacă câștigul minus scumpirea predicției este > 0 (descrierea totală) și validarea nu crește. În termeni, predicția nu are voie să se strice deloc.
- **Corectură.** Prima variantă cerea „predicția nu se strică deloc” și în biți. A respins orice tipizare, pentru că o generalizare redistribuie mereu probabilitatea.
- **Alte schimbări legate:**
  - gruparea conceptuală (D17) folosește doar clase vii;
  - regula ad-hoc „o ipoteză cere ≥ 2 roluri” a fost scoasă;
  - pragurile conceptelor vin din θ_merge.

## D21. Curriculumul pe niveluri (`levelCurriculum`, opțional)

- **Context.** Pe GBLIND, regulile de poveste se construiau peste forme de propoziție „pe loc” (`[Bram S in the office .]`), apărute devreme. Apoi le blocau, prin cuibărire.
- **Ales.** Fiecare nivel doarme până se stabilizează (treceri și alternative cu `maxLevel`) înainte să se construiască nivelul de deasupra.
- **Dovezi.** Singur, propozițiile ies toate cu forme generale, dar nu apare nicio regulă de poveste. Cauza e D22.

## D22. Alternativele încearcă și grupuri numai din înșiruiri (`altSeqGroups`, opțional)

- **Context.** Trecerea obișnuită ia întâi grupurile cu mai puține poziții libere, cum cere specificația. Grupurile mici își iau unitățile, apoi sunt respinse, și asta la fiecare trecere. Alternativele luau în calcul doar grupuri cu unități deja rescrise, așa că grupul mare (+390 de biți pe GBLIND) nu era încercat de nimeni.
- **Ales.** Când trecerea obișnuită se blochează, alternativele încearcă și grupurile de înșiruiri. Decide câștigul exact.
- **Dovezi.** Împreună cu D21, pe GBLIND apare prima regulă generală de poveste (folosită de 22 de ori). QA pe testul obișnuit urcă de la 17% la 39%.

## D23. Despărțirea grupurilor abstracte după o coloană (`splitAbstract`, opțional)

- **Context.** Grupurile abstracte amestecau poveștile despre loc cu cele despre obiect, pentru că au aceeași structură a repetițiilor. Coloana faptului nu se putea ridica.
- **Ales.** Pe lângă fiecare grup abstract se propun subgrupuri, câte unul pentru fiecare tipar (sau clasă vie) al unei coloane, cu cel puțin m_min unități. Alege câștigul exact.
- **Dovezi.** Pe GBLIND apar 4 reguli generale. QA pe testul obișnuit 44%, pe poveștile puse deoparte 17%.
- **Notă.** Toate dovezile D21–D23 sunt pe GBLIND, de acum set văzut. Testul de generalitate este GBLIND2 (preînregistrat în REZULTATE.md).

## D24. Refolosirea claselor după suprapunerea pe reuniune (`classJaccard`, opțional)

- **Context.** Pe GBLIND2 (sămânța 2), clasa PLACE a înghițit capcanele „is leaving” și „dreams of”. Urma din `classLift` (`HDCLM_TRACE=1`) arată cum:
  - o coloană cu doar 2 rânduri dă clasa {dreams of, rests in};
  - criteriul de refolosire măsura formele comune față de mulțimea mai mică, deci o singură formă comună ajungea;
  - clasele s-au înlănțuit ({a,b} + {b,c} + …), ca la gruparea cu legătură simplă.
- **Ales.** Suprapunerea se măsoară pe reuniune (Jaccard ≥ θ_merge), ca la conceptele de valori. Nu e un prag nou.
- **Dovezi** (cu toate opțiunile D17–D23 pornite, ambele seturi fiind de acum văzute):

  | Set | Reformulări cu aceeași ecuație | Capcane contopite | QA pe poveștile puse deoparte |
  |---|---|---|---|
  | GBLIND (semințele 1/2/3) | 57 / 100 / 100% | 0 / 0 / 0% | 29 / 39 / 64% (implicit: 14 / 7 / 14%) |
  | GBLIND2 (semințele 1/2/3) | 100 / 65 / 58% | 0 / **0 / 7%** (înainte: 0 / 50 / 38%) | 31 / 13 / 21% (neschimbat) |

- **Ce rămâne.** Pe GBLIND2 (sămânța 2), QA după numărul de fapte:
  - 2 fapte: aproape tot corect pe antrenare și pe testul obișnuit;
  - 4 fapte: 0 din 14, chiar și pe antrenare, pentru că nicio regulă nu are lungimea asta.

  Regulile au lungime fixă, deci e nevoie de golul din PROPUNERI_LACUNE.md (lacuna 3). Acesta e pasul următor.
