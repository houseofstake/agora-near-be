import { Request, Response } from "express";
import { getDelegatesIndex, DelegateDocument } from "../../lib/meilisearch/client";

interface SearchBody {
  q: string;
  sort?: string[];
  filter?: string;
  limit?: number;
  offset?: number;
  semanticRatio?: number;
}

export class DelegateSearchController {
  public search = async (
    req: Request<{}, {}, SearchBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { q, sort, filter, limit = 10, offset = 0, semanticRatio = 0.7 } = req.body;

      if (!q || typeof q !== "string" || q.trim().length === 0) {
        res.status(400).json({ error: "Query parameter 'q' is required" });
        return;
      }

      const clampedLimit = Math.min(Math.max(limit, 1), 100);

      const index = await getDelegatesIndex();

      const results = await index.search<DelegateDocument>(q.trim(), {
        sort,
        filter,
        limit: clampedLimit,
        offset,
        hybrid: {
          semanticRatio,
          embedder: "default",
        },
      });

      res.status(200).json({
        delegates: results.hits,
        total: results.estimatedTotalHits ?? results.hits.length,
        query: q.trim(),
      });
    } catch (error) {
      console.error("Error searching delegates:", error);
      res.status(500).json({ error: "Failed to search delegates" });
    }
  };
}
