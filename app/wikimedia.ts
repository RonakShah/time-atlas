import type { Kind } from "./model";

export type Suggestion = { title: string; url: string };

async function api<T>(site: string, params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ ...params, origin: "*", format: "json" });
  const response = await fetch(`https://${site}/w/api.php?${query}`, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("Wikimedia request failed");
  const data = await response.json();
  if (data.error) throw new Error("Wikimedia returned an error");
  return data;
}

export async function searchWikipedia(name: string, signal: AbortSignal): Promise<Suggestion[]> {
  const [, titles, , urls] = await api<[string, string[], string[], string[]]>(
    "en.wikipedia.org", { action: "opensearch", search: name, namespace: "0", limit: "6" }, signal,
  );
  return titles.map((title, index) => ({ title, url: urls[index] }));
}

type Claim = {
  rank: string;
  mainsnak: { datavalue?: { value: { time?: string; precision?: number } } };
};

function readYear(claim: Claim) {
  const value = claim.mainsnak.datavalue?.value;
  const year = value?.time?.match(/^[+-]\d+/)?.[0];
  return year && Number(year) && (value?.precision ?? 0) >= 9 ? String(Number(year)) : undefined;
}

function claimDate(claims: Claim[] = []) {
  const preferred = claims.filter(claim => claim.rank === "preferred");
  const normal = claims.filter(claim => claim.rank === "normal");
  const best = (preferred.length ? preferred : normal).map(readYear);
  const year = best.every(value => value === best[0]) ? best[0] : undefined;
  const hasAlternatives = new Set([...preferred, ...normal].map(readYear).filter(Boolean)).size > 1;
  return { year, hasAlternatives };
}

type WikipediaPage = {
  fullurl?: string;
  pageprops?: { wikibase_item?: string };
};

export async function lookupDates(title: string, signal: AbortSignal): Promise<{
  source?: string;
  kind?: Kind;
  start?: string;
  end?: string;
  hasAlternatives?: boolean;
}> {
  const article = await api<{ query?: { pages?: WikipediaPage[] } }>(
    "en.wikipedia.org", {
      action: "query", titles: title, redirects: "1", prop: "pageprops|info",
      ppprop: "wikibase_item", inprop: "url", formatversion: "2",
    }, signal,
  );
  const page = article.query?.pages?.[0];
  const id = page?.pageprops?.wikibase_item;
  const source = page?.fullurl;
  if (!id) return { source };

  const data = await api<{ entities?: Record<string, { claims?: Record<string, Claim[]> }> }>(
    "www.wikidata.org", { action: "wbgetentities", ids: id, props: "claims" }, signal,
  );
  const claims = data.entities?.[id]?.claims ?? {};
  const birth = claimDate(claims.P569);
  const death = claimDate(claims.P570);
  const rangeStart = claimDate(claims.P580);
  const rangeEnd = claimDate(claims.P582);
  const start = rangeStart.year || rangeStart.hasAlternatives ? rangeStart : claimDate(claims.P571);
  const end = rangeEnd.year || rangeEnd.hasAlternatives ? rangeEnd : claimDate(claims.P576);
  const point = claimDate(claims.P585);

  if (birth.year || death.year || birth.hasAlternatives || death.hasAlternatives) {
    return { source, kind: "Person", start: birth.year, end: death.year, hasAlternatives: birth.hasAlternatives || death.hasAlternatives };
  }
  if (start.year && end.year) return { source, kind: "Period", start: start.year, end: end.year, hasAlternatives: start.hasAlternatives || end.hasAlternatives };
  if (point.year) return { source, kind: "Event", start: point.year, hasAlternatives: point.hasAlternatives };
  return { source, start: start.year, end: end.year, hasAlternatives: start.hasAlternatives || end.hasAlternatives || point.hasAlternatives };
}
