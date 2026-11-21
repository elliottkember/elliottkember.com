// The Clearbit X segment: a tree of rules that the homepage card's builder edits and the
// funnel scene draws. Shared by the page (DOM) and the lumen worker (canvas) so both agree
// on every number. Rates are invented, but plausible enough that the funnel behaves.
export const TOTAL = 48210;

// Share of visitors matching each value. 'sum' fields are exclusive buckets (a company has one
// size); 'union' fields overlap (someone can read both /docs and /pricing).
export const FIELDS = {
  role: { group: 'Person', label: 'Employment Role', short: 'Role', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { Marketing: 0.18, Sales: 0.2, Engineering: 0.3, Leadership: 0.1 } },
  title: { group: 'Person', label: 'Employment Title', short: 'Title', kind: 'text', ops: ['contains', "doesn't contain"] },
  employees: { group: 'Company', label: 'Employees', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { '1–10': 0.3, '11–50': 0.28, '51–250': 0.22, '251–1K': 0.12, '1K+': 0.08 } },
  industry: { group: 'Company', label: 'Industry', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { SaaS: 0.25, Fintech: 0.1, Retail: 0.12, Health: 0.1, Media: 0.08 } },
  country: { group: 'Company', label: 'Country', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { US: 0.4, UK: 0.12, Canada: 0.06, Germany: 0.08, NZ: 0.03 } },
  tech: { group: 'Company', label: 'Tech stack', short: 'Uses', kind: 'multi', combine: 'union', ops: ['any of', 'none of'],
    values: { Segment: 0.15, Stripe: 0.3, HubSpot: 0.25, Salesforce: 0.2 } },
  visited: { group: 'Activity', label: 'Visited page', short: 'Visited', kind: 'multi', combine: 'union', ops: ['any of', 'none of'],
    values: { '/pricing': 0.22, '/signup': 0.12, '/docs': 0.3, '/blog': 0.35, '/careers': 0.08 } },
  // fields of a related record, only offered inside its "Has … where" block
  sfExists: { rel: 'salesforce', label: 'Account Exists', short: 'Exists', kind: 'flag', p: 0.9, ops: ['exists', "doesn't exist"] },
  sfSource: { rel: 'salesforce', label: 'Account Source', short: 'Source', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { Email: 0.2, Signup: 0.15, Inbound: 0.25, Outbound: 0.3, Partner: 0.1 } },
  sfStage: { rel: 'salesforce', label: 'Opportunity Stage', short: 'Stage', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { Prospect: 0.4, Demo: 0.2, Trial: 0.15, 'Closed won': 0.1 } },
  hsExists: { rel: 'hubspot', label: 'Contact Exists', short: 'Exists', kind: 'flag', p: 0.9, ops: ['exists', "doesn't exist"] },
  hsStage: { rel: 'hubspot', label: 'Lifecycle Stage', short: 'Stage', kind: 'multi', combine: 'sum', ops: ['is any of', 'is none of'],
    values: { Lead: 0.4, MQL: 0.25, SQL: 0.15, Customer: 0.1 } },
};

// "Has [record] where …" blocks: share is how many people have one at all.
export const RELATIONS = {
  salesforce: { label: 'Salesforce Account', short: 'Salesforce', share: 0.33 },
  hubspot: { label: 'HubSpot Contact', short: 'HubSpot', share: 0.5 },
};

// "All page views · clearbit.com · at least 10 times in the last Month" rows.
export const EVENTS = {
  views: { label: 'All page views', short: 'Page views', share: 1 },
  pricing: { label: 'Pricing page views', short: 'Pricing views', share: 0.35 },
  forms: { label: 'Form submissions', short: 'Form fills', share: 0.12 },
};
export const EVENT_OPS = ['at least', 'fewer than'];
export const WINDOWS = { Day: 0.2, Week: 0.5, Month: 1, Quarter: 2 };

export const fieldsFor = (rel = null) => Object.keys(FIELDS).filter((k) => (FIELDS[k].rel ?? null) === rel);

// Rebuilt from Clearbit's own Audiences screenshot.
export const defaultSegment = () => ({
  id: 'root', type: 'group', op: 'and', name: 'Marketers with buying intent',
  children: [
    { id: 'd1', type: 'cond', field: 'role', op: 0, values: ['Marketing'] },
    { id: 'd2', type: 'group', op: 'or', children: [
      { id: 'd3', type: 'cond', field: 'title', op: 0, text: 'performance' },
      { id: 'd4', type: 'cond', field: 'title', op: 0, text: 'demand' },
      { id: 'd5', type: 'cond', field: 'title', op: 0, text: 'digital' },
    ] },
    { id: 'd6', type: 'has', rel: 'salesforce', neg: 0, op: 'and', children: [
      { id: 'd7', type: 'cond', field: 'sfExists', op: 0 },
      { id: 'd8', type: 'cond', field: 'sfSource', op: 0, values: ['Email', 'Signup', 'Inbound'] },
    ] },
    { id: 'd9', type: 'event', event: 'views', domain: 'clearbit.com', op: 0, min: 10, window: 'Month' },
  ],
});

// Share of visitors a rule or group lets through. An empty rule matches everyone.
export function passOf(n) {
  if (n.type === 'group' || n.type === 'has') {
    const ps = n.children.map(passOf);
    let p = !ps.length ? 1 : n.op === 'or' ? 1 - ps.reduce((a, q) => a * (1 - q), 1) : ps.reduce((a, q) => a * q, 1);
    if (n.type === 'group') return p;
    p *= RELATIONS[n.rel].share;
    return Math.max(0.01, n.neg ? 1 - p : p);
  }
  let p;
  if (n.type === 'event') {
    // more visits, or a shorter window, and fewer people qualify
    const e = EVENTS[n.event], m = Math.max(1, n.min || 1);
    p = e.share * Math.min(0.97, Math.exp(-(m - 1) / (8 * (WINDOWS[n.window] ?? 1))));
    return Math.max(0.01, n.op ? 1 - p : p);
  }
  const f = FIELDS[n.field];
  if (f.kind === 'flag') p = f.p;
  else if (f.kind === 'text') {
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
  if (n.type === 'has') return { field: n.neg ? 'Has no' : 'Has', value: RELATIONS[n.rel].short };
  if (n.type === 'event') return { field: EVENTS[n.event].short, value: `${n.op ? '<' : '≥'} ${n.min}× / ${n.window.toLowerCase()}` };
  const f = FIELDS[n.field], not = n.op ? 'not ' : '';
  let value;
  if (f.kind === 'flag') value = f.ops[n.op];
  else if (f.kind === 'text') value = n.text?.trim() ? `${not}“${n.text.trim()}”` : 'anything';
  else if (f.kind === 'single') value = `${n.op ? '<' : '≥'} ${n.value}`;
  else value = n.values.length ? not + n.values[0] + (n.values.length > 1 ? ` +${n.values.length - 1}` : '') : 'anything';
  return { field: f.short || f.label, value };
}

// Lines for the funnel's hover dropdown: [{ text, on }]
export function optionsOf(n) {
  if (n.type === 'group' || n.type === 'has') return n.children.map((c) => { const s = summary(c); return { text: `${s.field} ${s.value}`, on: true }; });
  if (n.type === 'event') return [
    { text: n.domain?.trim() || 'any site', on: true },
    { text: `${EVENT_OPS[n.op]} ${n.min} times`, on: true },
    { text: `in the last ${n.window.toLowerCase()}`, on: true },
  ];
  const f = FIELDS[n.field];
  if (f.kind === 'flag') return f.ops.map((o, i) => ({ text: o, on: i === n.op }));
  if (f.kind === 'text') return [{ text: `${f.ops[n.op]} “${(n.text || '').trim()}”`, on: !!n.text?.trim() }];
  return Object.keys(f.values).map((v) => ({ text: v, on: f.kind === 'single' ? v === n.value : n.values.includes(v) }));
}

// Current segment, as last sent by the page. `version` lets the scene notice changes cheaply.
let state = defaultSegment(), version = 0;
state.version = version;
export const getSegment = () => state;
export function setSegment(s) { state = { ...s, version: ++version }; }
