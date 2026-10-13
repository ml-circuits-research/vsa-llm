// PUBLIC development goals, not a blind benchmark. Gold never enters training.
export const VERSION = 'nl-formalization-v1';

export const training = ['Ada', 'Boris', 'Cyra', 'Dan'].flatMap((name, i) => {
  const object = ['proposal', 'report', 'contract', 'draft'][i];
  return [
    `${name} approved the ${object}.`, `The ${object} was approved by ${name}.`,
    `${name} rejected the ${object}.`, `${name} did not approve the ${object}.`,
    `${name} believes that the ${object} is valid.`,
    `${name} does not believe that the ${object} is valid.`,
    `${name} believes that the ${object} is not valid.`,
    `${name} sent the ${object} to ${['Boris', 'Cyra', 'Dan', 'Ada'][i]}.`,
  ];
}).concat([
  'A service retries a request when the connection fails. A successful request does not need a retry.',
  'Heating expands the sample. Cooling contracts it. Expansion depends on the material.',
  'The committee discussed an amendment, but adopted the original wording.',
  'A licence permits redistribution under conditions. Permission does not imply an obligation.',
  'Every reviewer read a report. A reviewer read every report.',
  'The technician saw the researcher with a camera.',
  'Mara gave Leo a key. He returned it to her.',
  'A missing measurement is not evidence that the measured quantity is zero.',
  'Ana a trimis raportul către Mihai. Mihai a primit raportul de la Ana.',
]);

// Each pair is an independent assertion. A null/partial parse never passes a distinction.
export const pairs = [
  { id: 'arguments-without-qa', category: 'roles', same: false,
    a: 'Ada approved the proposal.', b: 'Boris approved the report.' },
  { id: 'active-passive-heldout', category: 'paraphrase', same: true,
    a: 'Ada approved the report.', b: 'The report was approved by Ada.' },
  { id: 'new-entity-active-passive', category: 'open-vocabulary', same: true,
    a: 'Zeyna approved the report.', b: 'The report was approved by Zeyna.' },
  { id: 'new-entities-remain-distinct', category: 'open-vocabulary', same: false,
    a: 'Zeyna approved the report.', b: 'Ximena approved the report.' },
  { id: 'argument-swap', category: 'roles', same: false,
    a: 'Ada sent the report to Boris.', b: 'Boris sent the report to Ada.' },
  { id: 'negation', category: 'polarity', same: false,
    a: 'Ada approved the report.', b: 'Ada did not approve the report.' },
  { id: 'opposite-relation', category: 'relation', same: false,
    a: 'Ada approved the report.', b: 'Ada rejected the report.' },
  { id: 'negation-scope', category: 'scope', same: false,
    a: 'Ada does not believe that the report is valid.', b: 'Ada believes that the report is not valid.' },
  { id: 'quantifier-scope', category: 'scope', same: false,
    a: 'Every reviewer read a report.', b: 'A reviewer read every report.' },
  { id: 'modality', category: 'modality', same: false,
    a: 'A licence permits redistribution.', b: 'A licence requires redistribution.' },
  { id: 'condition-direction', category: 'composition', same: false,
    a: 'If the connection fails, the service retries the request.',
    b: 'If the service retries the request, the connection fails.' },
  { id: 'scientific-paraphrase', category: 'science', same: true,
    a: 'The sample expanded because it was heated.', b: 'Heating the sample caused it to expand.' },
  { id: 'software-paraphrase', category: 'software', same: true,
    a: 'The service retries the request after a connection failure.',
    b: 'After the connection fails, the request is retried by the service.' },
  { id: 'romanian-paraphrase', category: 'multilingual', same: true,
    a: 'Ana a trimis raportul către Mihai.', b: 'Raportul a fost trimis de Ana către Mihai.' },
  { id: 'independent-fact-order', category: 'composition', same: true,
    a: 'Ada approved the report. Boris rejected the draft.',
    b: 'Boris rejected the draft. Ada approved the report.' },
  { id: 'coreference', category: 'coreference', same: true,
    a: 'Mara gave Leo a key. He returned it to her.',
    b: 'Mara gave Leo a key. Leo returned the key to Mara.' },
];

// Several attachment ambiguities, not one sentence to special-case.
export const ambiguities = [
  'Ada saw Boris with a telescope.',
  'The technician photographed the researcher with a camera.',
  'Mara watched Leo with binoculars.',
];

// Graph-only queries: evaluator formalizes both premises and questions; the reasoner
// receives no text, gold answer, or metadata. Two opposing cases defeat a constant answer.
export const reasoning = [
  { id: 'latest-event', category: 'temporal', premises: [
    'Ada approved the report.', 'Ada later rejected the report.'
  ], query: 'Does Ada currently approve the report?', answer: false },
  { id: 'latest-event-reversed', category: 'temporal', premises: [
    'Ada rejected the report.', 'Ada later approved the report.'
  ], query: 'Does Ada currently approve the report?', answer: true },
  { id: 'modus-ponens-software', category: 'reasoning', premises: [
    'If the connection fails, the service retries the request.', 'The connection fails.'
  ], query: 'Does the service retry the request?', answer: true },
  { id: 'no-converse-software', category: 'reasoning', premises: [
    'If the connection fails, the service retries the request.', 'The service retries the request.'
  ], query: 'Does the connection fail?', answer: 'unknown' },
  { id: 'negation-is-not-absence', category: 'reasoning', premises: [
    'The sample is not conductive.'
  ], query: 'Is the sample conductive?', answer: false },
  { id: 'absence-is-not-negation', category: 'reasoning', premises: [
    'The sample is warm.'
  ], query: 'Is the sample conductive?', answer: 'unknown' },
];

export const exactTexts = [
  'Ada  approved\tthe report.  ',
  '\nAna a trimis raportul.\n\nMihai l-a primit.\n',
  '“The café is open,” she said.\r\n  Really? ☕',
];

// Original prose across genres; not generated from the model's pattern grammar.
// These are public development examples, not a claim of real-world coverage.
export const prose = [
  { id: 'scientific-discussion', text: 'The investigators expected the alloy to expand when heated. Instead, the first sample contracted slightly, although the control sample expanded. They suspected that the coating, rather than the alloy itself, caused the discrepancy. The second measurement did not confirm that explanation. A failed confirmation does not establish that the coating had no effect.' },
  { id: 'legal-conditions', text: 'The licence permits a recipient to redistribute the software provided that the copyright notice is retained. It does not require redistribution. A recipient who changes the software must identify the changes before distributing a modified copy. The obligation concerns a distributed copy; merely making a private modification does not trigger it.' },
  { id: 'reported-belief-dialogue', text: 'Mara said that Leo believed the document had been approved. "I only said it could be approved," Leo replied. Ada had signed the draft, but the committee had not voted on it. Nobody could infer approval from the signature alone. Later, the committee rejected the proposal and asked Mara to notify Leo.' },
  { id: 'technical-failure-analysis', text: 'A client may repeat a request after a timeout even if the server has already processed it. If the operation is not idempotent, the repetition can produce a second charge. Recording a request identifier prevents that outcome only when the check and the update are atomic. A timeout therefore does not by itself prove that the first operation failed.' },
];

export function evaluationTexts() {
  return [...new Set([
    ...pairs.flatMap((c) => [c.a, c.b]), ...ambiguities, ...exactTexts,
    ...prose.map((c) => c.text), ...reasoning.flatMap((c) => [...c.premises, c.query]),
    'Ada approved the proposal.', 'Ada believes that the report is not valid.',
  ])];
}
