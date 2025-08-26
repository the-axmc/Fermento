"use client";

import React from "react";
import { Layout } from "@stellar/design-system";
import { getContract } from "../contracts/client";
import { useWallet } from "../hooks/useWallet";
import { useAuth } from "../hooks/useAuth";
import AuthPanel from "../components/AuthPanel";

<AuthPanel />


/* ---------------------------------- Types --------------------------------- */

type FermentationState = "active" | "monitoring" | "ready";

interface LogEntry {
  id: string; // unique key for React
  date: string;
  state: string;
  notes: string;
}

interface FermentationProduct {
  id: string; // local UI id
  tokenId: number; // on-chain u32 id
  name: string;
  type: string;
  startDate: string;
  currentState: FermentationState;
  progress: number; // 0..100
  metadata: {
    ingredients: string;
    temperature: string;
    notes: string;
  };
  progressLog: LogEntry[];
  minted?: boolean; // UI hint
}

/* ------------------------------- Util helpers ------------------------------ */

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const errorToString = (e: unknown): string => {
  if (e instanceof Error && typeof e.message === "string") return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const getStringProp = (obj: Record<string, unknown>, key: string): string | undefined => {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
};

/** Extract a wallet public key / address from several possible shapes */
const extractPublicKey = (wallet: unknown): string | undefined => {
  if (!isRecord(wallet)) return undefined;
  const direct =
    getStringProp(wallet, "publicKey") ??
    getStringProp(wallet, "address") ??
    getStringProp(wallet, "accountId");
  if (direct) return direct;

  const account = isRecord(wallet["account"]) ? (wallet["account"] as Record<string, unknown>) : undefined;
  const accountPk = account ? getStringProp(account, "publicKey") : undefined;
  if (accountPk) return accountPk;

  const session = isRecord(wallet["session"]) ? (wallet["session"] as Record<string, unknown>) : undefined;
  const sessionPk = session ? getStringProp(session, "publicKey") : undefined;
  return sessionPk;
};

/** Build metadata JSON into a data: URI (swap to IPFS later) */
const makeMetadataURI = (p: FermentationProduct): string => {
  const payload = {
    name: p.name,
    category: p.type,
    progress: p.progress,
    state: p.currentState,
    startedAt: p.startDate,
    attributes: {
      ingredients: p.metadata.ingredients,
      temperature: p.metadata.temperature,
      notes: p.metadata.notes,
    },
    log: p.progressLog,
    updatedAt: new Date().toISOString(),
  };
  return `data:application/json,${encodeURIComponent(JSON.stringify(payload))}`;
};

/** Clamp to u32 for Soroban spec (0..2^32-1) */
const toU32 = (n: number): number => {
  const x = Math.floor(Number.isFinite(n) ? n : 0);
  return Math.min(0xffffffff, Math.max(0, x));
};
const newTokenId = (): number => toU32(Date.now() % 0x7fffffff);
const todayISO = () => new Date().toISOString().split("T")[0];

/* ---------------------------------- Seed ---------------------------------- */

const initialSeed: FermentationProduct[] = [
  {
    id: "1",
    tokenId: toU32(1001),
    name: "Sourdough Starter",
    type: "Bread",
    startDate: "2024-01-15",
    currentState: "active",
    progress: 65,
    metadata: { ingredients: "Flour, Water", temperature: "22°C", notes: "Daily feeding schedule" },
    progressLog: [
      { id: uid(), date: "2024-01-15", state: "Started", notes: "Initial mix" },
      { id: uid(), date: "2024-01-18", state: "First bubbles", notes: "Activity detected" },
    ],
    minted: false,
  },
  {
    id: "2",
    tokenId: toU32(1002),
    name: "Kimchi Batch #3",
    type: "Vegetable",
    startDate: "2024-01-20",
    currentState: "monitoring",
    progress: 85,
    metadata: { ingredients: "Cabbage, Gochugaru, Salt, Garlic", temperature: "18°C", notes: "Extra spicy batch" },
    progressLog: [
      { id: uid(), date: "2024-01-20", state: "Started", notes: "Salted and packed" },
      { id: uid(), date: "2024-01-23", state: "Active fermentation", notes: "Strong sour smell" },
    ],
    minted: false,
  },
];

/* --------------------------------- Component ------------------------------- */

const LS_KEY = "fermentation.products.v1";

const Home: React.FC = () => {
  const { user, token } = useAuth(); // <-- INSIDE component
  const wallet = useWallet();
  const walletPublicKey = extractPublicKey(wallet);
  const isConnected = typeof walletPublicKey === "string" && walletPublicKey.length > 0;

  const [products, setProducts] = React.useState<FermentationProduct[]>(initialSeed);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [mintOnAdd, setMintOnAdd] = React.useState(true);
  const [newProduct, setNewProduct] = React.useState({ name: "", type: "", ingredients: "", temperature: "", notes: "" });

  const contract = React.useMemo(() => getContract() as any, []);

  // Ensure minter role (quietly) after login
  React.useEffect(() => {
    const doGrant = async () => {
      if (!token || !user?.wallet) return;
      try {
        await fetch("/api/roles/grant-minter", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
      } catch (e) { console.warn("grant-minter failed (maybe already granted):", e); }
    };
    void doGrant();
  }, [token, user?.wallet]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FermentationProduct[];
        if (Array.isArray(parsed)) setProducts(parsed);
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(products)); } catch {}
  }, [products]);

  // verify on-chain ownership if contract exposes owner_of
  React.useEffect(() => {
    const verify = async () => {
      if (!isConnected) return;
      if (typeof contract.owner_of !== "function") return;

      const updated = await Promise.all(
        products.map(async (p: FermentationProduct) => {
          try {
            const ownerRes = await contract.owner_of({ token_id: p.tokenId }); // exact name from bindings
            let ownerStr: string | undefined;
            if (typeof ownerRes === "string") ownerStr = ownerRes;
            else if (isRecord(ownerRes)) {
              ownerStr = getStringProp(ownerRes, "address") ?? getStringProp(ownerRes, "accountId") ?? getStringProp(ownerRes, "publicKey");
            }
            const stillOwned = !!ownerStr && ownerStr === walletPublicKey;
            return { ...p, minted: stillOwned ? true : p.minted ?? false };
          } catch { return p; }
        }),
      );
      setProducts(updated);
    };
    void verify();
  }, [isConnected, walletPublicKey, contract, products]);


  /* ---------------------------- On-chain operations --------------------------- */

  const mintProduct = async (p: FermentationProduct) => {
    if (!isConnected || !walletPublicKey) { alert("Connect your wallet to mint the product NFT."); return; }
    const uri = makeMetadataURI(p);

    try {
      if (typeof contract.mint === "function") {
        await contract.mint({ to: walletPublicKey, token_id: p.tokenId, uri });
      } else if (typeof contract.mint_to === "function") {
        await contract.mint_to({ to: walletPublicKey, token_id: p.tokenId, uri });
      } else {
        alert("Contract does not expose mint/mint_to; cannot mint on-chain yet.");
        return;
      }
      setProducts(prev => prev.map(x => x.id === p.id ? ({ ...x, minted: true }) : x));
    } catch (err) {
      console.error(err);
      alert(`Mint failed: ${errorToString(err)}`);
    }
  };

  const updateOnChainMetadata = async (p: FermentationProduct) => {
    if (!isConnected) return;
    const uri = makeMetadataURI(p);
    try {
      if (typeof contract.set_metadata === "function") {
        await contract.set_metadata({ token_id: p.tokenId, uri });
      } else if (typeof contract.set_uri === "function") {
        await contract.set_uri({ token_id: p.tokenId, uri });
      }
    } catch (err) { console.warn("Metadata update failed:", err); }
  };
  
  const transformProduct = async (productId: string) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;
    if (!isConnected || !walletPublicKey) { alert("Connect your wallet to finalize on-chain."); return; }

    try {
      if (current.minted && typeof contract.burn === "function") {
        await contract.burn({ token_id: current.tokenId });
      }

      const p2: FermentationProduct = {
        ...current,
        tokenId: toU32(current.tokenId + 1),
        currentState: "ready",
        progress: 100,
        progressLog: [...current.progressLog, { id: uid(), date: todayISO(), state: "Transformed to P2 (ready)", notes: "Fermentation completed" }],
        minted: false,
      };
      const uri2 = makeMetadataURI(p2);

      if (typeof contract.mint === "function") {
        await contract.mint({ to: walletPublicKey, token_id: p2.tokenId, uri: uri2 });
      } else if (typeof contract.mint_to === "function") {
        await contract.mint_to({ to: walletPublicKey, token_id: p2.tokenId, uri: uri2 });
      } else {
        alert("Contract has no mint method; cannot mint P2.");
        return;
      }

      setProducts(prev => prev.map(p => p.id === productId ? ({ ...p2, minted: true }) : p));
      alert("🎉 Transformed: P1 burned (if supported) and P2 minted.");
    } catch (err) {
      console.error(err);
      alert(`On-chain finalize failed: ${errorToString(err)}`);
    }
  };
   

  /* --------------------------------- Handlers -------------------------------- */

  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.type.trim()) return;

    const prod: FermentationProduct = {
      id: String(Date.now()),
      tokenId: newTokenId(),
      name: newProduct.name.trim(),
      type: newProduct.type.trim(),
      startDate: todayISO(),
      currentState: "active",
      progress: 0,
      metadata: {
        ingredients: newProduct.ingredients.trim(),
        temperature: newProduct.temperature.trim(),
        notes: newProduct.notes.trim(),
      },
      progressLog: [{ id: uid(), date: todayISO(), state: "Started", notes: "Initial fermentation setup" }],
      minted: false,
    };

    setProducts((prev) => [...prev, prod]);
    setNewProduct({ name: "", type: "", ingredients: "", temperature: "", notes: "" });
    setIsAdding(false);

    if (mintOnAdd) {
      await mintProduct(prod);
    }
  };

  const updateProgress = async (productId: string, newProgress: number, notes: string) => {
    let updated: FermentationProduct | undefined;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const pct = Math.max(0, Math.min(100, newProgress));
        const s: FermentationState = pct >= 100 ? "ready" : pct >= 50 ? "monitoring" : "active";
        updated = {
          ...p,
          progress: pct,
          currentState: s,
          progressLog: [...p.progressLog, { id: uid(), date: todayISO(), state: `Progress: ${pct}%`, notes: notes || "" }],
        };
        return updated!;
      }),
    );

    if (updated && updated.minted) await updateOnChainMetadata(updated);
  };

  /* ---------------------------------- Render --------------------------------- */

  return (
    <Layout.Content>
      <Layout.Inset>
        {/* Top bar with logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <img src="/logo.png" alt="Fermentation Tracker logo" width={36} height={36} style={{ display: "block", borderRadius: 8 }} />
          <h1 style={{ margin: 0 }}>Fermentation Tracker</h1>
        </div>

        {/* Intro */}
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <p style={{ color: "#6b7280" }}>
            Track fermentation from P1 to P2. You can mint an NFT when you add a product, update its metadata as you
            monitor, and on completion burn P1 (if supported) and mint P2 with final attributes.
          </p>
          {!isConnected && (
            <p style={{ color: "#9ca3af", fontStyle: "italic", marginTop: -8 }}>
              Connect your wallet to mint/update on-chain.
            </p>
          )}
        </div>

        {/* Add Product */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Register New Product</h2>
            <button
              type="button"
              style={
                isAdding
                  ? { borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }
                  : { borderRadius: 10, padding: "8px 12px", border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", cursor: "pointer" }
              }
              onClick={() => setIsAdding((s) => !s)}
            >
              {isAdding ? "Close" : "Add product"}
            </button>
          </div>

          {isAdding && (
            <>
              <hr style={{ border: 0, borderTop: "1px solid #f3f4f6", margin: "12px 0" }} />
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }} htmlFor="name">Product Name</label>
                  <input id="name" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Sourdough Starter" />
                </div>

                <div>
                  <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }} htmlFor="type">Type</label>
                  <select id="type" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} value={newProduct.type} onChange={(e) => setNewProduct((p) => ({ ...p, type: e.target.value }))}>
                    <option value="">Select type</option>
                    <option value="Bread">Bread</option>
                    <option value="Vegetable">Vegetable</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }} htmlFor="ingredients">Ingredients</label>
                  <input id="ingredients" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} value={newProduct.ingredients} onChange={(e) => setNewProduct((p) => ({ ...p, ingredients: e.target.value }))} placeholder="Main ingredients" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }} htmlFor="temperature">Temperature</label>
                    <input id="temperature" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} value={newProduct.temperature} onChange={(e) => setNewProduct((p) => ({ ...p, temperature: e.target.value }))} placeholder="22°C" />
                  </div>
                  <div>
                    <label style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }} htmlFor="notes">Notes</label>
                    <input id="notes" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 }} value={newProduct.notes} onChange={(e) => setNewProduct((p) => ({ ...p, notes: e.target.value }))} placeholder="Free text notes" />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input id="mintOnAdd" type="checkbox" checked={mintOnAdd} onChange={(e) => setMintOnAdd(e.target.checked)} />
                  <label htmlFor="mintOnAdd" style={{ fontSize: 14 }}>Mint NFT on add</label>
                </div>

                <button type="button" onClick={() => void addProduct()} style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", cursor: "pointer" }}>
                  Register Product{mintOnAdd ? " & Mint P1" : ""}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Products List */}
        <div style={{ display: "grid", gap: 16 }}>
          {products.map((product) => {
            const open = openId === product.id;
            return (
              <section key={product.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }} aria-label={product.name}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{product.name}</h3>
                      <span
                        style={{
                          background: product.currentState === "active" ? "#e6f0ff" : product.currentState === "monitoring" ? "#fff7e6" : "#e6fffb",
                          color: product.currentState === "active" ? "#003a8c" : product.currentState === "monitoring" ? "#ad4e00" : "#006d75",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.currentState}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {product.type} • Started {product.startDate} • token #{product.tokenId} {product.minted ? "• on-chain" : "• local"}
                    </div>
                  </div>
                  <button type="button" style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }} onClick={() => setOpenId(open ? null : product.id)}>
                    {open ? "Hide" : "View Details & Update Progress"}
                  </button>
                </header>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
                    <span>Progress</span>
                    <span>{product.progress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 8, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }} role="progressbar" aria-valuenow={product.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${Math.min(100, Math.max(0, product.progress))}%`, height: "100%", background: "#1f6feb" }} />
                  </div>
                </div>

                {open && (
                  <>
                    <hr style={{ border: 0, borderTop: "1px solid #f3f4f6", margin: "12px 0" }} />
                    <div style={{ display: "grid", gap: 16 }}>
                      {/* Details */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <div><div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>Type</div><div>{product.type}</div></div>
                        <div><div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>Started</div><div>{product.startDate}</div></div>
                        <div><div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>Temperature</div><div>{product.metadata.temperature}</div></div>
                      </div>

                      <div><div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>Ingredients</div><div style={{ fontSize: 14 }}>{product.metadata.ingredients}</div></div>
                      <div><div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>Notes</div><div style={{ fontSize: 14 }}>{product.metadata.notes}</div></div>

                      {/* Progress Controls */}
                      <div>
                        <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Update Progress</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }} onClick={() => void updateProgress(product.id, product.progress + 10, "Progress update")}>+10%</button>
                          <button type="button" style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }} onClick={() => void updateProgress(product.id, product.progress + 25, "Significant progress")}>+25%</button>
                          <button type="button" style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }} onClick={() => void updateProgress(product.id, 100, "Fermentation complete")}>Complete</button>
                        </div>
                      </div>

                      {/* Progress Log */}
                      <div>
                        <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Progress Log</div>
                        <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                          {product.progressLog.map((log) => (
                            <div key={log.id} style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: 8, fontSize: 13 }}>
                              <div style={{ fontWeight: 600 }}>{log.date}</div>
                              <div style={{ color: "#6b7280" }}>{log.state}</div>
                              {log.notes && <div style={{ fontSize: 12 }}>{log.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* On-chain finalize (P1 -> P2) */}
                      {product.currentState === "ready" && (
                        <button
                          type="button"
                          onClick={() => void transformProduct(product.id)}
                          style={{ borderRadius: 10, padding: "8px 12px", border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", cursor: "pointer" }}
                          title="Burn P1 (if supported) and mint P2 with final metadata"
                        >
                          Transform Product (P1 → P2)
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            );
          })}

          {products.length === 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", textAlign: "center" }}>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>No fermentations yet</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Register your first product to get started</div>
            </div>
          )}
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Home;
