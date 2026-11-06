// The Clearbit X segment: a tree of rules that the homepage card's builder edits and the
// funnel scene draws. Shared by the page (DOM) and the lumen worker (canvas) so both agree
// on every number. Rates are invented, but plausible enough that the funnel behaves.
export const TOTAL = 48210;

// Share of visitors matching each value. 'sum' fields are exclusive buckets (a company has one
// size); 'union' fields overlap (someone can read both /docs and /pricing).
export const FIELDS = {
  visited: { label: 'Visited page', short: 'Visited', kind: 'multi', combine: 'union', ops: ['any of', 'none of'],
    values: { '/pricing': 0.22, '/signup': 0.12, '/docs': 0.3, '/blog': 0.35, '/careers': 0.08 } },
  employees: { label: 'Employees', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { '1–10': 0.3, '11–50': 0.28, '51–250': 0.22, '251–1K': 0.12, '1K+': 0.08 } },
  industry: { label: 'Industry', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { SaaS: 0.25, Fintech: 0.1, Retail: 0.12, Health: 0.1, Media: 0.08 } },
  country: { label: 'Country', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { US: 0.4, UK: 0.12, Canada: 0.06, Germany: 0.08, NZ: 0.03 } },
  tech: { label: 'Tech stack', short: 'Uses', kind: 'multi', combine: 'union', ops: ['uses any of', 'uses none of'],
    values: { Segment: 0.15, Stripe: 0.3, HubSpot: 0.25, Salesforce: 0.2 } },
  role: { label: 'Employment role', short: 'Role', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { Marketing: 0.18, Sales: 0.2, Engineering: 0.3, Leadership: 0.1 } },
  title: { label: 'Employment title', short: 'Title', kind: 'text', ops: ['contains', "doesn't contain"] },
  views: { label: 'Page views', short: 'Views', kind: 'single', ops: ['at least', 'fewer than'],
    values: { '1×': 0.9, '3×': 0.6, '10×': 0.3, '25×': 0.12 } },
};

export const defaultSegment = () => ({
  id: 'root', type: 'group', op: 'and', name: 'High-intent SaaS',
  children: [
    { id: 'd1', type: 'cond', field: 'visited', op: 0, values: ['/pricing', '/signup'] },
    { id: 'd2', type: 'cond', field: 'employees', op: 0, values: ['51–250', '251–1K', '1K+'] },
    { id: 'd3', type: 'group', op: 'or', children: [
      { id: 'd4', type: 'cond', field: 'industry', op: 0, values: ['SaaS'] },
      { id: 'd5', type: 'cond', field: 'tech', op: 0, values: ['Segment'] },
    ] },
    { id: 'd6', type: 'cond', field: 'country', op: 0, values: ['US', 'UK', 'NZ'] },
    { id: 'd7', type: 'cond', field: 'title', op: 0, text: 'growth' },
  ],
});

// Share of visitors a rule or group lets through. An empty rule matches everyone.
export function passOf(n) {
  if (n.type === 'group') {
    const ps = n.children.map(passOf);
    if (!ps.length) return 1;
    return n.op === 'or' ? 1 - ps.reduce((a, p) => a * (1 - p), 1) : ps.reduce((a, p) => a * p, 1);
  }
  const f = FIELDS[n.field];
  let p;
  if (f.kind === 'text') {
    const s = (n.text || '').trim();
    if (!s) return 1;
    p = Math.min(0.5, Math.max(0.04, 0.55 - s.length * 0.035)); // longer phrases match fewer titles
  } else if (f.kind === 'single') {
    p = f.values[n.value] ?? 1;
  } else {
    const vs = (n.values || []).filter((v) => v in f.values).map((v) => f.values[v]);
    if (!vs.length) return 1;
    p = f.combine === 'sum' ? Math.min(0.97, vs.reduce((a, b) => a + b, 0)) : 1 - vs.reduce((a, v) => a * (1 - v), 1);
  }
  return Math.max(0.01, n.op ? 1 - p : p); // op 1 is the negated form ("none of", "fewer than", …)
}

// The funnel's gates: each top-level rule of an AND segment, or the whole segment if it's an OR.
export const gatesOf = (root) => (root.op === 'or' ? (root.children.length ? [root] : []) : root.children);
export const countOf = (root) => Math.round(gatesOf(root).reduce((c, g) => c * passOf(g), TOTAL));

// Short text for a funnel chip: { field: 'Employees', value: '51–250 +2' }
export function summary(n) {
  if (n.type === 'group') {
    const k = n.children.length;
    return { field: n.op === 'or' ? 'Any of' : 'All of', value: `${k} rule${k === 1 ? '' : 's'}` };
  }
  const f = FIELDS[n.field], not = n.op ? 'not ' : '';
  let value;
  if (f.kind === 'text') value = n.text?.trim() ? `${not}“${n.text.trim()}”` : 'anything';
  else if (f.kind === 'single') value = `${n.op ? '<' : '≥'} ${n.value}`;
  else value = n.values.length ? not + n.values[0] + (n.values.length > 1 ? ` +${n.values.length - 1}` : '') : 'anything';
  return { field: f.short || f.label, value };
}

// Lines for the funnel's hover dropdown: [{ text, on }]
export function optionsOf(n) {
  if (n.type === 'group') return n.children.map((c) => { const s = summary(c); return { text: `${s.field} ${s.value}`, on: true }; });
  const f = FIELDS[n.field];
  if (f.kind === 'text') return [{ text: `${f.ops[n.op]} “${(n.text || '').trim()}”`, on: !!n.text?.trim() }];
  return Object.keys(f.values).map((v) => ({ text: v, on: f.kind === 'single' ? v === n.value : n.values.includes(v) }));
}

// Current segment, as last sent by the page. `version` lets the scene notice changes cheaply.
let state = defaultSegment(), version = 0;
state.version = version;
export const getSegment = () => state;
export function setSegment(s) { state = { ...s, version: ++version }; }
