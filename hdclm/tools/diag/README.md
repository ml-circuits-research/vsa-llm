# Scripturi de diagnostic

Folosite în timpul analizei. Nu fac parte din model. Se rulează din `hdclm/`.

- `blinddiag.mjs [sămânța]`: QA pe antrenare, pe testul obișnuit și pe poveștile puse deoparte, plus regulile de nivel 3–4.
  - Variabile: `SET` (implicit `GBLIND`) și `OV` (suprascrieri JSON pentru configurare).
  - Exemplu: `OV='{"altSeqGroups":true}' node tools/diag/blinddiag.mjs 1`
- `l4diag.mjs`: grupurile candidate de nivel 4 și câștigul exact al fiecăruia (de ce nu apar reguli de poveste).
- `mergediag.mjs`: clasele, regulile care le folosesc și poveștile acoperite; arată contopirile false. Folosește GBLIND, sămânța 3.
- `havefail.mjs [sămânța]`: întrebările HDCLM greșite pe GPARA, regulile și clasele. Variabile: `ST=1` (tipurile locurilor) și `OV`.
