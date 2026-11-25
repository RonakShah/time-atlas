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

function claimYear(claims: Claim[] = []) {
  const preferred = claims.filter(claim => claim.rank === "preferred");
  const best = preferred.length ? preferred : claims.filter(claim => claim.rank === "normal");
  const years = best.map(claim => {
    const value = claim.mainsnak.datavalue?.value;
    const year = value?.time?.match(/^[+-]\d+/)?.[0];
    return year && Number(year) && (value?.precision ?? 0) >= 9 ? String(Number(year)) : undefined;
  });
  return years.length && years.every(year => year === years[0]) ? years[0] : undefined;
}

export async function lookupDates(title: string, signal: AbortSignal) {
  const data = await api<{ entities?: Record<string, { claims?: Record<string, Claim[]> }> }>(
    "www.wikidata.org", { action: "wbgetentities", sites: "enwiki", titles: title, props: "claims" }, signal,
  );
  const claims = Object.values(data.entities ?? {})[0]?.claims ?? {};
  const birth = claimYear(claims.P569);
  const death = claimYear(claims.P570);
  const start = claimYear(claims.P580) ?? claimYear(claims.P571);
  const end = claimYear(claims.P582) ?? claimYear(claims.P576);
  const point = claimYear(claims.P585);
  const kind: Kind | undefined = birth || death ? "Person" : start && end ? "Period" : point ? "Event" : undefined;

  if (kind === "Person") return { kind, start: birth, end: death };
  if (kind === "Period") return { kind, start, end };
  if (kind === "Event") return { kind, start: point };
  return { kind, start, end };
}
