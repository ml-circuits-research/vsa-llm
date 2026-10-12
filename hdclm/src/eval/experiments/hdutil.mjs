// Ajutoare comune pentru B2–B4 (nu e experiment): compunere rapidă și căutare plată.
// Compunerea Horner dă același rezultat ca Σ ρ^k ν(c_k), dar cu n permutări, nu n²/2.
export function w(S) { return S.name === 'phasor' ? 2 : 1; }

// comp = normalize(Σ_k order(embed(c_k), k+1)), k = 1..n (Horner)
export function compose(S, children) {
  let acc = null;
  for (let k = children.length - 1; k >= 0; k--) {
    const e = S.embed(children[k]);
    acc = S.order(acc ? S.bundle([acc, e]) : e, 1);
  }
  return S.normalize(acc);
}

// matrice plată de M candidați normalizați (rând i = atomul i)
export function candMatrix(S, M, R) {
  const L = S.D * w(S), mat = new Float32Array(M * L);
  for (let i = 0; i < M; i++) mat.set(S.normalize(S.newAtom(R)), i * L);
  return mat;
}

// nearest(q, cands, 1) rapid: indexul cu produsul scalar maxim din primii M (rânduri unitare)
export function fastNearest(q, mat, M, L) {
  let best = -1, bs = -Infinity;
  for (let i = 0, o = 0; i < M; i++, o += L) {
    let s = 0;
    for (let j = 0; j < L; j++) s += q[j] * mat[o + j];
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}

// n indici distincți din [0, M)
export function distinct(R, M, n) {
  const seen = new Set();
  while (seen.size < n) seen.add(R.int(M));
  return [...seen];
}
