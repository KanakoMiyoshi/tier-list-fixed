"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

type TierKey = "S" | "A" | "B" | "C" | "D";
const TIERS: TierKey[] = ["S", "A", "B", "C", "D"];

type ImgRow = {
  id: string;
  project_id: string;
  name: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};

type SubmissionRow = {
  project_id: string;
  participant_id: string;
  participant_name: string;
  board_json: Record<TierKey, string[]>;
  created_at: string;
  updated_at?: string;
};

const supabase = getSupabase();
type Stat = Record<TierKey, string[]>; // tier -> names[]

function emptyStat(): Stat {
  return { S: [], A: [], B: [], C: [], D: [] };
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function chipList(names: string[]) {
  const u = uniq(names);
  if (u.length === 0) return <span style={{ opacity: 0.5 }}>なし</span>;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {u.map((n) => (
        <span
          key={n}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.35)",
            background: "rgba(255,255,255,.12)",
          }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

export default function Page() {
  const { projectId } = useParams<{ projectId: string }>();

  const [images, setImages] = useState<ImgRow[]>([]);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function loadAll() {
    setLoading(true);
    setMsg("");
    try {
      const [imgRes, subRes] = await Promise.all([
        supabase
          .from("project_images")
          .select("*")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase.from("submissions").select("*").eq("project_id", projectId),
      ]);

      if (imgRes.error) throw imgRes.error;
      if (subRes.error) throw subRes.error;

      setImages((imgRes.data ?? []) as ImgRow[]);
      setSubs((subRes.data ?? []) as SubmissionRow[]);
    } catch (e: any) {
      setMsg(`読み込みエラー: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 画像idごとの集計: imageId -> tier -> names[]
  const statsByImageId = useMemo(() => {
    const map: Record<string, Stat> = {};

    for (const s of subs) {
      const name = (s.participant_name ?? "").trim() || "（名前なし）";
      const board = s.board_json;
      if (!board) continue;

      for (const tier of TIERS) {
        const ids = board[tier] ?? [];
        for (const imageId of ids) {
          if (!map[imageId]) map[imageId] = emptyStat();
          map[imageId][tier].push(name);
        }
      }
    }

    // tierごとの重複名を排除（念のため）
    for (const imageId of Object.keys(map)) {
      for (const tier of TIERS) {
        map[imageId][tier] = uniq(map[imageId][tier]);
      }
    }

    return map;
  }, [subs]);

  return (
    <div className="tierApp">
      <div className="panel">
        <div className="topbar">
          <div className="title">
            <h1 style={{ fontSize: 22, fontWeight: 900 }}>
              📊 みんなの結果（画像ごと）
            </h1>
            <div className="sub">
              「この画像をSに入れたのは誰？」が見れるやつ
            </div>
          </div>
          <div className="actions">
            <a className="btn" href={`/p/${projectId}`}>
              Tierへ戻る
            </a>
            <button
              className="btn"
              onClick={() => void loadAll()}
              disabled={loading}
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>
        </div>

        <div style={{ padding: "8px 14px", fontSize: 12, opacity: 0.85 }}>
          提出数：{subs.length}　/　画像数：{images.length}
        </div>

        {msg ? (
          <div style={{ padding: "8px 14px", fontSize: 12 }}>{msg}</div>
        ) : null}

        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>読み込み中...</div>
          ) : null}

          {images.map((img) => {
            const stat = statsByImageId[img.id] ?? emptyStat();

            return (
              <div
                key={img.id}
                className="panel"
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,.10)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <img
                    src={img.image_url}
                    alt={img.name}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 16,
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,.25)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {img.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      id: {img.id}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {TIERS.map((tier) => (
                    <details
                      key={tier}
                      style={{
                        background: "rgba(0,0,0,.12)",
                        borderRadius: 14,
                        padding: 10,
                      }}
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          listStyle: "none",
                          fontWeight: 900,
                        }}
                      >
                        {tier}：{stat[tier].length}人
                        <span style={{ fontWeight: 500, opacity: 0.8 }}>
                          （クリックで名前）
                        </span>
                      </summary>
                      <div style={{ marginTop: 8 }}>{chipList(stat[tier])}</div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}

          {!loading && images.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              画像がないよ！{" "}
              <a className="btn" href={`/p/${projectId}/manage`}>
                Manage
              </a>{" "}
              から追加してね
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
