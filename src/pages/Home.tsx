"use client";

import React, { useState } from "react";
import { Layout } from "@stellar/design-system";

// Import the generated contract module (default or named export)
import * as nftContract from "../contracts/nft_enumerable_example";

// Wallet hook (global wallet UI elsewhere)
import { useWallet } from "../hooks/useWallet";

type FermentationState = "active" | "monitoring" | "ready";

interface FermentationProduct {
  id: string;
  name: string;
  type: string;
  startDate: string;
  currentState: FermentationState;
  progress: number;
  metadata: {
    ingredients: string;
    temperature: string;
    ph: string;
    notes: string;
  };
  progressLog: Array<{
    date: string;
    state: string;
    notes: string;
  }>;
}

/** Safe error → string without unsafe assignments */
const errorToString = (e: unknown): string => {
  if (e instanceof Error && typeof e.message === "string") return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
};

const stateStyle: Record<FermentationState, { bg: string; fg: string; label: string }> = {
  active: { bg: "#e6f0ff", fg: "#003a8c", label: "active" },
  monitoring: { bg: "#fff7e6", fg: "#ad4e00", label: "monitoring" },
  ready: { bg: "#e6fffb", fg: "#006d75", label: "ready" },
};

const todayISO = () => new Date().toISOString().split("T")[0];

const badge = (state: FermentationState) => {
  const s = stateStyle[state];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
      aria-label={`status: ${s.label}`}
    >
      {s.label}
    </span>
  );
};

const labelCol: React.CSSProperties = { color: "#6b7280", fontSize: 12, fontWeight: 500 };
const cardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };
const buttonStyle: React.CSSProperties = { borderRadius: 10, padding: "8px 12px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" };
const primaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#1f6feb", color: "#fff", border: "1px solid #1f6feb" };
const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 14 };
const progressTrack: React.CSSProperties = { width: "100%", height: 8, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" };
const progressBar = (value: number): React.CSSProperties => ({ width: `${Math.min(100, Math.max(0, value))}%`, height: "100%", background: "#1f6feb" });
const sectionGap: React.CSSProperties = { display: "grid", gap: 16 };
const smallNote: React.CSSProperties = { color: "#6b7280", fontSize: 12 };
const hrSoft = <hr style={{ border: 0, borderTop: "1px solid #f3f4f6", margin: "12px 0" }} />;

const initialSeed: FermentationProduct[] = [
  {
    id: "1",
    name: "Sourdough Starter",
    type: "Bread",
    startDate: "2024-01-15",
    currentState: "active",
    progress: 65,
    metadata: { ingredients: "Flour, Water", temperature: "22°C", ph: "4.2", notes: "Daily feeding schedule" },
    progressLog: [
      { date: "2024-01-15", state: "Started", notes: "Initial mix" },
      { date: "2024-01-18", state: "First bubbles", notes: "Activity detected" },
    ],
  },
  {
    id: "2",
    name: "Kimchi Batch #3",
    type: "Vegetable",
    startDate: "2024-01-20",
    currentState: "monitoring",
    progress: 85,
    metadata: { ingredients: "Cabbage, Gochugaru, Salt, Garlic", temperature: "18°C", ph: "3.8", notes: "Extra spicy batch" },
    progressLog: [
      { date: "2024-01-20", state: "Started", notes: "Salted and packed" },
      { date: "2024-01-23", state: "Active fermentation", notes: "Strong sour smell" },
    ],
  },
];

/** Minimal contract typing to avoid `any` while staying flexible */
type MintArgs = { to: string; token_id?: string; uri?: string };
type HelloArgs = { to: string };
type NftContract = {
  mint?: (args: MintArgs) => Promise<unknown>;
  mint_to?: (args: MintArgs) => Promise<unknown>;
  hello?: (args: HelloArgs) => Promise<unknown>;
};

/** Support both default and named export shapes without using `any` */
const getNftContract = (): NftContract => {
  const mod = nftContract as unknown as { default?: unknown } & Record<string, unknown>;
  const obj = (mod.default ?? mod) as unknown;
  return obj as NftContract;
};

const Home: React.FC = () => {
  const { publicKey } = useWallet(); // global wallet UI
  const isConnected = !!publicKey;

  const [products, setProducts] = useState<FermentationProduct[]>(initialSeed);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", type: "", ingredients: "", temperature: "", ph: "", notes: "" });

  const resetForm = () => setNewProduct({ name: "", type: "", ingredients: "", temperature: "", ph: "", notes: "" });

  const addProduct = () => {
    if (!newProduct.name || !newProduct.type) return;

    const prod: FermentationProduct = {
      id: Date.now().toString(),
      name: newProduct.name.trim(),
      type: newProduct.type,
      startDate: todayISO(),
      currentState: "active",
      progress: 0,
      metadata: {
        ingredients: newProduct.ingredients.trim(),
        temperature: newProduct.temperature.trim(),
        ph: newProduct.ph.trim(),
        notes: newProduct.notes.trim(),
      },
      progressLog: [{ date: todayISO(), state: "Started", notes: "Initial fermentation setup" }],
    };

    setProducts((prev) => [...prev, prod]);
    resetForm();
    setIsAdding(false);
  };

  const updateProgress = (productId: string, newProgress: number, notes: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const pct = Math.max(0, Math.min(100, newProgress));
        const s: FermentationState = pct >= 100 ? "ready" : pct >= 50 ? "monitoring" : "active";
        return {
          ...p,
          progress: pct,
          currentState: s,
          progressLog: [...p.progressLog, { date: todayISO(), state: `Progress: ${pct}%`, notes: notes || "" }],
        };
      }),
    );
  };

  // Finalize product on-chain
  const transformProduct = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    if (!isConnected || !publicKey) {
      alert("Please connect your wallet from the global header before finalizing on-chain.");
      return;
    }

    try {
      const uri = `fermentation://${target.id}?name=${encodeURIComponent(target.name)}`;
      const c = getNftContract();

      let res: unknown;
      if (c.mint) {
        res = await c.mint({ to: publicKey, token_id: target.id, uri });
      } else if (c.mint_to) {
        res = await c.mint_to({ to: publicKey, token_id: target.id, uri });
      } else if (c.hello) {
        res = await c.hello({ to: target.name });
      } else {
        throw new Error("Contract method not found: expose `mint`/`mint_to` or update transformProduct.");
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      alert(`🎉 Fermentation complete on-chain! Contract response: ${String(res)}`);
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert(`On-chain finalize failed: ${errorToString(err)}`);
    }
  };

  return (
    <Layout.Content>
      <Layout.Inset>
        {/* Top bar with logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <img
            src="/logo.png"
            alt="Fermentation Tracker logo"
            width={36}
            height={36}
            style={{ display: "block", borderRadius: 8 }}
          />
          <h1 style={{ margin: 0 }}>Fermentation Tracker</h1>
        </div>

        {/* Intro */}
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          <p style={{ color: "#6b7280" }}>
            Fermentation Tracker keeps your batches organized from day one to “ready.” Add a product, log ingredients,
            temperature, pH, and notes, and update progress as you check in. See a clear timeline of what happened and
            when, so you can repeat wins and catch issues early. From sourdough to kimchi to kombucha, everything lives
            in one place—simple, tidy, and easy to follow until tasting.
          </p>
        </div>

        {/* Add Product */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Register New Product</h2>
            <button type="button" style={isAdding ? buttonStyle : primaryButtonStyle} onClick={() => setIsAdding((s) => !s)}>
              {isAdding ? "Close" : "Add product"}
            </button>
          </div>

          {isAdding && (
            <>
              {hrSoft}
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={labelCol} htmlFor="name">Product Name</label>
                  <input id="name" style={inputStyle} value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Sourdough Starter" />
                </div>

                <div>
                  <label style={labelCol} htmlFor="type">Type</label>
                  <select id="type" style={inputStyle} value={newProduct.type} onChange={(e) => setNewProduct((p) => ({ ...p, type: e.target.value }))}>
                    <option value="">Select type</option>
                    <option value="Bread">Bread</option>
                    <option value="Vegetable">Vegetable</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverage">Beverage</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={labelCol} htmlFor="ingredients">Ingredients</label>
                  <input id="ingredients" style={inputStyle} value={newProduct.ingredients} onChange={(e) => setNewProduct((p) => ({ ...p, ingredients: e.target.value }))} placeholder="Main ingredients" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelCol} htmlFor="temperature">Temperature</label>
                    <input id="temperature" style={inputStyle} value={newProduct.temperature} onChange={(e) => setNewProduct((p) => ({ ...p, temperature: e.target.value }))} placeholder="22°C" />
                  </div>
                  <div>
                    <label style={labelCol} htmlFor="ph">pH Level</label>
                    <input id="ph" style={inputStyle} value={newProduct.ph} onChange={(e) => setNewProduct((p) => ({ ...p, ph: e.target.value }))} placeholder="4.2" />
                  </div>
                </div>

                <div>
                  <label style={labelCol} htmlFor="notes">Notes</label>
                  <textarea id="notes" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={newProduct.notes} onChange={(e) => setNewProduct((p) => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
                </div>

                <button type="button" onClick={addProduct} style={primaryButtonStyle}>Register Product</button>
              </div>
            </>
          )}
        </div>

        {/* Products List */}
        <div style={sectionGap}>
          {products.map((product) => {
            const open = openId === product.id;
            return (
              <section key={product.id} style={cardStyle} aria-label={product.name}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{product.name}</h3>
                      {badge(product.currentState)}
                    </div>
                    <div style={smallNote}>{product.type} • Started {product.startDate}</div>
                  </div>
                  <button type="button" style={buttonStyle} onClick={() => setOpenId(open ? null : product.id)}>
                    {open ? "Hide" : "View Details & Update Progress"}
                  </button>
                </header>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
                    <span>Progress</span>
                    <span>{product.progress}%</span>
                  </div>
                  <div style={progressTrack} role="progressbar" aria-valuenow={product.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div style={progressBar(product.progress)} />
                  </div>
                </div>

                {open && (
                  <>
                    {hrSoft}
                    <div style={{ display: "grid", gap: 16 }}>
                      {/* Details */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                        <div><div style={labelCol}>Type</div><div>{product.type}</div></div>
                        <div><div style={labelCol}>Started</div><div>{product.startDate}</div></div>
                        <div><div style={labelCol}>Temperature</div><div>{product.metadata.temperature}</div></div>
                        <div><div style={labelCol}>pH Level</div><div>{product.metadata.ph}</div></div>
                      </div>

                      <div><div style={labelCol}>Ingredients</div><div style={{ fontSize: 14 }}>{product.metadata.ingredients}</div></div>
                      <div><div style={labelCol}>Notes</div><div style={{ fontSize: 14 }}>{product.metadata.notes}</div></div>

                      {/* Progress Controls */}
                      <div>
                        <div style={{ ...labelCol, marginBottom: 8 }}>Update Progress</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" style={buttonStyle} onClick={() => updateProgress(product.id, product.progress + 10, "Progress update")}>+10%</button>
                          <button type="button" style={buttonStyle} onClick={() => updateProgress(product.id, product.progress + 25, "Significant progress")}>+25%</button>
                          <button type="button" style={buttonStyle} onClick={() => updateProgress(product.id, 100, "Fermentation complete")}>Complete</button>
                        </div>
                      </div>

                      {/* Progress Log */}
                      <div>
                        <div style={{ ...labelCol, marginBottom: 8 }}>Progress Log</div>
                        <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                          {product.progressLog.map((log) => (
                            <div
                              key={`${log.date}-${log.state}`}
                              style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: 8, fontSize: 13 }}
                            >
                              <div style={{ fontWeight: 600 }}>{log.date}</div>
                              <div style={{ color: "#6b7280" }}>{log.state}</div>
                              {log.notes && <div style={{ fontSize: 12 }}>{log.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* On-chain finalize */}
                      {product.currentState === "ready" && (
                        <button
                          type="button"
                          onClick={() => void transformProduct(product.id)}
                          style={primaryButtonStyle}
                          title="Finalize on-chain and remove from list"
                        >
                          Transform Product (on-chain finalize)
                        </button>
                      )}
                    </div>
                  </>
                )}
              </section>
            );
          })}

          {products.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center" }}>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>No fermentations yet</div>
              <div style={{ ...smallNote }}>Register your first product to get started</div>
            </div>
          )}
        </div>
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Home;
