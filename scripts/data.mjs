// Everything the profile says, in one place. `node scripts/build.mjs` turns it into SVGs.

export const PERSON = {
  name: "LISANEGEBRIEL",
  surname: "Abay",
  handle: "lisan-5",
  role: "CTO at Spirit Hero",
  tagline: "Software engineer across AI, backend and full-stack.",
  coords: "9.0300° N · 38.7400° E · 2,355 m",
  home: "Addis Ababa",
};

export const PROJECTS = [
  {
    name: "Vigil",
    grid: "A1",
    glyph: "spike",
    line: "A calm real-time observability console: logs, metrics, traces and alerts — with a landing page that replays a night shift on scroll.",
    stack: "React 19 · TanStack Start · Motion · Canvas",
    href: "https://vigilog.vercel.app",
    label: "vigilog.vercel.app",
  },
  {
    name: "Askbase",
    grid: "A2",
    glyph: "receipt",
    line: "Ask your business data anything. Plain English to SQL with Claude, executed by DuckDB inside the browser — rows never leave the tab.",
    stack: "DuckDB-WASM · Claude API · TypeScript",
    href: "https://askbaze.vercel.app",
    label: "askbaze.vercel.app",
  },
  {
    name: "Atlas",
    grid: "B1",
    glyph: "contours",
    line: "My portfolio as a living topographic map: a WebGL contour field, a career drawn as a GPS route and a globe that flies out of Addis.",
    stack: "WebGL · TanStack Start · Framer Motion",
    href: "https://www.ligator.tech",
    label: "ligator.tech",
  },
  {
    name: "GridSense",
    grid: "B2",
    glyph: "grid",
    line: "Electricity outage patterns in Addis Ababa from anonymous community reports — a two-stage ML system for outage risk and impact.",
    stack: "Python · two-stage ML · Pandas",
    href: "https://github.com/lisan-5/GridSense",
    label: "github.com/lisan-5/GridSense",
  },
  {
    name: "Herald",
    grid: "C1",
    glyph: "signal",
    line: "Stripe-quality webhooks for any app: signed, retried with backoff, observable and replayable.",
    stack: "TypeScript · PostgreSQL · Redis",
    href: "https://github.com/lisan-5/Herald",
    label: "github.com/lisan-5/Herald",
  },
  {
    name: "Strata",
    grid: "C2",
    glyph: "strata",
    line: "Dig into any repository: a client-side visualiser that turns a repo's whole commit history into readable layers and eras.",
    stack: "React · D3 · Canvas",
    href: "https://github.com/lisan-5/Strata",
    label: "github.com/lisan-5/Strata",
  },
];

// oldest first — drawn left to right
export const ROUTE = [
  { at: "2022", name: "AAU · A2SV", role: "CS degree · 1,000+ problems", kind: "depart" },
  { at: "2022", name: "Ambalay Maps", role: "Back-end developer" },
  { at: "2024", name: "Brana", role: "Full-stack developer" },
  { at: "2025", name: "Haddis Art", role: "Full-stack developer" },
  { at: "2025", name: "Spotter AI", role: "AI & full-stack engineer" },
  { at: "2026", name: "Theseus Group", role: "Software engineer" },
  { at: "2026", name: "Vivid Insights", role: "AI & full-stack engineer" },
  { at: "2026", name: "Spirit Hero", role: "Software developer → CTO", kind: "now" },
];

export const LEGEND = [
  {
    symbol: "pillar",
    title: "Backend & core",
    items: ["Python", "TypeScript", "Node.js", "FastAPI", "Laravel", "PostgreSQL", "REST & system design"],
  },
  {
    symbol: "summit",
    title: "AI & ML",
    items: ["LLM integration", "RAG & agents", "Prompt engineering", "scikit-learn", "Pandas · NumPy", "Model evaluation"],
  },
  {
    symbol: "station",
    title: "Frontend",
    items: ["React 19", "Next.js", "TanStack Start", "Tailwind CSS", "WebGL & Canvas", "Motion"],
  },
  {
    symbol: "bedrock",
    title: "Foundations & ops",
    items: ["Algorithms (A2SV)", "Docker", "CI/CD", "Linux", "Git", "Cloud deploys"],
  },
];

export const THEMES = {
  dark: {
    bg: "#0a1311",
    panel: "#0f1b18",
    ink: "#e4ece3",
    muted: "#8a9e94",
    contour: "#1d3830",
    index: "#355e50",
    accent: "#c8f53a",
    water: "#5fa8c4",
    line: "rgba(228,236,227,0.14)",
  },
  light: {
    bg: "#efe8d6",
    panel: "#f5efe0",
    ink: "#23302a",
    muted: "#6b6553",
    contour: "#dccaa5",
    index: "#b9976a",
    accent: "#d9480f",
    water: "#2f7499",
    line: "rgba(35,48,42,0.16)",
  },
};
