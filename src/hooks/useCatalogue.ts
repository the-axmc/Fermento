import { useEffect, useMemo, useState } from "react";
import { batches as seeded, type BatchInfo } from "../data/batches";

/**
 * Every batch the app can show: the seeded catalogue plus batches listed
 * through the producer API. Falls back to the seeds when the API is down.
 */
export const useCatalogue = (): BatchInfo[] => {
  const [listed, setListed] = useState<BatchInfo[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/batches")
      .then((r) => (r.ok ? (r.json() as Promise<BatchInfo[]>) : []))
      .then((rows) => {
        if (active) setListed(rows);
      })
      .catch(() => {
        /* producer API not running: seeds only */
      });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const ids = new Set(listed.map((b) => b.batchId));
    return [...listed, ...seeded.filter((b) => !ids.has(b.batchId))];
  }, [listed]);
};
