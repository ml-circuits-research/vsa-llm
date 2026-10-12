# Model de limbaj HDC din text: arhitectură din principii (v0.9)

Oct 11, 2026 · @Sînică Alboaie

Sistemul citește text ca șir de tokeni și îl ține minte ca ecuații HDC. În veghe codează automat, fără nicio decizie. În somn grupează ecuațiile care seamănă și le adună; din sume ies tiparele. Cu cât doarme mai mult, cu atât compactează mai adânc.

Starea: designul este judecat din principii. Ce nu se poate hotărî din principii este trecut ca experiment în secțiunea 10; niciun experiment nu a fost rulat încă. Termenii speciali sunt explicați în anexă.

## 1. Esența

1. Textul intră ca șir de tokeni, tăiați de un tokenizer standard de LLM.
2. **Veghe:** fiecare bucată de text devine automat o ecuație: tokenii ei, în ordinea lor. Nu se ia nicio decizie.
3. Fiecare ecuație primește un nume, un atom de sens. Nivelul de deasupra se construiește din aceste nume: tokeni, cuvinte, propoziții, paragrafe.
4. **Somn:** sistemul grupează ecuațiile care seamănă și le adună. Din sume ies tiparele, alegerile și atomii de structură, iar ecuațiile se rescriu mai scurt.
5. **Predicție:** tiparele și textele din memorie care seamănă cu începutul unui text spun ce urmează.
6. Tot ce se învață stă în memorie, ca ecuații care se pot citi.

## 2. Trei principii

1. **Un vector ține puține lucruri.** Câte anume depinde de felul și de mărimea vectorilor și se măsoară (experimentul B2). Până atunci lucrăm cu cel mult 16 termeni pe ecuație. Urmare: textele lungi se țin pe niveluri.
2. **Cheile trebuie să difere, valorile trebuie să semene.** Cu ce legi trebuie să fie distinct, altfel părțile se amestecă. Ce legi trebuie să semene când este de același fel, altfel nimic nu generalizează.
3. **Tot ce se rescrie trebuie să se poată reface.** Fiecare atom nou își păstrează definiția în memorie. Se construiește pe atom; definiția servește la drumul înapoi spre tokeni.

## 3. Din ce este făcut

| Ce este | Rol | De unde vine |
| --- | --- | --- |
| Ordinea, ρ | cheie fără sens | o permutare fixă: al k-lea termen este permutat de k ori. Nu este un atom, ci o operație |
| Înglobarea, ν | cheie fără sens | a doua permutare fixă, aplicată unui atom de sens când intră ca valoare în ecuația de deasupra. Ține nivelurile despărțite |
| Atom de structură, S | cheie cu sens | atom random nou, creat în somn pentru un loc liber dintr-un tipar |
| Token | valoare | atom random, câte unul pentru fiecare token al tokenizerului |
| Atom de sens, N | valoare | vector construit din definiția lui |

- **Ordinea și structura** fac aceeași treabă: spun unde stă ceva. Textul brut folosește ordinea. Textul rescris folosește structura, iar ordinea rămâne doar în definiții.
- **Un atom de sens are doi vectori.** Vectorul de compoziție vine numai din definiție: din ce este făcut. Vectorul îmbogățit adaugă, cu o pondere fixă, alegerile din care face parte. La compoziție seamănă sensurile făcute din aceleași bucăți, ca \[ cit\]\[ește\] și \[ cit\]\[esc\]. La vectorul îmbogățit seamănă și cele care pot sta în același loc, ca „Ana” și „Maria”.
- **Ce vector se folosește unde.** Alegerile se construiesc numai din vectori de compoziție. În ecuațiile de pe nivelul de deasupra intră vectorul îmbogățit, trecut prin ν. Notația nu mai arată ν: N1 scris ca valoare înseamnă deja ν(N1).
- **Sumele își păstrează ponderile.** O sumă se normalizează, dar nu se rotunjește la +1 și −1: rotunjirea șterge termenii ușori.
- **Memoria** conține doar ecuații: textele citite și definițiile atomilor noi. O numărătoare este ponderea unui termen într-un BUNDLE.

## 4. HDC ca strategie

Designul nu depinde de un anumit fel de vectori. Felul vectorilor, mărimea lor și felul în care se fac operațiile formează o strategie, care se poate schimba fără să se schimbe restul. Restul sistemului cere doar proprietățile de mai jos.

| Operație | Ce cerem de la ea |
| --- | --- |
| atom nou | doi atomi noi nu seamănă între ei |
| BIND(cheie, valoare), scris ⊗ | rezultatul nu seamănă nici cu cheia, nici cu valoarea. Se desface exact cu cheia. Cu aceeași cheie, valori asemănătoare dau rezultate asemănătoare. Legarea unei sume este suma legărilor |
| BUNDLE(termeni, ponderi), scris + | rezultatul seamănă cu fiecare termen, mai mult cu cei grei. Ordinea termenilor nu contează |
| ρ, ordinea | ρ(x) nu seamănă cu x. Se poate inversa. Păstrează asemănarea. Aplicată de k ori, dă k chei distincte |
| ν, înglobarea | se poate inversa și păstrează asemănarea. Nu se poate schimba între ea cu ρ: ν(ρ(x)) nu seamănă cu ρ(ν(x)). Astfel \[\[a,b\],\[c,d\]\] și \[\[a,c\],\[b,d\]\] dau vectori diferiți |
| asemănare(a, b) | 1 pentru vectori identici, aproape 0 pentru vectori fără legătură; crește cu partea comună |
| normalizare(sumă) | aduce o sumă la lungimea standard și păstrează ponderile relative ale termenilor. Dacă strategia rotunjește, pierderea se măsoară |
| cel mai apropiat(vector) | găsește în memorie vectorii cei mai asemănători |

La strategiile cu vectori, proprietățile țin doar aproximativ. Cât de aproximativ măsoară experimentul B1.

Strategii de încercat, la mărimi între 1.024 și 65.536 de componente:

| Strategie | Vectori | BIND | BUNDLE |
| --- | --- | --- | --- |
| exactă, de referință | fără vectori: lista termenilor ecuației | pereche cheie–valoare | listă cu ponderi |
| bipolară densă | +1 și −1 | înmulțire pe componente | sumă |
| binară densă | 0 și 1 | XOR | majoritate |
| fazori | unghiuri | adunare de unghiuri | sumă de numere complexe |
| rară pe blocuri | un singur 1 în fiecare bloc | adunare de poziții în bloc | sumă pe blocuri |

- **Strategia exactă** nu are zgomot și nu are limită de termeni. Asemănarea ei este partea comună a două liste de termeni, raportată la mărimea lor. Doi termeni cu aceeași cheie contează cât seamănă valorile lor, calculat la fel, din definiții; termenii cu chei diferite contează 0.
- **Referința.** Față de strategia exactă se măsoară toate celelalte: unde o strategie cu vectori dă alt răspuns, acela este zgomotul ei.
- **Care strategie și ce mărime** se folosesc hotărăsc experimentele B1–B5.

## 5. Veghe: din text în ecuație, automat

1. Textul se împarte în tokeni.
2. Șirul de tokeni se taie în unități, la granițe (tabelul de mai jos).
3. Fiecare unitate devine o ecuație, cu ordinea dată de ρ.
4. Unitatea închisă primește un atom de sens și se memorează. Nivelul de deasupra continuă cu acel atom.

```
„Ana citește.”   →   [An][a][ cit][ește][.]        (împărțirea în tokeni este ilustrativă)

cuvinte:      N1 = [An] + ρ[a]          N2 = [ cit] + ρ[ește]
propoziție:   N3 = N1 + ρN2 + ρ²[.]
```

| Graniță | Unitatea pe care o închide |
| --- | --- |
| spațiu (la tokenizerele de LLM este lipit de tokenul care urmează) | cuvânt |
| , ; : | parte de propoziție |
| . ! ? | propoziție |
| sfârșit de paragraf | paragraf |
| sfârșit de document | document |
| perechi: ( ) \[ \] { } „ ” | o unitate cuibărită, oriunde apare |

- **Granițele sunt tokeni obișnuiți.** Rămân în ecuație și își capătă sensul prin învățare: \[?\] și \[.\] la capătul unei propoziții dau ecuații diferite. Specială este doar regula „aici se termină o unitate”.
- **O graniță este o presupunere de pornire, nu o lege.** Același token poate avea alt rol în alt context. Trei protecții: o regulă de formă (punctul sau virgula dintre două cifre nu taie: „3.14”); ce s-a lipit prin repetiție nu se mai taie („Dr.”, „e.g.”); când rămâne îndoială, se păstrează ambele tăieturi, ca interpretări cu ponderi.
- **Lista ține de felul în care este scris textul, nu de limbă.** Este singura cunoaștere dată de noi.
- **Context.** Cu 16 termeni pe nivel, patru niveluri acoperă circa 65.000 de tokeni. Contextul îndepărtat este însă grosier: rezumat în atomi de sens. Detaliul exact se regăsește prin definițiile din memorie.

## 6. Somn: grupează ce seamănă și adună

Somnul lucrează pe fiecare nivel, de jos în sus, în treceri. Într-o trecere, vectorii rămân cei de la începutul ei.

1. **Grupare.** Pentru fiecare ecuație se caută în memorie cele care seamănă cu ea peste un prag. Asemănarea doar propune grupuri; nu le acceptă.
2. **Adunare.** Ecuațiile din grup se adună (BUNDLE). În sumă, termenii comuni ies grei, iar pe locul unde ecuațiile diferă se adună tot ce a stat acolo.
3. **Citire.** Termenii grei sunt partea fixă. Locul cu mai mulți termeni ușori este un loc liber, iar ce s-a adunat acolo este o alegere.
4. **Propunere.** Fiecare grup dă un tipar, cu locurile lui libere și cu alegerile lor. Două alegeri cu aproape aceiași membri devin una singură, folosită de ambele tipare.
5. **Judecată în pachet.** Toate propunerile trecerii se evaluează împreună. Apoi se scot pe rând cele fără de care totalul iese mai mic, până nu mai e nimic de scos.
6. **Rescriere.** Fiecare ecuație dintr-un grup acceptat devine o aplicare: tiparul, cu ce s-a pus la fiecare loc liber.
7. **Îmbogățire și recalculare.** Membrii alegerilor acceptate primesc atomul alegerii în vectorul îmbogățit, o singură dată. Vectorii construiți pe ce s-a schimbat se recalculează, iar nivelul de deasupra reia aceiași pași.

```
în memorie, după veghe:
  „Ana citește.”      N1 + ρN2 + ρ²[.]
  „Maria citește.”    N4 + ρN2 + ρ²[.]            seamănă: doi termeni din trei sunt comuni

suma:       (N1 + N4) + 2·ρN2 + 2·ρ²[.]
citire:     parte fixă: ρN2 și ρ²[.]        loc liber: primul, unde au stat N1 și N4

propunere:  alegerea  N5 = N1 + N4              „Ana sau Maria”
            tiparul   N6 = S1 + ρN2 + ρ²[.]     „cineva citește.”; locul S1 acceptă N5

aplicare:   „Ana citește.”    =  N6(S1: N1)      vectorul ei: N6 + S1⊗N1
            „Maria citește.”  =  N6(S1: N4)      vectorul ei: N6 + S1⊗N4
```

**Ce este un tipar.** O înșiruire în care unii termeni sunt ficși, iar alții sunt locuri libere. La un loc liber poate sta oricare membru al unei alegeri. Tiparul este un atom de sens; locurile lui libere sunt atomi de structură.

**Ce este o aplicare.** N6(S1: N1) înseamnă: ia tiparul N6 și pune N1 la locul S1. Nu este o adunare de definiții. Vectorul tiparului conține partea fixă și locurile libere, nu și alegerea; de aceea „Maria” nu apare în vectorul lui „Ana citește.” Ce acceptă un loc liber stă în definiția lui, în memorie.

De ce contează tiparele:

- **De aici vin atomii de structură.** S1 ajunge să însemne „cine citește” fără ca cineva să-i fi dat acest sens. Se vede din tiparul în care stă și din ce îl umple.
- **Dau rolul unui token în context.** Același token poate însemna lucruri diferite; tiparul în care este recunoscut spune ce rol are acolo.
- **Acoperă texte nevăzute.** „Ion citește.” se potrivește cu N6 dacă „Ion” seamănă cu membrii lui N5.
- **Spun ce urmează.** După „Maria”, tiparul N6 așteaptă „citește”.

Ce mai iese din aceeași operație:

- **Terminațiile.** \[ cit\]\[ește\], \[ vorb\]\[ește\] și \[ priv\]\[ește\] seamănă; suma lor dă un tipar de cuvânt cu partea fixă \[ește\].
- **Tipare tot mai largi.** Când apar și „Ana scrie.”, „Maria scrie.”, suma tuturor are două locuri libere: „cineva face ceva.”
- **Tipare cuibărite.** Un loc liber poate fi umplut de alt tipar, de pe nivelul de dedesubt.

**Locuri legate: cum ajunge un tipar să fie o regulă.** Dacă în toate textele unui grup două locuri libere poartă mereu același lucru, ele devin un singur loc, care apare de două ori în tipar. Legătura se caută între toate locurile unui tipar, inclusiv cele din tiparele cuibărite în el.

```
„Ana are cartea. Cine are cartea? Ana.”
„Ion are mingea. Cine are mingea? Ion.”

tipar:   [S1 are S2.] [Cine are S2?] [S1.]        S1 și S2 apar de câte două ori
```

Un astfel de tipar spune ce se ia de unde. La „Maria are ziarul. Cine are ziarul?”, locul S1 din răspuns este deja umplut în textul curent, deci răspunsul este „Maria”, chiar dacă propoziția nu a mai fost văzută. Este cel mai simplu fel de judecată pe care îl poate face sistemul și primul care trebuie validat (A5–A7).

**După ce se judecă un pachet de rescrieri.**

1. Textul se reface exact din aplicare plus definiții.
2. Totalul scade: definițiile plus toate textele rescrise ocupă mai puțin decât înainte.
3. Predicția pe text pus deoparte nu se înrăutățește.

- **De ce în pachet.** Zece nume, fiecare în „Nume citește.” și „Nume scrie.”, înseamnă 60 de termeni. Rescris doar grupul cu „citește”: 63. Rescrise amândouă, cu aceeași alegere de nume: 56. Luată singură, prima rescriere s-ar respinge, deși împreună câștigă.
- **De ce nu ajunge compresia.** Tiparul „oraș este capitala țară” reface exact „Paris este capitala Franței.” și „Roma este capitala Italiei.”, dar acceptă și „Paris este capitala Italiei.” Compresia propune tipare refolosibile; dacă refolosirea este bună se vede numai din predicție. Perechile adevărate nu se pierd: stau în aplicările ținute minte, iar predicția le folosește (secțiunea 7).
- **De ce atâtea precauții.** Dacă membrii unei alegeri ar începe să semene imediat ce au fost grupați, asemănarea ar confirma singură gruparea. De aceea vectorii sunt înghețați în timpul unei treceri, alegerile se fac din vectori de compoziție, îmbogățirea se adaugă o singură dată, iar acceptarea o dă judecata pachetului, nu asemănarea.

**Mai multe interpretări.** O ecuație poate intra în mai multe grupuri. Se păstrează câteva rescrieri, fiecare cu ponderea ei, până când una domină.

**Deplasare.** Același tipar început pe altă poziție nu seamănă deloc. Se încearcă toate deplasările; sunt cel mult câți termeni are o ecuație.

## 7. Predicție

1. **Codare.** Începutul textului se codează ca în veghe; bucățile cunoscute se recunosc. Dacă se potrivește un tipar, începutul devine o aplicare neterminată.
2. **Vot.** Se caută în memorie textele care seamănă cu începutul. Fiecare text are un singur vot, cu o greutate care crește cu asemănarea. Tiparele nu votează separat: ele aliniază textele cu începutul.
3. **Perechi.** Fiecare text votează pentru ce are el pe locul următor. Pentru că votează texte întregi, contează ce valori au apărut împreună: după „Paris este capitala”, textele cu Paris votează „Franței”.
4. **Patru surse.** Probabilitatea unei continuări vine din: la un loc legat, valoarea deja pusă în textul curent; voturile textelor; la un loc liber, membrii alegerii, după cât de des au stat acolo; frecvența tokenilor, ca rezervă când nu votează nimeni. Proporțiile se fixează pe validare.
5. **Probabilitatea tokenului următor** este suma probabilităților tuturor continuărilor care încep cu acel token. Dacă „Ana” și „Anca” au câte 0,3, iar „Maria” are 0,4, atunci \[An\] are 0,6.
6. **Propoziția următoare** se prezice la fel, cu un nivel mai sus.

Fără somn, sistemul prezice doar ce a văzut aproape identic. Somnul lărgește ce seamănă cu ce; dacă lărgirea ajută se măsoară pe text pus deoparte.

## 8. Cum se adaugă un caz nou

Nu se adaugă feluri de atomi. Un caz nou intră pe una din două căi.

| Cale | Când | Exemple |
| --- | --- | --- |
| o graniță sau o regulă de formă nouă, în secțiunea 5 | cazul ține de forma scrisă a textului | parantezele și acoladele din formule și din cod; liniuța de dialog; punctul dintre cifre |
| nimic: se lasă învățat ca tipar | cazul ține de limbă sau de sens | întrebarea (tokenul \[?\] la capătul unității); negația (tokenul \[ nu\]); „X = Y” într-o formulă; punctul din „obiect.metodă” în cod |

## 9. Date

Datele urcă pe trepte, de la text în care știm răspunsul la text adevărat.

| Treaptă | Date | De ce | Pentru blocurile |
| --- | --- | --- | --- |
| 1 | text generat de noi, dintr-o gramatică mică | știm dinainte tiparele și alegerile adevărate, deci se poate verifica dacă sistemul le găsește | A, B5 |
| 2 | texte cu întrebări, în care răspunsul trebuie scos din ce s-a citit: întâi generate de noi (G7–G9), apoi sarcinile publice [bAbI](https://arxiv.org/abs/1502.05698) | arată dacă sistemul judecă: folosește textul din fața lui ca să răspundă, nu doar ce a memorat | A, E |
| 3 | [TinyStories](https://arxiv.org/abs/2305.07759): povești scurte în engleză, cu circa 1.500 de cuvinte de bază | propoziții scurte, vocabular mic, multă repetiție. Este textul pe care tiparele ar trebui să apară cel mai ușor | C, D, E, la scară mică |
| 4 | corpusul tbsop: 6,3 milioane de tokeni de engleză scrisă de oameni, din conversații, cărți, manuale și texte diverse | text variat și adevărat | C, D, E, F |

Textul generat, de pe treapta 1. Fiecare set adaugă o singură greutate.

| Set | Ce conține | Ce verifică |
| --- | --- | --- |
| G1 | 10 nume și 2 verbe: „Ana citește.” | două tipare cu aceeași alegere (A1, A2) |
| G2 | G1 plus un obiect: „Ana citește cartea.” | tipare cu două locuri libere (A1) |
| G3 | 20 de orașe, fiecare cu țara lui: „Paris este capitala Franței.” | perechile (A3) |
| G4 | cuvinte puse la întâmplare | că nu apar tipare acolo unde nu există (A4) |
| G5 | G2 cu un cuvânt în față, uneori: „Ieri Ana citește cartea.” | deplasarea |
| G6 | cuvinte făcute din bucăți: rădăcini și terminații | tiparele din interiorul cuvintelor |
| G7 | un fapt și o întrebare despre el: „Ana are cartea. Cine are cartea? Ana.” | răspunsul luat din faptul de alături (A5) |
| G8 | două fapte de combinat: „Ana este în grădină. Cartea este la Ana. Unde este cartea? În grădină.” | doi pași (A6) |
| G9 | G7 cu propoziții fără legătură între fapt și întrebare | găsirea faptului util printre altele (A7) |

- **Tokeni.** În G1–G5 și G7–G9 un cuvânt este un token, ca tokenizerul să nu încurce verificarea. De la G6 și pe text adevărat se folosește tokenizerul GPT-2, public, cu circa 50.000 de tokeni. Același peste tot.
- **Împărțire.** Pe documente întregi (povești, capitole), nu pe propoziții: 80% învățare, 10% validare, 10% test final. Eroarea se raportează separat pe propozițiile care nu apar identic la învățare.
- **Atenție la treapta 3.** TinyStories este scris de un LLM. Este mai regulat decât textul scris de oameni, deci un rezultat bun acolo este un pas, nu dovada finală.
- **Cod.** Pentru experimentul F2 trebuie adăugat și cod sursă. Toate textele sunt în engleză; limba nu este ce testăm.
- **Ce este propunere.** Treapta 3 și tokenizerul sunt propuneri. O alternativă la treapta 3 sunt datele [BabyLM](https://arxiv.org/abs/2301.11796): 10 milioane de cuvinte, inspirate din ce aud copiii; mai naturale, dar mai puțin repetitive.

## 10. Ce decid experimentele

Tot ce nu se poate hotărî din principii este mai jos, ca experiment. Niciunul nu a fost rulat.

Reguli:

- **Întâi mecanismul, apoi vectorii.** Blocul A rulează fără vectori, pe text generat. Dacă mecanismul nu merge exact, restul nu se rulează până nu este reparat.
- **O întrebare, o regulă.** Fiecare experiment răspunde la o singură întrebare și are regula de decizie scrisă înainte de rulare.
- **Ordine.** Blocurile se rulează de la A la F. Ce fixează un bloc nu se mai schimbă în blocurile următoare.
- **Date.** Textul real se împarte o singură dată în trei: învățare, validare (pe ea se fixează parametrii) și test final, folosit o singură dată, la sfârșit.
- **De la mic la mare.** Datele urcă pe treptele din secțiunea 9. Pe fiecare treaptă, întâi 100.000 de tokeni, apoi un milion, apoi tot.
- **Referința.** Strategia exactă rulează alături de fiecare strategie cu vectori.
- **Jurnal.** Rezultatul și decizia se trec în acest document, lângă experiment.
- **Pragurile** din regulile de decizie (1%, 5% și celelalte) sunt alese de mine ca punct de pornire.

**Blocul A: mecanismul.** Cu strategia exactă, pe seturile generate G1–G4 și G7–G9. Nu are nevoie de corpus.

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| A1 | Găsește sistemul singur două tipare care folosesc aceeași alegere? | seturile G1 și G2 | tiparele și alegerile găsite; totalul; refacerea textelor; eroarea de predicție pe propoziții puse deoparte | trebuie să iasă toate patru: două tipare cu o singură alegere, total mai mic, refacere 100%, eroare mai mică decât fără somn. Altfel se repară mecanismul înainte de orice altceva |
| A2 | Ajunge judecata în pachet? | acceptare una câte una; acceptare în pachet, cu scoatere | totalul final | pachetul rămâne dacă dă un total mai mic. Dacă nici el nu ajunge la soluția de 56 de termeni, procedura se schimbă |
| A3 | Ține predicția cont de perechi? | setul G3 | probabilitatea dată țării corecte, față de celelalte țări | țara corectă trebuie să primească cea mai mare probabilitate în peste 95% din cazuri |
| A4 | Se confirmă gruparea singură? | setul G4; cu și fără înghețarea vectorilor; ponderea îmbogățirii | câte tipare rămân acceptate după fiecare trecere | pe text fără structură nu trebuie să rămână niciun tipar. Ponderea îmbogățirii: cea mai mare la care asta încă ține |
| A5 | Răspunde la o întrebare din faptul de alături? | setul G7; cu și fără locuri legate | cât de des răspunsul corect primește cea mai mare probabilitate, pe nume și obiecte nevăzute împreună la învățare | peste 95% cu locuri legate; la întâmplare ar fi 10%. Fără locuri legate mă aștept să pice; dacă nu pică, locurile legate nu sunt necesare |
| A6 | Combină două fapte? | setul G8 | la fel ca la A5 | peste 90%. Altfel sistemul face un pas de judecată, dar nu doi |
| A7 | Găsește faptul util printre altele? | setul G9, cu 1 până la 5 propoziții între fapt și întrebare | răspunsul corect, după câte propoziții stau între | se notează până la câte propoziții rămâne peste 90%. Dacă pică de la prima, sistemul leagă doar propoziții alăturate |

**Blocul B: stratul HDC.** Date generate la întâmplare; la B5, textul din blocul A.

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| B1 | Cât de bine respectă strategia proprietățile din secțiunea 4? | strategia, mărimea | fiecare proprietate, pe 10.000 de încercări. Separat: pierderea la normalizare pentru sume cu ponderi inegale; despărțirea structurilor \[\[a,b\],\[c,d\]\] și \[\[a,c\],\[b,d\]\] | strategia care încalcă o proprietate iese. Pierderile celorlalte se notează |
| B2 | Câți termeni ține o ecuație? | strategia, mărimea, numărul de termeni (2–256), numărul de candidați (până la 100.000) | cât de des un termen este recunoscut greșit | limita este cel mai mare număr de termeni cu eroare sub 1%. Înlocuiește valoarea 16 |
| B3 | De la ce asemănare în sus două ecuații „seamănă”? | strategia, mărimea, câți termeni au în comun | asemănarea între ecuații fără legătură și între ecuații cu jumătate din termeni comuni | pragul este valoarea care le desparte cu eroare sub 1%. Dacă nu există, mărimea este prea mică |
| B4 | Cât costă? | strategia, mărimea | memoria pe ecuație; timpul unei căutări printre un milion de ecuații | dintre strategiile care trec B1–B3 se alege cea mai ieftină |
| B5 | Dă strategia cu vectori aceleași rezultate ca cea exactă? | blocul A, rulat din nou cu fiecare strategie rămasă | aceleași măsurători ca în blocul A | strategia rămâne dacă trece aceleași reguli de decizie |

**Blocul C: veghea.** Cu text real, fără învățare.

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| C1 | Cât de des depășește o unitate limita din B2? | nivelul: cuvânt, parte de propoziție, propoziție, paragraf | lungimea unităților, în termeni | sub 5% depășiri: unitățile prea lungi se taie după mărime. Peste 5%: în D1 se compară două feluri de tăiere, după mărime și la marginea celui mai lung tipar cunoscut |
| C2 | Se reface textul? | strategia; cu și fără definițiile din memorie | câte texte se refac exact, pe fiecare nivel | cu definiții trebuie 100%. Doar din vectori: se notează până la ce nivel merge |
| C3 | Câte granițe sunt înșelătoare? | cu și fără cele trei protecții | tăieturile greșite, pe 500 de granițe verificate de mână | sub 1% cu protecții: ajung. Altfel se adaugă reguli de formă |

**Blocul D: somnul, pe text real.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| D1 | Care este pragul de grupare și cu ce se măsoară „totalul”? | pragul de asemănare; măsura: număr de termeni sau informație, în biți | totalul după somn; eroarea de predicție pe validare | rămâne perechea de prag și măsură cu eroarea cea mai mică |
| D2 | Suma unui grup dă într-adevăr tiparul? | mărimea grupului; strategia | cât de des partea fixă și locurile libere citite din sumă coincid cu cele calculate exact | peste 95%: citirea din sumă rămâne. Altfel tiparul se calculează exact, iar suma servește doar la găsirea grupurilor |
| D3 | Depinde rezultatul de ordinea în care se face somnul? | 5 ordini diferite | cât coincid tiparele găsite; totalul | diferențe sub 5% la total: ordinea nu contează. Altfel se fixează ordinea: de la grupurile cele mai mari |
| D4 | Cât contează deplasarea? | cu și fără încercarea deplasărilor; aliniere de la începutul sau de la sfârșitul unității | câte tipare în plus se găsesc; totalul | rămâne dacă scade totalul cu peste 2% |
| D5 | Ajută mai mult somn? | numărul de treceri, de la 1 la 20 | totalul și eroarea de predicție după fiecare trecere | somnul se oprește când eroarea pe validare nu mai scade |

**Blocul E: predicția.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| E1 | Prezice mai bine decât metodele simple? | sistemul fără somn și cu somn; numărarea de succesiuni; o rețea mică învățată pe același text | eroarea de predicție pe tokenul următor | somnul ajută dacă scade eroarea față de „fără somn”. Sistemul merită continuat dacă bate numărarea de succesiuni |
| E2 | Care sunt proporțiile celor patru surse și cât de repede scade votul cu asemănarea? | cele patru proporții; un parametru pentru vot | eroarea pe validare | valorile cu eroarea cea mai mică |
| E3 | Generalizează la combinații nevăzute? | cu și fără vectorul îmbogățit | eroarea pe combinații de cuvinte nevăzute la învățare | îmbogățirea rămâne dacă scade eroarea |
| E4 | Ajută contextul îndepărtat, chiar grosier? | câte niveluri de context intră în vot, de la 1 la 4 | eroarea de predicție | rămân nivelurile care scad eroarea |
| E5 | Se poate prezice propoziția următoare? | nimic | locul propoziției adevărate între 20 de candidate | la întâmplare ar ieși prima în 5% din cazuri. Peste 15%: nivelurile de sus merg |
| E6 | Judecă și pe texte pe care nu le-am făcut noi? | sarcinile bAbI cu un fapt, cu două fapte și cu deducție; alături, numărarea de succesiuni și o rețea mică | cât de des răspunsul este corect | se compară cu A5–A7. Dacă pe textul nostru merge și aici nu, diferența arată ce lipsește pe text mai variat |

**Blocul F: sensul.**

| Nr. | Întrebare | Ce variem | Ce măsurăm | Cum decidem |
| --- | --- | --- | --- | --- |
| F1 | Se pot citi atomii? | nimic | un om încearcă să numească 50 de alegeri, 50 de tipare și 50 de locuri libere, după primii 10 membri | se notează câte primesc un nume. Nu schimbă designul |
| F2 | Tokenii cu mai multe roluri ajung în tipare diferite? | text obișnuit și cod | pentru \[.\], \[:\] și \[\*\]: cât de curat desparte fiecare tipar un singur rol | sub 80% curat: tiparul singur nu ajunge și trebuie mai mult context |
| F3 | Gramatică sau sens? | 200 de perechi cu același sens și formă diferită; 200 cu aceeași formă și sens diferit | care perechi ies mai asemănătoare | dacă forma câștigă, se încearcă legarea tiparelor pe nivelul de deasupra și se măsoară din nou |

Perechile din F3 și verificările de mână din C3 și F1 servesc doar la măsurat. Nu intră niciodată în învățare.

## Anexă: termeni

**Vectori și operații**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| HDC | calcul cu vectori foarte lungi: orice lucru este un vector, iar lucrurile se combină prin câteva operații simple |  |
| Vector | șir lung de numere |  |
| Strategie | un fel anume de a face vectorii și operațiile. Se poate schimba fără a schimba restul | bipolară densă |
| Strategie exactă | strategia de referință, fără vectori și fără zgomot: ține lista termenilor |  |
| Mărime | câte componente are un vector | 4.096 |
| Atom | vector care stă pentru un singur lucru | \[ cit\], S1, N2 |
| Random | cu componente alese la întâmplare. Doi vectori random nu seamănă între ei |  |
| Asemănare | cât de mult seamănă doi vectori: 1 înseamnă identici, 0 înseamnă fără legătură |  |
| Prag de asemănare | valoarea peste care două ecuații se consideră asemănătoare |  |
| Zgomot | abaterea unui răspuns dat de vectori față de răspunsul exact |  |
| BIND, ⊗ | leagă o cheie de o valoare. Rezultatul nu seamănă cu niciuna; cu cheia, valoarea se scoate înapoi | S1⊗N1 |
| BUNDLE, + | adună vectori. Rezultatul seamănă cu fiecare dintre ei | N1 + N4 |
| Ordine, ρ | permutare fixă a componentelor. Aplicată de k ori, marchează locul k într-un șir | ρ²\[.\] |
| Înglobare, ν | a doua permutare fixă, aplicată unui atom de sens când intră ca valoare în ecuația de deasupra |  |
| Desfacere | scoaterea unei valori dintr-o ecuație, cu ajutorul cheii ei |  |
| Normalizare | aducerea unei sume la lungimea standard, cu ponderile păstrate |  |
| Capacitate | câți termeni poate ține un BUNDLE și să mai poată fi citit |  |

**Piese**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Token | bucată de text dată de tokenizer; poate fi mai mică decât un cuvânt | \[ cit\], \[ește\], \[.\] |
| Tokenizer | programul standard care taie textul în tokeni, același ca la un LLM |  |
| Cheie | spune unde stă ceva: ordinea sau un atom de structură | ρ, S1 |
| Valoare | ce stă acolo: un token sau un atom de sens | \[.\], N1 |
| Termen | o piesă a unei ecuații: o valoare, permutată sau legată de o cheie | ρN2, S1⊗N1 |
| Ecuație | sumă de termeni | N1 + ρN2 + ρ²\[.\] |
| Atom de sens, N | numele unei ecuații | N2 = „citește” |
| Vector de compoziție | vectorul unui atom de sens, construit numai din definiția lui |  |
| Vector îmbogățit | vectorul de compoziție, plus alegerile din care atomul face parte |  |
| Atom de structură, S | numele unui loc liber dintr-un tipar | S1 = „cine citește” |
| Definiție | ecuația din memorie care spune din ce este făcut un atom | N2 = \[ cit\] + ρ\[ește\] |
| Memorie | toate ecuațiile ținute minte: texte și definiții |  |

**Veghe**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Veghe | faza în care textul este citit și codat automat |  |
| Graniță | token la care se termină o unitate | spațiul, punctul |
| Unitate | bucata de text dintre două granițe | un cuvânt, o propoziție |
| Nivel | treaptă a ierarhiei | tokeni, cuvinte, propoziții, paragrafe |

**Somn**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Somn | faza în care memoria este parcursă și rescrisă mai scurt |  |
| Trecere | o parcurgere a memoriei în somn; vectorii nu se schimbă în timpul ei |  |
| Grup | ecuații care seamănă între ele peste prag | „Ana citește.”, „Maria citește.” |
| Înșiruire | „aceste lucruri, în această ordine” | \[ cit\] apoi \[ește\] |
| Alegere | „unul dintre aceste lucruri” | Ana sau Maria |
| Loc liber | termenul dintr-o înșiruire la care stă o alegere | cine, în „cineva citește.” |
| Tipar | o înșiruire cu cel puțin un loc liber | „cineva citește.” |
| Aplicare | un tipar, împreună cu ce s-a pus la fiecare loc liber al lui | N6(S1: N1) |
| Rescriere | înlocuirea unei ecuații cu aplicarea unui tipar, din care textul se poate reface |  |
| Pachet | toate propunerile unei treceri, judecate împreună |  |
| Total | cât ocupă definițiile plus toate textele rescrise |  |
| Deplasare | același tipar, început pe altă poziție |  |
| Interpretare | una dintre rescrierile posibile ale unui text |  |
| Pondere | cât contează o interpretare sau un termen; de regulă, de câte ori a fost văzut |  |
| Colaps | momentul în care o interpretare domină și celelalte se abandonează |  |
| Loc legat | un loc liber care apare de două ori într-un tipar și poartă de fiecare dată același lucru | S1 în \[S1 are S2.\] \[Cine are S2?\] \[S1.\] |

**Predicție**

| Termen | Înțeles | Exemplu |
| --- | --- | --- |
| Vot | contribuția unui text din memorie la ce urmează |  |
| Continuare | un lucru care poate urma: un token sau un atom de sens |  |
| Eroare de predicție | cât de mică a fost probabilitatea dată tokenului corect (minus logaritmul ei). Mai mic înseamnă mai bine |  |
| Numărare de succesiuni | metodă simplă de comparație: prezice tokenul următor după cât de des a urmat după ultimii câțiva tokeni |  |
| Desfășurare | drumul de la un atom de sens, prin definiții, până la tokeni | N3 → N1, N2, \[.\] → \[An\]\[a\]\[ cit\]\[ește\]\[.\] |
