/**
 * Retrieval smoke tests.
 *
 * Runs a fixed set of questions against the shipped corpus index and asserts
 * that the right kind of paper comes back. This is a guard against silent
 * regressions in the index build — a changed tokenizer, a dropped title boost,
 * or a bundle that shipped empty all show up here rather than in production.
 *
 *   node scripts/verify-retrieval.mjs
 *
 * Exits non-zero on failure, so it can gate a deploy.
 */

// The server bundle does not export its internals, so the retrieval module is
// compiled on the fly by the shim. Keeping this free of new dependencies is
// deliberate: the check must run anywhere the server runs.
const { search: doSearch, corpusStats: stats } = await import("./_retrieval-shim.mjs");

const CASES = [
  {
    q: "what is the EPDS cutoff score for probable depression",
    expectTerm: /edinburgh|epds|cut-?off/i,
    label: "EPDS cut-off",
  },
  {
    q: "can low social support increase postpartum depression risk",
    expectTerm: /postpartum depression|risk factor|social support/i,
    label: "social support as a risk factor",
  },
  {
    q: "does a caesarean section raise the risk of postnatal depression",
    expectTerm: /cesarean|caesarean|delivery|postpartum depression/i,
    label: "mode of delivery",
  },
  {
    q: "postpartum psychosis symptoms and onset",
    expectTerm: /psychosis|puerperal/i,
    label: "postpartum psychosis",
  },
  {
    q: "sleep deprivation and maternal mood after birth",
    expectTerm: /sleep|insomnia|mood|depress/i,
    label: "sleep and mood",
  },
  {
    q: "premenstrual dysphoric disorder treatment",
    expectTerm: /premenstrual|pmdd|pms/i,
    label: "PMDD",
  },
];

const info = stats();
if (!info.available) {
  console.error("FAIL: corpus index not available — build it with "
    + "research/corpus/export_backend_index.py");
  process.exit(1);
}
console.log(`corpus: ${info.papers} papers, ${info.passages} passages, ${info.terms} terms\n`);

let failures = 0;
for (const { q, expectTerm, label } of CASES) {
  const hits = doSearch(q, { k: 5 });
  const top = hits[0];
  const matched = hits.some((h) => expectTerm.test(h.title));

  if (!top) {
    console.error(`FAIL  ${label}: no results`);
    failures++;
    continue;
  }
  if (!matched) {
    console.error(`FAIL  ${label}: no relevant title in top 5`);
    hits.forEach((h) => console.error(`        - ${h.title.slice(0, 78)}`));
    failures++;
    continue;
  }
  // Every result must carry the citation metadata the prompt depends on.
  for (const h of hits) {
    if (!h.pmcid || !h.url || !h.text) {
      console.error(`FAIL  ${label}: incomplete citation metadata on ${h.pmcid || "?"}`);
      failures++;
      break;
    }
  }
  console.log(`ok    ${label}`);
  console.log(`        [${top.score}] ${top.title.slice(0, 78)}`);
}

// Nonsense must not be dressed up as evidence: below the score floor the
// retriever should return nothing rather than the least-bad passage.
const junk = doSearch("zzzz qqqq wwww vvvv", { k: 5 });
if (junk.length > 0) {
  console.error(`FAIL  gibberish query returned ${junk.length} results`);
  failures++;
} else {
  console.log("ok    gibberish query returns nothing");
}

console.log(failures === 0
  ? `\nall ${CASES.length + 1} checks passed`
  : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
