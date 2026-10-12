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
