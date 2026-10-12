# Timpi și idei de optimizare

Toți timpii sunt de pe mașina de lucru (container cloud, Node 22) și sunt doar măsurători. Nu intră în nicio decizie a sistemului.

## Timpi măsurați

| Ce | Timp | Observație |
| --- | --- | --- |
| testele (`node --test test/*.test.mjs`) | ~20 s | B1 în teste ia cea mai mare parte |
| blocul A + G2P, exact | ~30 s | A7 ~15 s, A6 ~3 s |
| G11, exact, semințele 1 / 2 / 3 | 61 / 28 / 136 s | cel mai lent set (poveștile au 4–5 propoziții, iar trecerea de alternative are mulți candidați) |
| B1 (H1–H8, 3 strategii × 3 mărimi) | 99 s | |
| B5: A1, A3, A5, A6, G2P, exact | 6 s | |
| B5, bipolar D = 4096 | 75 s | ~12× față de exact |
| B5, phasor D = 4096 | 145 s | ~24× față de exact |
| blocul A complet, bipolar D = 4096 | 312 s | A7 225 s |
| B2 / B3 / B4 | 146 s (4 fire) / 48 s / 36 s | |
| `nearest` printre 100.000 de vectori, bipolar D = 4096 | 2,1 s | ~21 s la 1 milion; 16 GB |

## Unde se duce timpul (profil CPU, A7 exact, 16 s)

| % | Funcție | Ce face |
| --- | --- | --- |
| 23 | `simE` | asemănarea îmbogățită, pentru vot |
| 13 | `childDistribution` | votul: parcurge toate unitățile nivelului |
| 11 | `simC` | asemănarea compozițiilor (recursivă) |
| 10 | colectorul de gunoi | multe Map-uri și chei-șir temporare |
| 10 | `addTo` | adunări în Map |
| 7 | `P` | recursia pe niveluri |
| 6 | `normalize` | Map-uri noi la fiecare sursă |
| 6 | `key` | chei-șir „x,y” pentru memoizare |

**Concluzie:** predicția (votul) costă cel mai mult, nu somnul. Somnul o plătește și el, prin verificarea pe textul de validare (`validate`), care rulează predicția pe tot textul de validare la fiecare trecere și la fiecare împărțire a pachetului.

## Idei (de măsurat înainte de a fi adoptate)

| Nr. | Idee | Câștig așteptat | Risc / consecință |
| --- | --- | --- | --- |
| O1 | **Prefix incremental în vot:** la generare și la eroarea pe un document, prefixul crește cu un copil. Se țin sumele parțiale ale asemănărilor pentru fiecare unitate votantă și se adaugă doar termenul nou | O(n) în loc de O(n²) pe document | niciunul pentru rezultate, dacă se face exact |
| O2 | **Tăierea votanților:** greutatea este count·exp(β(s−1)). O unitate cu s mic contează puțin. Se votează doar printre candidații găsiți printr-un index (de exemplu, după copiii prefixului și după alegerile lor) | mare pe text adevărat | **schimbă rezultatele** (votanți tăiați): trebuie măsurat față de votul complet |
| O3 | **Chei numerice pentru memoizare** (x·2³² + y sau Map de Map-uri) în loc de șiruri | ~6% + o parte din GC | niciunul |
| O4 | **Distribuții ca vectori de numere** (Float64Array pe id-urile atomilor) în loc de Map-uri | ~15–20% (addTo, normalize, GC) | niciunul |
| O5 | **Validarea în somn:** eroarea fără pachet se calculează o singură dată pe trecere, nu la fiecare împărțire. Se poate folosi și un eșantion fix din textul de validare | mare pe text adevărat | eșantionul schimbă deciziile: de măsurat |
| O6 | **Trecerea de alternative:** în loc de o copie completă a memoriei pentru fiecare candidat, costul se calculează doar pe regiunea atinsă (unitățile, copiii lor, tiparele și alegerile implicate), cu contabilitatea globală (V, P) actualizată incremental | mare (G11 136 s) | trebuie să dea exact același total ca acum (test de egalitate) |
| O7 | **`nearest` cu vectori:** matrice contiguă de candidați (Float32Array D × N), produs scalar într-o buclă strânsă; pentru bipolar, biți împachetați și popcount; pentru căutări repetate, un index aproximativ (LSH) | 5–30× | LSH schimbă rezultatele: de măsurat ca în B5 |
| O8 | **Fire de execuție** (secțiunea 10): recunoașterea, gruparea și câștigurile pe felii, pe `node:worker_threads` | ~nr. de nuclee | regula de aur: rezultat identic cu și fără fire (I9) |
| O9 | **Vectori calculați o singură dată pe versiune** și împărțiți între somn și predicție (acum fiecare context și fiecare predictor își face propria vedere) | mediu, cu vectori | niciunul |

Ordinea propusă: întâi cele fără efect asupra rezultatelor (O1, O3, O4, O9, O6). Fiecare vine cu un test care arată că fișierele de ieșire rămân identice octet cu octet. Apoi, înaintea textului adevărat, cele care schimbă rezultatele (O2, O5, O7 cu LSH), fiecare măsurată față de varianta completă.

## Optimizări aplicate (fără efect asupra rezultatelor)

Setul de referință: `node src/cli.mjs experiment A,G2P,G10`, strategia exactă. După fiecare pas s-a calculat amprenta SHA-256 a celor 21 de fișiere de ieșire. **Amprenta a rămas aceeași la fiecare pas:** `0cb3e6e80bd53720`.

| Pas | Timp | Față de început |
| --- | --- | --- |
| referință | 35,8 s (B2 rula în paralel pe un nucleu) | |
| O3: chei numerice în memoizarea asemănărilor | 28,0 s | −22% |
| O1: sume incrementale în vot | 28,8 s | fără câștig pe G (prefixe scurte); păstrat pentru paragrafele lungi de pe text adevărat |
| O4: sursele nu se mai copiază în Map-uri normalizate | **26,0 s** | **−27%** |

Profilul după acești pași (A7 + G10, 21 s): **68% din timp e verificarea pe textul de validare din somn**, adică predicția rulată pe tot textul de validare la fiecare împărțire a pachetului. Din timpul predicției, votul (bucla peste toți votanții și sortarea lor) ia ~20%, iar căutările în cache-ul de asemănări ~19%.

**Ce urmează și de ce nu e „gratuit”.** Câștigurile mari de acum înainte schimbă rezultatele, deci trebuie măsurate față de varianta completă:
- **O2:** un index pentru votanți, ca să nu se compare cu fiecare unitate;
- **O5:** un eșantion fix din textul de validare;
- **O7** (cu vectori): biți împachetați și un index aproximativ.

**O6** (trecerea de alternative fără copii complete ale memoriei) ar trebui să dea rezultate identice, dar e mai mult cod.

**Pe text adevărat, fără O2 și O5, predicția nu scalează:** votul compară fiecare token cu toate unitățile nivelului. La 100.000 de tokeni de învățare înseamnă ~10⁴ unități × 10⁵ predicții de validare.

## Optimizări aplicate, partea a doua (tot fără efect asupra rezultatelor)

| Pas | Ce | Rezultat |
| --- | --- | --- |
| sursa 4 memorată | frecvența și partea egală pe vocabular nu depind de prefix; se calculează o dată pe nivel, nu la fiecare token | setul de referință: 26,0 → 22,8 s; amprenta identică |
| votul cu index exact | simE(x, y) > 0 ⟺ x și y au o trăsătură comună (atomul, o alegere, sau recursiv pe aceeași poziție). Asemănarea se calculează doar pentru votanții cu trăsături comune. Cei cu s = 0 au toți aceeași greutate și se iau dintr-o listă sortată o dată. Activ doar cu strategia exactă | G: fără câștig (aproape toți votanții au trăsături comune); **TinyStories 10k tokeni: predicția 4,5 → 2,2 s**, eroare identică (12,468698646527113 în ambele variante); amprenta identică |

## Optimizări aplicate, partea a treia: predicția fără distribuția completă

- **Problema.** Somnul complet pe 3k tokeni de TinyStories dura 38 s, față de 0,09 s fără validare și fără alternative. 82% din timp era validarea, iar în ea, agregarea distribuțiilor: la fiecare nivel, sursa 4 acoperă tot vocabularul și se aduna token cu token.
- **Ce s-a schimbat.**
  - Sursa 4, agregată pe primul token, se calculează o dată pe nivel.
  - Eroarea de predicție cere doar probabilitatea tokenului corect, deci se calculează direct: p = termenii mici + Σ coeficient · agregat(nivel).
- **Efect asupra rezultatelor.** Matematic același; adunările se fac în altă ordine:
  - TinyStories, 524 de predicții: abaterea relativă maximă 1,1·10⁻¹⁵;
  - setul de referință: amprenta se schimbă, dar toate cele 7967 de numere din cele 21 de fișiere sunt egale cu abatere relativă sub 5·10⁻¹⁶; memoriile, textele și deciziile sunt identice.
- **Timp.** Somnul complet pe 3k tokeni: **38,1 → 15,3 s** (totalul final identic, 29523,606). Setul de referință: 22,4 s.

## Constatări de la S1 (codul vechi, înainte de această optimizare)

| N | Somn fără validare și fără alternative | Somn complet | Eroare înainte → după somn |
| --- | --- | --- | --- |
| 3.108 | 0,09 s | 37,9 s | 8,331 → 8,345 (fără validare); 8,315 (complet) |
| 10.143 | 0,71 s | (oprit după 3,5 min, ca să fie reluat cu codul nou) | 7,812 → 7,846 (fără validare) |

**Pe text adevărat, somnul fără validare înrăutățește puțin predicția.** Asta e o constatare de mecanism (blocurile D și E), nu de viteză.
