// Memory Wiki plugin module implements memory palace behavior.
import type { ResolvedMemoryWikiConfig } from "./config.js";
import { parseWikiMarkdown, type WikiPageKind } from "./markdown.js";
import { readQueryableWikiPages } from "./query.js";

const PALACE_KIND_ORDER: WikiPageKind[] = ["synthesis", "entity", "concept", "source", "report"];
const PRIMARY_PALACE_KINDS = new Set<WikiPageKind>(["synthesis", "entity", "concept"]);
const PALACE_KIND_LABELS: Record<WikiPageKind, string> = {
  synthesis: "Syntheses",
  entity: "Entities",
  concept: "Concepts",
  source: "Sources",
  report: "Reports",
};

type MemoryWikiPalaceItem = {
  pagePath: string;
  title: string;
  kind: WikiPageKind;
  id?: string;
  updatedAt?: string;
  sourceType?: string;
  claimCount: number;
  questionCount: number;
  contradictionCount: number;
  claims: string[];
  questions: string[];
  contradictions: string[];
  snippet?: string;
};

type MemoryWikiPalaceCluster = {
  key: WikiPageKind;
  label: string;
  itemCount: number;
  claimCount: number;
  questionCount: number;
  contradictionCount: number;
  updatedAt?: string;
  items: MemoryWikiPalaceItem[];
};

type MemoryWikiPalacePageCounts = Record<WikiPageKind, number>;

type MemoryWikiPalaceStatus = {
  totalItems: number;
  totalPages: number;
  pageCounts: MemoryWikiPalacePageCounts;
  totalClaims: number;
  totalQuestions: number;
  totalContradictions: number;
  clusters: MemoryWikiPalaceCluster[];
};

function createEmptyPalacePageCounts(): MemoryWikiPalacePageCounts {
  return {
    synthesis: 0,
    entity: 0,
    concept: 0,
    source: 0,
    report: 0,
  };
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractSnippet(body: string): string | undefined {
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("#") ||
      line.startsWith("```") ||
      line.startsWith("<!--") ||
      line.startsWith("- ") ||
      line.startsWith("* ")
    ) {
      continue;
    }
    return line;
  }
  return undefined;
}

function comparePalaceItems(left: MemoryWikiPalaceItem, right: MemoryWikiPalaceItem): number {
  const leftKey = left.updatedAt ?? "";
  const rightKey = right.updatedAt ?? "";
  if (rightKey !== leftKey) {
    return rightKey.localeCompare(leftKey);
  }
  if (right.claimCount !== left.claimCount) {
    return right.claimCount - left.claimCount;
  }
  return left.title.localeCompare(right.title);
}

export async function listMemoryWikiPalace(
  config: ResolvedMemoryWikiConfig,
): Promise<MemoryWikiPalaceStatus> {
  const pages = await readQueryableWikiPages(config.vault.path);
  const pageCounts = createEmptyPalacePageCounts();
  let totalClaims = 0;
  let totalQuestions = 0;
  let totalContradictions = 0;
  const items: MemoryWikiPalaceItem[] = [];

  for (const page of pages) {
    pageCounts[page.kind] += 1;
    totalClaims += page.claims.length;
    totalQuestions += page.questions.length;
    totalContradictions += page.contradictions.length;

    const claimCount = page.claims.length;
    const questionCount = page.questions.length;
    const contradictionCount = page.contradictions.length;
    if (
      !PRIMARY_PALACE_KINDS.has(page.kind) &&
      claimCount === 0 &&
      questionCount === 0 &&
      contradictionCount === 0
    ) {
      continue;
    }

    const parsed = parseWikiMarkdown(page.raw);
    const updatedAt = normalizeTimestamp(page.updatedAt);
    const sourceType = typeof page.sourceType === `string` ? page.sourceType.trim() : "";
    const snippet = extractSnippet(parsed.body);
    items.push(
      Object.assign(
        { pagePath: page.relativePath, title: page.title, kind: page.kind },
        page.id ? { id: page.id } : {},
        updatedAt ? { updatedAt } : {},
        sourceType ? { sourceType } : {},
        {
          claimCount,
          questionCount,
          contradictionCount,
          claims: page.claims.map((claim) => claim.text).slice(0, 3),
          questions: page.questions.slice(0, 3),
          contradictions: page.contradictions.slice(0, 3),
        },
        snippet ? { snippet } : {},
      ) satisfies MemoryWikiPalaceItem,
    );
  }

  items.sort(comparePalaceItems);

  const itemsByKind = new Map<WikiPageKind, MemoryWikiPalaceItem[]>();
  for (const item of items) {
    const clusterItems = itemsByKind.get(item.kind);
    if (clusterItems) {
      clusterItems.push(item);
    } else {
      itemsByKind.set(item.kind, [item]);
    }
  }

  const clusters: MemoryWikiPalaceCluster[] = [];
  for (const kind of PALACE_KIND_ORDER) {
    const clusterItems = itemsByKind.get(kind);
    if (!clusterItems?.length) {
      continue;
    }
    let claimCount = 0;
    let questionCount = 0;
    let contradictionCount = 0;
    for (const item of clusterItems) {
      claimCount += item.claimCount;
      questionCount += item.questionCount;
      contradictionCount += item.contradictionCount;
    }
    clusters.push(
      Object.assign(
        {
          key: kind,
          label: PALACE_KIND_LABELS[kind],
          itemCount: clusterItems.length,
          claimCount,
          questionCount,
          contradictionCount,
        },
        clusterItems[0]?.updatedAt ? { updatedAt: clusterItems[0].updatedAt } : {},
        { items: clusterItems },
      ) satisfies MemoryWikiPalaceCluster,
    );
  }

  return {
    totalItems: items.length,
    totalPages: pages.length,
    pageCounts,
    totalClaims,
    totalQuestions,
    totalContradictions,
    clusters,
  };
}
