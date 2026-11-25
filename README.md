# Time Atlas

Create a visual timeline of people, periods, and events. Use the sample timeline or start a new one.

- Add an item by hand or search English Wikipedia. Time Atlas uses structured Wikidata claims to suggest years when available. Review the dates before saving.
- Add, rename, recolor, reorder, compact, or collapse rows. Drag items between rows on desktop, or use the row picker when editing an item.
- Zoom and scroll the shared axis to compare dates. Enter negative years for BCE.
- The current timeline autosaves in the current browser. Starting a new timeline replaces it. Timelines are not synced between devices.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Run `npm run build` to type-check and export the production site to `out/`.

## Deploy to Netlify

Import this GitHub repository as a new Netlify project. The included `netlify.toml` sets the build command and publish directory. After the first deploy, add `atlas.dwnld.in` in Netlify’s domain settings and follow its DNS instructions. For externally managed DNS, use the CNAME target shown by Netlify.

The app uses a static Next.js export. It has no database, API routes, AI service, or required secret keys. Lookup requests go from the visitor’s browser to Wikimedia. If a lookup fails or its data is incomplete, the same entry form works manually.
