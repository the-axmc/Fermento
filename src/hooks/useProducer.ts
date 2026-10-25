import { useCallback, useEffect, useState } from "react";
import type { Rating } from "condition_oracle_contract";
import { ORACLE_ID, getOracle } from "../contracts/client";
import { type Producer, findSeededProducer } from "../data/producers";
import type { Kind } from "../data/batches";
import { fetchAs } from "../lib/apiAuth";

export interface ProducerState {
  producer?: Producer;
  /** Rating the oracle holds for the producer's account, the on-chain proof of certification. */
  rating?: Rating;
  loading: boolean;
  /** True when the profile came from the seeds, not the API. */
  seeded: boolean;
  refresh: () => void;
}

const fetchProducer = async (key: string): Promise<Producer | undefined> => {
  try {
    const r = await fetch(`/api/producers/${encodeURIComponent(key)}`);
    if (!r.ok) return undefined;
    return (await r.json()) as Producer;
  } catch {
    return undefined;
  }
};

const fetchRating = async (address: string): Promise<Rating | undefined> => {
  if (!ORACLE_ID || !address) return undefined;
  try {
    return (await getOracle().rating({ producer: address })).result;
  } catch {
    return undefined;
  }
};

/**
 * A producer by slug or account address: the API profile, or the seeded one
 * when the API has none, plus the rating the oracle holds for the address.
 */
export const useProducer = (key: string | undefined): ProducerState => {
  const [state, setState] = useState<Omit<ProducerState, "refresh">>({
    loading: !!key,
    seeded: false,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!key) {
      setState({ loading: false, seeded: false });
      return;
    }
    let active = true;
    void (async () => {
      const live = await fetchProducer(key);
      const producer = live ?? findSeededProducer(key);
      const rating = producer ? await fetchRating(producer.address) : undefined;
      if (active) {
        setState({ producer, rating, loading: false, seeded: !live });
      }
    })();
    return () => {
      active = false;
    };
  }, [key, tick]);

  return { ...state, refresh };
};

export interface ProfilePatch {
  name?: string;
  location?: string;
  story?: string;
  kinds?: Kind[];
  website?: string;
}

/** Save the signed-in account's profile through the producer API. */
export const saveProfile = async (
  address: string,
  patch: ProfilePatch,
): Promise<Producer> => {
  const r = await fetchAs(
    address,
    `/api/producers/${encodeURIComponent(address)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const body = (await r.json()) as Producer & { error?: string };
  if (!r.ok) throw new Error(body.error ?? `Save failed (${r.status})`);
  return body;
};

export interface CertificationApplication {
  address: string;
  legalName: string;
  vatNumber: string;
  country: string;
  website: string;
  logo: string;
  document: string;
  documentName: string;
}

export const applyForCertification = async (
  application: CertificationApplication,
): Promise<Producer> => {
  const r = await fetchAs(application.address, "/api/certification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(application),
  });
  const body = (await r.json()) as Producer & { error?: string };
  if (!r.ok) throw new Error(body.error ?? `Application failed (${r.status})`);
  return body;
};
