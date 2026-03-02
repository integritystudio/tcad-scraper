// Example client wrapper around your API
import { SearchClient, ExploreOptions, exploreByAdaptivePrefixes } from './search_algorithm_example.js';

type RecordItem = { id: string; name: string; /* ... */ };

const client: SearchClient<RecordItem> = {
  async search(_query: string, _page: number, _pageSize: number) {
    // call your endpoint: /search?q=...&page=...&limit=...
    // return { items, total, truncated }
    throw new Error("implement");
  },
  getId(item: RecordItem) {
    return item.id;
  },
};

(async () => {
  const opts: ExploreOptions = {
    minQueryLen: 4,
    pageSize: 100,
    concurrency: 3,
    delayMs: 150,
    // Strongly recommended: provide seeds that your domain likely contains
    // so you don't attempt 36^4 combinations.
    seeds: ["aaaa", "bbbb", "cccc", "0000", "test", "data"],
  };

  for await (const item of exploreByAdaptivePrefixes(client, opts)) {
    // persist item
    console.log(item.id, item.name);
  }
})();
