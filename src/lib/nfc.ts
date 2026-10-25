/**
 * NFC cards on jars and casks.
 *
 * Web NFC (Chrome on Android) can write a URL record to a tag and read the
 * tag's serial number in the same tap. The registry stores sha256(serial),
 * never the serial itself, so a tap on any phone resolves to the batch while
 * the chain carries nothing a scanner could clone from. iPhones have no Web
 * NFC: there the producer writes the URL with any NFC app and types the
 * serial, which hashes the same way.
 */

import { Buffer } from "buffer";

interface NDEFRecordInit {
  recordType: string;
  data: string;
}
interface NDEFReadingEvent extends Event {
  serialNumber: string;
}
interface NDEFReaderLike {
  write(message: { records: NDEFRecordInit[] }): Promise<void>;
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(
    type: "reading",
    listener: (event: NDEFReadingEvent) => void,
  ): void;
}
type NDEFReaderCtor = new () => NDEFReaderLike;

export const nfcSupported = (): boolean =>
  typeof window !== "undefined" && "NDEFReader" in window;

const reader = (): NDEFReaderLike =>
  new (window as unknown as { NDEFReader: NDEFReaderCtor }).NDEFReader();

/**
 * Wait for a tap, write `url` to the tag and return its serial. Rejects when
 * the user cancels the browser prompt or no tag arrives within `timeoutMs`.
 */
export const writeTag = async (
  url: string,
  timeoutMs = 60_000,
): Promise<{ serial: string }> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = reader();
    const serial = new Promise<string>((resolve, reject) => {
      r.addEventListener("reading", (e) => resolve(e.serialNumber));
      ctrl.signal.addEventListener("abort", () =>
        reject(new Error("No card was tapped.")),
      );
    });
    await r.scan({ signal: ctrl.signal });
    // Writing resolves once a tag is in range; the reading event brings the serial.
    await r.write({ records: [{ recordType: "url", data: url }] });
    return { serial: await serial };
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
};

/** sha256 of a serial as the 32-byte value the registry stores. */
export const hashSerial = async (serial: string): Promise<Buffer> => {
  const bytes = new TextEncoder().encode(serial.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(new Uint8Array(digest));
};

/** Looks like an NFC serial: hex pairs, with or without separators. */
export const isSerial = (s: string): boolean =>
  /^([0-9a-f]{2}[:-]?){4,10}$/i.test(s.trim());
