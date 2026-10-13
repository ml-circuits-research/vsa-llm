# TDD pentru formalizarea generală a limbajului natural

Ținta este o reprezentare semantică explicită, compozițională, care poate fi folosită de un motor de raționament fără acces la textul inițial. Compresia, testele pe gramatici mici și predicția următorului token sunt mecanisme sau diagnostice; nu înlocuiesc această țintă.

## Comenzi și eșecuri vizibile

Din `hdclm/`:

```bash
npm test                                      # regresii, apoi obiective; intenționat roșu acum
npm run test:unit                             # numai regresiile mecanismelor și evaluatorului
npm run test:goals                            # cerințe de acceptare, fără skip/todo
npm run eval:goals -- --out runs/goals-v1       # semințe 1,2,3; raport JSON și exit 1 dacă lipsesc obiective
npm run eval:goals -- --seeds 1                # diagnostic rapid, fără fișiere
```

Un eșec de acceptare este datorie de implementare. Nu se inversează aserțiunea pentru a testa că modelul eșuează, nu se transformă în `todo`, nu se relaxează pragul și nu se șterge cazul pentru a obține verde. Testele evaluatorului, în suita de regresii, verifică separat că acesta nu acceptă rezultate vide, chei constante sau text brut ambalat ca graf.

## Ce cerem

`src/eval/goals/cases.mjs` conține corpusul de antrenare și cazurile publice de dezvoltare. Antrenarea primește numai șirurile din `training`, fără etichete, chei canonice, clase sau răspunsuri de aur.

Suita cere:

- canonizare a reformulărilor pe combinații nevăzute, inclusiv activ/pasiv;
- păstrarea identității argumentelor, rolurilor și entităților noi;
- separarea relațiilor opuse, negației, modalității și domeniului cuantificatorilor;
- compoziție, propoziții cuibărite, coreferință și ordine nerelevantă a faptelor independente;
- păstrarea mai multor interpretări pentru ambiguități;
- formalizare de proză științifică, juridică, narativă și tehnică, plus exemple în română;
- reconstrucția exactă a sursei, inclusiv spații și Unicode;
- export de graf semantic și raționament exclusiv peste grafuri;
- actualizări temporale, implicație fără inversarea ei, necunoscut distinct de fals;
- evaluare fără modificarea memoriei antrenate.

Distincțiile nu trec dacă una dintre formalizări este incompletă. Două rezultate `null` nu sunt o echivalență. Acoperirea are un numitor fix: toate intrările sunt probate, chiar dacă o aserțiune se oprește la prima premisă greșită. Raportul separă obiectivele neîndeplinite de erorile de execuție și raportează categorii, acoperire și numărul grafurilor exportate.

Unele cazuri sunt deliberat pe antrenare: păstrarea argumentelor și structurii trebuie să funcționeze și acolo. Raportul listează explicit intrările văzute. Testele de combinații nevăzute sunt verificate separat în `test/goals-harness.test.mjs`.

## Adaptorul actual și contractul pentru implementarea viitoare

`src/eval/goals/current.mjs` antrenează implementarea existentă cu profilul `algoritm`. La evaluare folosește recunoașterea din `Predictor` și `canon`, cu atomi temporari. Nu adaugă textul de test în memorie, nu introduce reguli lexicale și nu produce grafuri semantice fictive. Cheia actuală este un diagnostic al canonizării existente; o pereche care trece nu demonstrează singură corectitudinea semantică. Absența exportului de graf și a motorului de raționament rămâne eșec explicit.

Un adaptor viitor se poate evalua fără schimbarea cazurilor:

```bash
npm run eval:goals -- --adapter ./cale/adaptor.mjs --out runs/noul-model
```

Modulul exportă `createModel({ training, cfg })`, care returnează:

```javascript
{
  snapshot(),                  // stare serializabilă pentru verificarea contaminării
  formalize(text),             // poate fi asincron
  infer(premiseGraphs, queryGraph)
}
```

`formalize` returnează `{ complete, key, reconstructed, interpretations, graph }`. Cheile sunt stabile în cadrul aceleiași memorii și includ valorile semantice relevante; nu se impun nume precum PLACE sau APPROVE. `complete` înseamnă că întregul conținut semantic este reprezentat, nu doar că există un atom pentru text. O formalizare parțială poate fi utilă, dar nu trece o cerință de formalizare completă.

Graful minim are `nodes` și `edges`. Nodurile au `id` unic și `kind` din `entity`, `literal`, `relation`, `operator`, `variable`. Muchiile au `from`, `to`, `role`. Etichetele relațiilor și rolurilor sunt libere; inventarul nu este dictat de evaluator. Textul original și proveniența se păstrează separat de graf. Un obiect `{ text: ... }` nu este o reprezentare semantică. Interfața minimală nu dovedește corectitudinea grafului: de aceea există și cerințe de echivalență, distincție și consecințe.

`infer` primește numai copii independente ale grafurilor premiselor și întrebării. Nu primește textul, id-ul cazului, domeniul sau răspunsul așteptat. Pentru întrebările incluse acum răspunde `true`, `false` sau `'unknown'`. Cazurile opuse împiedică trecerea printr-un răspuns constant.

## Cum evităm optimizarea exclusivă pe acest set

Acesta este un **set public de dezvoltare**, nu un benchmark orb și nu o dovadă că NL general este rezolvat. Textele de proză sunt scrise pentru evaluare; nu reprezintă un corpus extern independent. Semințele schimbă configurarea modelului, nu transformă acest corpus fix în trei eșantioane independente.

Orice implementare trebuie evaluată pe întreaga suită, nu doar pe categoria pe care o repară. Comanda obișnuită `npm test` include obiectivele. Cazurile noi se adaugă în domenii și structuri diferite; nu se introduc cuvintele sau etichetele lor în mecanismul modelului. Schimbarea unui contract ori a unei așteptări cere justificare semantică, nu justificare prin rezultatul modelului.

O etapă următoare de validare va necesita corpusuri externe, surse și genuri ținute separat de dezvoltare, plus adnotări independente. Verde pe această suită este o condiție necesară de progres, nu suficientă pentru a declara generalitate. Aceste teste fixează acum ținta, fără să pretindă că validarea externă a fost deja realizată.
