// PUEBI/EYD rules engine — layer 1 of the Bahasa cascade. Fully offline.
// Every finding cites its rule id. No grades, no scores, no auto-apply.

let RULES = null;

export async function loadRules() {
  if (RULES) return RULES;
  try {
    const res = await fetch('data/puebi_eyd_rules.json');
    if (!res.ok) throw new Error(res.statusText);
    RULES = await res.json();
  } catch {
    RULES = { rules: [], kataBaku: [] }; // degrade honestly; panel shows why
  }
  return RULES;
}

// Categories silenced in verse mode: capitalization and punctuation.
const VERSE_MUTED = new Set(['K', 'P']);

export function check(text, { mode = 'prose', disabledRules = [], ignored = [] } = {}) {
  if (!RULES || !text) return [];
  const off = new Set(disabledRules);
  const ignoredKey = new Set(ignored.map(i => `${i.ruleId} ${i.text}`));
  const findings = [];

  const push = (f) => {
    if (ignoredKey.has(`${f.ruleId} ${f.text}`)) return;
    findings.push(f);
  };

  // 1. kata baku lexicon — deterministic, apply-able
  for (const pair of RULES.kataBaku || []) {
    if (!pair.salah || pair.salah.includes(':') || pair.salah === pair.baku) continue;
    const re = new RegExp(`(?<![\\w-])${escapeRe(pair.salah)}(?![\\w-])`, 'gi');
    for (const m of text.matchAll(re)) {
      push({ ruleId: 'baku', title: 'Kata baku', severity: 'error',
             statement: `Bentuk baku dari “${pair.salah}” adalah “${pair.baku}”.`,
             text: m[0], start: m.index, end: m.index + m[0].length,
             replacement: matchCase(pair.baku, m[0]) });
    }
  }

  // 2. regex rules
  for (const rule of RULES.rules || []) {
    if (off.has(rule.id)) continue;
    if (mode === 'poetry' && VERSE_MUTED.has(rule.category)) continue;
    if (rule.check?.type !== 'regex' || !rule.check.pattern) continue;
    if (rule.check.scope) continue; // title/heading scoped rules need structure we don't have yet
    let re;
    try { re = new RegExp(rule.check.pattern, 'gm'); } catch { continue; }
    let guard = 0;
    for (const m of text.matchAll(re)) {
      if (++guard > 200) break;
      const repl = buildReplacement(rule.check.suggest, m) ?? FIXERS[rule.id]?.(m) ?? null;
      push({ ruleId: rule.id, title: rule.title, severity: rule.severity || 'info',
             statement: rule.statement, text: m[0].trim() || m[0], raw: m[0],
             start: m.index, end: m.index + m[0].length,
             suggest: rule.check.suggest || '', replacement: repl });
    }
  }

  // 3. W11 peluluhan pairs live in a lexicon list of "salah:benar"
  const w11 = (RULES.rules || []).find(r => r.id === 'W11');
  if (w11 && !off.has('W11')) {
    for (const entry of w11.check?.list || []) {
      const [salah, benar] = entry.split(':');
      if (!salah || !benar || salah === benar) continue;
      const re = new RegExp(`\\b${escapeRe(salah)}\\b`, 'gi');
      for (const m of text.matchAll(re)) {
        push({ ruleId: 'W11', title: w11.title, severity: w11.severity,
               statement: w11.statement, text: m[0],
               start: m.index, end: m.index + m[0].length,
               replacement: matchCase(benar, m[0]) });
      }
    }
  }

  findings.sort((a, b) => a.start - b.start);
  return findings;
}

// Deterministic repairs for rules whose suggest text is only a human instruction.
// Each takes the regex match and returns the corrected text for the matched span.
const FIXERS = {
  // "hujan turun. kami" -> ". K": capitalize the letter, keep what precedes it
  K01: (m) => m[1] + m[2].toUpperCase(),
  // "rahmat-nya" (about God) -> "-Nya"
  K10: (m) => '-' + m[1].charAt(0).toUpperCase() + m[1].slice(1),
  // "buku, majalah dan koran" -> insert the serial comma before "dan"
  P02: (m) => m[0].replace(/\s+dan\s+/, ', dan '),
  // "Namun aku" at sentence start -> "Namun, aku"
  P03: (m) => m[1] + m[2] + ', ',
  // whichever alternative matched: strip space before punctuation, or add one after
  P08: (m) => {
    const t = m[0];
    if (/^\s+[,.;:!?]$/.test(t)) return t.trim();
    if (/^[,;:]\S$/.test(t)) return t[0] + ' ' + t[1];
    if (/^\.[A-Za-z]$/.test(t)) return '. ' + t[1];
    return null;
  },
  // "Duduk lah" -> join the particle back
  W04: (m) => m[1],
  // "buku mu" -> join the pronoun back
  W06: (m) => m[1],
  // "abad ke 20" -> "ke-20"
  A04: (m) => m[0].replace(/\s+/, '-'),
  // ellipsis: excess dots -> "...", or a word glued to "..." gets a space: "mungkin..." -> "mungkin ..."
  P07: (m) => {
    const t = m[0];
    if (/^\.{5,}$/.test(t)) return '...';
    if (/^\w\.{3}$/.test(t)) return t[0] + ' ...';
    return null;
  },
  // straight quote -> typographic; opening vs closing decided by the preceding character
  P10: (m) => {
    const ch = m[0];
    const prev = (m.index > 0 ? m.input[m.index - 1] : ' ');
    const opening = m.index === 0 || /[\s(\[{«—–-]/.test(prev);
    if (ch === '"') return opening ? '“' : '”';
    return opening ? '‘' : '’';
  },
};

// A suggest like "pisahkan: $1 $2" or "serangkaikan: di$1" carries its template
// after the colon; a bare "$1." or plain-token suggest ("Anda") is the template itself.
function buildReplacement(suggest, m) {
  if (!suggest) return null;
  let tpl = suggest.includes(':') ? suggest.split(':').slice(1).join(':').trim() : suggest;
  if (tpl.includes('$')) {
    let ok = true;
    const out = tpl.replace(/\$(\d)/g, (_, i) => {
      if (m[+i] === undefined) { ok = false; return ''; }
      return m[+i];
    });
    return ok ? out : null;
  }
  // plain single-token replacement (e.g. K09 → "Anda") only when it maps 1:1 on a word
  if (!suggest.includes(' ') && /^[\wÀ-ÿ.-]+$/.test(tpl) && /^[\wÀ-ÿ'-]+$/.test(m[0].trim())) return tpl;
  return null;
}

function matchCase(word, sample) {
  if (/^[A-Z]/.test(sample)) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
