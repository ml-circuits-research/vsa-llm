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
