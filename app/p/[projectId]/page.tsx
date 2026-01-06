"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../src/lib/supabaseClient";
import {
  getOrCreateParticipantId,
  getSavedName,
  saveName,
} from "../../../src/lib/participant";
import { toPng } from "html-to-image";
import { DragOverlay } from "@dnd-kit/core";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const proxyImg = (url: string) => `/api/img?url=${encodeURIComponent(url)}`;

type TierKey = "S" | "A" | "B" | "C" | "D";
type BoardState = Record<TierKey, string[]>;

type Item = { id: string; name: string; imageUrl: string };
type ImgRow = {
  id: string;
  project_id: string;
  name: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};
type ProjectRow = { id: string; title: string };

const TIERS: TierKey[] = ["S", "A", "B", "C", "D"];
const TIER_COLOR: Record<TierKey, string> = {
  S: "#ff4d6d",
  A: "#ff9f1c",
  B: "#4dabf7",
  C: "#51cf66",
  D: "#5c7cfa",
};

function buildInitialState(items: Item[]): BoardState {
  return { S: [], A: [], B: [], C: [], D: items.map((i) => i.id) };
}
function findTierByItem(state: BoardState, itemId: string): TierKey | null {
  for (const t of TIERS) if (state[t].includes(itemId)) return t;
  return null;
}
const tierId = (t: TierKey) => `tier:${t}`;
const parseTier = (id: string): TierKey | null =>
  id.startsWith("tier:") ? (id.slice(5) as TierKey) : null;

const collisionDetection: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  if (p.length) return p;
  const r = rectIntersection(args);
  if (r.length) return r;
  return closestCenter(args);
};

function SortableCard({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : 1,
      }}
      className="card"
      {...attributes}
      {...listeners}
      title={item.name}
    >
      {/* crossOrigin を付けるとPNG保存でコケにくい（CORSが許可されてる前提） */}
      <img src={proxyImg(item.imageUrl)} alt={item.name} />
      <div className="name">{item.name}</div>
    </div>
  );
}

function TierRow({
  tier,
  ids,
  itemsById,
  onTapTier,
}: {
  tier: TierKey;
  ids: string[];
  itemsById: Record<string, Item>;
  onTapTier: (tier: TierKey) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tierId(tier) });
  return (
    <div className="tierRow">
      <div
        className="tierLabel"
        style={{ background: TIER_COLOR[tier], cursor: "pointer" }}
        onClick={() => onTapTier(tier)}
        title="クリック / タップで画像選択"
      >
        {tier}
      </div>
      <div
        ref={setNodeRef}
        className="dropzone"
        style={{
          outline: isOver ? "2px solid #fff" : "none",
          minHeight: 110,
        }}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          {ids.map((id) => (
            <SortableCard key={id} item={itemsById[id]} />
          ))}
        </SortableContext>
        {ids.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: 12, padding: 10 }}>
            ここにドロップ
          </div>
        )}
      </div>
    </div>
  );
}

function NameModal({
  open,
  value,
  onChange,
  onSave,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        className="panel"
        style={{ width: "min(520px, 100%)", padding: 16, borderRadius: 18 }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
          🌙✨ まずは名前を入力してね
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
          入力した名前はこの端末に保存されます（いつでも変更OK）
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            className="btn"
            style={{ textAlign: "left" }}
            placeholder="あなたのお名前をおしえてね！⭐️"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
          />
          <button className="btn" onClick={onSave} disabled={!value.trim()}>
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}

function TierSelectModal({
  tier,
  items,
  state,
  onSelect,
  onMove,
  onClose,
}: {
  tier: TierKey;
  items: Item[];
  state: BoardState;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const ids = state[tier];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div className="panel" style={{ width: "min(640px,100%)" }}>
        <h3 style={{ fontWeight: 900, marginBottom: 8 }}>
          {tier} に入れる画像
        </h3>

        {/* 並び替え */}
        {ids.map((id, i) => {
          const it = items.find((x) => x.id === id);
          if (!it) return null;
          return (
            <div
              key={id}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <img src={proxyImg(it.imageUrl)} style={{ width: 48, height: 48 }} />
              <div style={{ flex: 1 }}>{it.name}</div>
              <button disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                ↑
              </button>
              <button
                disabled={i === ids.length - 1}
                onClick={() => onMove(i, i + 1)}
              >
                ↓
              </button>
            </div>
          );
        })}

        <hr style={{ margin: "10px 0" }} />

        {/* 全画像から選択 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((it) => (
            <button key={it.id} className="btn" onClick={() => onSelect(it.id)}>
            <img src={proxyImg(it.imageUrl)} style={{ width: 60 }} />
              <div>{it.name}</div>
            </button>
          ))}
        </div>

        <button className="btn" onClick={onClose} style={{ marginTop: 10 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const projectId = React.use(params).projectId;

  const captureRef = useRef<HTMLDivElement | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i] as const)),
    [items]
  );
  const [state, setState] = useState<BoardState>({
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  });

  const [projectTitle, setProjectTitle] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [nameModalOpen, setNameModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [savingPng, setSavingPng] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapTier, setTapTier] = useState<TierKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    const saved = getSavedName();
    setName(saved);
    setNameModalOpen(!saved.trim());
  }, []);

  async function loadProjectAndImages() {
    setLoading(true);
    setMsg("");
    try {
      // projects（title）
      const p = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (p.error) throw p.error;
      setProjectTitle((p.data as ProjectRow | null)?.title ?? "");

      // images
      const res = await supabase
        .from("project_images")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (res.error) throw res.error;

      const rows = (res.data ?? []) as ImgRow[];
      const nextItems = rows.map((r) => ({
        id: r.id,
        name: r.name,
        imageUrl: r.image_url,
      }));
      setItems(nextItems);
      setState(buildInitialState(nextItems));
      if (nextItems.length === 0)
        setMsg("まだ画像が登録されてないよ！/manage から追加してね ✨");
    } catch (e: any) {
      setMsg(`読み込みエラー: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadProjectAndImages();
  }, [projectId]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const overRaw = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    if (!overRaw) return;

    setState((prev) => {
      const from = findTierByItem(prev, active);
      if (!from) return prev;
      const to = parseTier(overRaw) ?? findTierByItem(prev, overRaw);
      if (!to) return prev;

      if (from === to && !parseTier(overRaw)) {
        const oi = prev[from].indexOf(active);
        const ni = prev[to].indexOf(overRaw);
        if (oi < 0 || ni < 0) return prev;
        return { ...prev, [from]: arrayMove(prev[from], oi, ni) };
      }
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== active),
        [to]: [...prev[to], active],
      };
    });
  }

  function confirmName() {
    if (!name.trim()) return;
    saveName(name.trim());
    setNameModalOpen(false);
    setMsg("");
  }

  async function submit() {
    if (!name.trim()) {
      setNameModalOpen(true);
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      saveName(name.trim());
      const participant_id = getOrCreateParticipantId();

      const payload = {
        id: `${projectId}:${participant_id}`,
        project_id: projectId,
        participant_id,
        participant_name: name.trim(),
        board_json: state,
      };

      const res = await supabase
        .from("submissions")
        .upsert(payload, { onConflict: "project_id,participant_id" });
      if (res.error) throw res.error;

      setMsg("提出したよ！✨（何回でも上書きOK）");
    } catch (e: any) {
      setMsg(`提出エラー: ${e?.message ?? String(e)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAsPng() {
    if (!captureRef.current) return;
    setSavingPng(true);
    setMsg("");

    try {
      // 画像が読み込み終わってないと真っ白になることがあるのでちょい待つ
      await new Promise((r) => setTimeout(r, 50));

      const fileSafeTitle = (projectTitle || "Tier").replace(
        /[\\/:*?"<>|]/g,
        "_"
      );
      const fileSafeName = (name || "you").replace(/[\\/:*?"<>|]/g, "_");
      const filename = `${fileSafeName}_${fileSafeTitle}_tier.png`;

      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        pixelRatio: 2, // くっきり
        backgroundColor: "#0b1020", // 背景（CSS背景が透過扱いになる環境の保険）
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();

      setMsg("PNGで保存したよ〜！📸✨");
    } catch (e: any) {
      // よくある: CORSでcanvasが汚染される（外部画像が許可されてない）
      setMsg(
        `PNG保存エラー: ${e?.message ?? String(e)}\n` +
          `もし「canvas has been tainted」系なら、画像URLのCORSが原因かも！`
      );
    } finally {
      setSavingPng(false);
    }
  }

  const bigTitle = `🌙✨ ${name || "あなた"}が作る最強の${
    projectTitle || "Tier"
  }Tier 表`;

  return (
    <div className="tierApp">
      <NameModal
        open={nameModalOpen}
        value={name}
        onChange={setName}
        onSave={confirmName}
      />

      {tapTier && (
        <TierSelectModal
          tier={tapTier}
          items={items}
          state={state}
          onSelect={(id) => {
            setState((prev) => {
              const next = { ...prev };
              (Object.keys(next) as TierKey[]).forEach((t) => {
                next[t] = next[t].filter((x) => x !== id);
              });
              next[tapTier].push(id);
              return next;
            });
          }}
          onMove={(from, to) => {
            setState((prev) => ({
              ...prev,
              [tapTier]: arrayMove(prev[tapTier], from, to),
            }));
          }}
          onClose={() => setTapTier(null)}
        />
      )}

      <div className="panel">
        <div className="topbar" style={{ alignItems: "flex-start" }}>
          <div className="title">
            <h1 style={{ fontSize: 22, lineHeight: 1.2, fontWeight: 900 }}>
              {bigTitle}
            </h1>
            <div className="sub" style={{ marginTop: 6 }}>
              ドラッグで並べ替え → 提出（何回でもOK） /
              保存ボタンでスクショ風PNG
            </div>
          </div>

          <div className="actions">
            <button className="btn" onClick={() => setNameModalOpen(true)}>
              名前変更
            </button>
            <button
              className="btn"
              disabled={submitting || loading}
              onClick={submit}
            >
              {submitting ? "送信中..." : "提出"}
            </button>
            <button
              className="btn"
              disabled={savingPng || loading}
              onClick={saveAsPng}
            >
              {savingPng ? "保存中..." : "PNG保存"}
            </button>
            <a className="btn" href={`/p/${projectId}/results`}>
              Results
            </a>
            <a className="btn" href={`/p/${projectId}/manage`}>
              Manage
            </a>
          </div>
        </div>

        {msg && (
          <div
            style={{
              padding: "8px 14px",
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        )}

        {/* ✅ ここを丸ごとPNG化する */}
        <div ref={captureRef} style={{ padding: 14, borderRadius: 18 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="board">
              {(["S", "A", "B", "C"] as TierKey[]).map((t) => (
                <TierRow
                  key={t}
                  tier={t}
                  ids={state[t]}
                  itemsById={itemsById}
                  onTapTier={(tier) => setTapTier(tier)}
                />
              ))}
            </div>

            <div className="unrankedWrap">
              <div className="unrankedTitle">
                <div className="left">未分類（D）</div>
                <div className="right">{state.D.length} items</div>
              </div>
              <TierRow
                tier="D"
                ids={state.D}
                itemsById={itemsById}
                onTapTier={(tier) => setTapTier(tier)}
              />
            </div>
          </DndContext>
          <DragOverlay>
            {activeId ? (
              <div className="card" style={{ transform: "scale(1.05)" }}>
                <img
                  src={proxyImg(itemsById[activeId]?.imageUrl ?? "")}
                  alt={itemsById[activeId]?.name}
                />
                <div className="name">{itemsById[activeId]?.name}</div>
              </div>
            ) : null}
          </DragOverlay>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            generated by tier-list-fixed 🌙✨
          </div>
        </div>
      </div>

      {activeId && (
        <div style={{ position: "fixed", right: 14, bottom: 14 }}>
          <div className="panel" style={{ padding: 10, fontSize: 12 }}>
            dragging: {itemsById[activeId]?.name ?? activeId}
          </div>
        </div>
      )}
    </div>
  );
}
