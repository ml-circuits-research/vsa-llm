# Plan de lucru

## Unde trebuie să ajungem

Specificația are un singur test final: **un model de limbaj care învață din text, ține minte totul ca ecuații care se pot citi, și prezice mai bine decât metodele simple** (experimentul E1: să bată numărarea de succesiuni pe text adevărat), cu o memorie care se comprimă prin somn și care **descoperă singură atomi semantici** (alegeri ca „nume”, „obiect”, „oraș”) și **reguli** (ca „răspunsul este cel din fapt”).

Drumul, din specificație (secțiunea 19): blocul A (mecanismul, pe text generat) → B (vectorii HDC) → C (veghea pe text adevărat) → D (somnul pe text adevărat) → E (predicția) → F (sensul). Un bloc nu începe până nu trece cel dinainte.

## Unde suntem

Pașii 1–5 implementați, blocul A rulat. Trec: A2, A3, A4, A5. Pică: A1 (G2: nu apare categoria „obiect”), A6 (pe date dezechilibrate), A7 (deplasare).
Diagnostic: (1) măsura în termeni nu plătește categoriile semantice; (2) gruparea lacomă pe un nivel nu vede câștigul de pe nivelul de deasupra, deci depinde de echilibrul datelor.

Decizie luată: **biții hotărăsc ce se învață; termenii rămân limită (K termeni pe ecuație)**.

## Etape

| Etapă | Ce fac | Succes înseamnă |
| --- | --- | --- |
| 1. Testul care justifică biții | G2P: G2 cu perechi verb–obiect nevăzute deloc la învățare („writes the poem”, „reads the note”) | în biți, eroarea pe propozițiile cu perechi nevăzute este clar mai mică decât în termeni (obiectul corect primește probabilitate mai mare). Dacă nu, decizia se rediscută |
| 2. Mai multe interpretări | o unitate poate fi în mai multe tipare; somnul nu mai alege lacom una singură; predicția folosește toate tiparele care o cuprind | în biți, pe datele dezechilibrate: A5 ≥ 95%, A6 ≥ 90%, A1 trece (G1 și G2), G4 fără tipare, A3 trece; testele trec; determinism |
| 3. Blocul A din nou, în biți | rulare completă, rezultatele trecute în REZULTATE.md | A1–A6 trec; A7 rămâne singurul care pică |
| 4. Deplasarea (D4, pentru A7) | gruparea cu aliniere de la sfârșit și cu un copil sărit | A7 peste 90% cel puțin la 1 propoziție între fapt și întrebare; se notează până unde |
| 5. Stratul HDC (pasul 6, blocul B) | strategia bipolară, `hdc/check.mjs` (H1–H8), vectorii comp/enr/detect/deep, căutarea cu `nearest` | H1–H8 trec; blocul A rulat cu vectori dă aceleași rezultate ca strategia exactă (B5) |
| 6. Text adevărat (pasul 7, blocul C) | tokenizerul GPT-2, perechile ( [ { „, TinyStories | refacere 100%; C1–C3 măsurate |
| 7. Somn pe text adevărat (pasul 8, blocurile D–E) | tamponul, somnul ușor/adânc, apoi firele | E1: eroarea cu somn < fără somn, și < numărarea de succesiuni |

La fiecare etapă: commit, testele trec, rezultatele în `REZULTATE.md`, comenzile de reluare.
