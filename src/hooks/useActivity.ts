import { useEffect, useState } from "react";
import { type Activity, onActivity, readActivity } from "../lib/activity";

/** Recent actions this app submitted for `address`, newest first. */
export const useActivity = (address: string | undefined): Activity[] => {
  const [rows, setRows] = useState<Activity[]>([]);

  useEffect(() => {
    if (!address) {
      setRows([]);
      return;
    }
    const load = () => setRows(readActivity(address));
    load();
    return onActivity(load);
  }, [address]);

  return rows;
};
