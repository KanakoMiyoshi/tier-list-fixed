"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TierKey = "S" | "A" | "B" | "C" | "D";
type ContainerKey = TierKey;

type Item = { id: string; name: string; imageUrl: string };
type BoardState = Record<ContainerKey, string[]>;

const TIERS: TierKey[] = ["S", "A", "B", "C", "D"];

const TIER_COLOR: Record<TierKey, string> = {
  S: "#ff4d6d",
  A: "#ff9f1c",
  B: "#4dabf7",
  C: "#51cf66",
  D: "#5c7cfa",
};

// デモ：固定画像（あとでSupabaseから読む想定）
const DEMO_ITEMS: Item[] = [
  {
    id: "img1",
    name: "画像1",
    imageUrl: "https://placehold.co/256x256?text=1",
  },
  {
    id: "img2",
    name: "画像2",
    imageUrl: "https://placehold.co/256x256?text=2",
  },
  {
    id: "img3",
    name: "画像3",
    imageUrl: "https://placehold.co/256x256?text=3",
  },
  {
    id: "img4",
    name: "画像4",
    imageUrl: "https://placehold.co/256x256?text=4",
  },
];

function buildInitialState(items: Item[]): BoardState {
  // 参照サイト風：追加直後は D に入る :contentReference[oaicite:1]{index=1}
  return { S: [], A: [], B: [], C: [], D: items.map((i) => i.id) };
}

function findContainer(state: BoardState, itemId: string): ContainerKey | null {
  for (const k of TIERS) {
    if (state[k].includes(itemId)) return k;
  }
  return null;
}

function SortableCard({ item }: { item: Item }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      {...attributes}
      {...listeners}
      title={item.name}
    >
      <img src={item.imageUrl} alt={item.name} />
      <div className="name">{item.name}</div>
    </div>
  );
}

function TierRow({
  tier,
  ids,
  itemsById,
}: {
  tier: TierKey;
  ids: string[];
  itemsById: Record<string, Item>;
}) {
  return (
    <div className="tierRow">
      <div className="tierLabel" style={{ background: TIER_COLOR[tier] }}>
        {tier}
      </div>

      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="dropzone">
          {ids.map((id) => (
            <SortableCard key={id} item={itemsById[id]} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const projectId = React.use(params).projectId;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<Item[]>(DEMO_ITEMS);
  const itemsById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  const [state, setState] = useState<BoardState>(() =>
    buildInitialState(DEMO_ITEMS)
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function resetAll() {
    setItems(DEMO_ITEMS);
    setState(buildInitialState(DEMO_ITEMS));
  }

  function deleteAll() {
    setItems([]);
    setState({ S: [], A: [], B: [], C: [], D: [] });
  }

  async function addItemFromFile(file: File) {
    // 参照サイトは「ブラウザ内で処理」系なので、まずはローカルURLで表示 :contentReference[oaicite:2]{index=2}
    const id = `u_${Math.random().toString(36).slice(2, 10)}`;
    const url = URL.createObjectURL(file);

    const newItem: Item = { id, name: file.name, imageUrl: url };

    setItems((prev) => [...prev, newItem]);
    setState((prev) => ({ ...prev, D: [...prev.D, id] }));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    if (!over) return;

    setState((prev) => {
      const from = findContainer(prev, active);
      const to = findContainer(prev, over);
      if (!from || !to) return prev;

      if (from === to) {
        const oldIndex = prev[from].indexOf(active);
        const newIndex = prev[to].indexOf(over);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return { ...prev, [from]: arrayMove(prev[from], oldIndex, newIndex) };
      }

      const nextFrom = prev[from].filter((id) => id !== active);
      const nextTo = [...prev[to].filter((id) => id !== active), active];

      return { ...prev, [from]: nextFrom, [to]: nextTo };
    });
  }

  return (
    <div className="tierApp">
      <div className="panel">
        <div className="topbar">
          <div className="title">
            <h1>🌙✨ {projectId} の Tier 表</h1>
            <div className="sub">
              ドラッグして S〜D に分類（UIは参照サイト風）
            </div>
          </div>

          <div className="actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) void addItemFromFile(f);
                ev.target.value = "";
              }}
            />
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Add Item
            </button>
            <button
              className="btn"
              onClick={() => alert("次で実装：Save Image（PNG書き出し）")}
            >
              Save Image
            </button>
            <button className="btn" onClick={deleteAll}>
              Delete All
            </button>
            <button className="btn" onClick={resetAll}>
              Reset Demo
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="rows">
            {TIERS.map((t) => (
              <TierRow key={t} tier={t} ids={state[t]} itemsById={itemsById} />
            ))}
          </div>
        </DndContext>

        <div className="help">
          ※ 今は “見た目寄せ” 優先で、Save Image は次でPNG出力を入れるよ。
          <br />※ 本番（みんなの提出＆集計）にする場合は Add Item
          を管理側だけにするのがおすすめ。
        </div>
      </div>

      {activeId ? (
        <div style={{ position: "fixed", right: 14, bottom: 14, zIndex: 10 }}>
          <div
            className="panel"
            style={{
              padding: 10,
              borderRadius: 14,
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            dragging: {itemsById[activeId]?.name ?? activeId}
          </div>
        </div>
      ) : null}
    </div>
  );
}
