"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../src/lib/supabaseClient";

type ImgRow = {
  id: string;
  project_id: string;
  name: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};

type ProjectRow = {
  id: string;
  title: string;
  created_at: string;
};

function uid(prefix = "img") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function Page() {
  const { projectId } = useParams<{ projectId: string }>();

  const [projectTitle, setProjectTitle] = useState("");

  const [overrideName, setOverrideName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImgRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadProject() {
    const res = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (res.error) {
      setMsg(`プロジェクト読み込みエラー: ${res.error.message}`);
      return;
    }
    if (res.data) {
      setProjectTitle((res.data as ProjectRow).title ?? "");
    } else {
      // 存在しないなら作っておく（title空でOK）
      const ins = await supabase
        .from("projects")
        .insert({ id: projectId, title: "" });
      if (ins.error) setMsg(`プロジェクト作成エラー: ${ins.error.message}`);
    }
  }

  async function saveProject() {
    setBusy(true);
    setMsg("");
    try {
      const title = projectTitle.trim();
      const res = await supabase
        .from("projects")
        .upsert({ id: projectId, title }, { onConflict: "id" });

      if (res.error) throw res.error;
      setMsg("タイトル保存したよ ✨");
    } catch (e: any) {
      setMsg(`保存エラー: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadImages() {
    const res = await supabase
      .from("project_images")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (res.error) {
      setMsg(`読み込みエラー: ${res.error.message}`);
      return;
    }
    setRows(res.data as ImgRow[]);
  }

  useEffect(() => {
    void loadProject();
    void loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const canUpload = useMemo(() => files.length > 0 && !busy, [files, busy]);

  async function uploadOne(file: File, name: string, nextOrder: number) {
    const ext = file.name.split(".").pop() || "png";
    const objectPath = `${projectId}/${Date.now()}_${uid()}.${ext}`;

    const up = await supabase.storage
      .from("tier-images")
      .upload(objectPath, file, { upsert: false });

    if (up.error) throw up.error;

    const pub = supabase.storage.from("tier-images").getPublicUrl(objectPath);
    const imageUrl = pub.data.publicUrl;

    const ins = await supabase.from("project_images").insert({
      id: uid("img"),
      project_id: projectId,
      name,
      image_url: imageUrl,
      sort_order: nextOrder,
    });

    if (ins.error) throw ins.error;
  }

  async function uploadAll() {
    if (files.length === 0) return;
    setBusy(true);
    setMsg("");

    try {
      const base =
        rows.length === 0
          ? 1
          : Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1;

      const trimmed = overrideName.trim();

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const name =
          trimmed.length === 0
            ? f.name
            : files.length === 1
            ? trimmed
            : `${trimmed}_${i + 1}`;

        await uploadOne(f, name, base + i);
      }

      setFiles([]);
      setOverrideName("");
      setMsg(`追加できたよ ✨（${files.length}件）`);
      await loadImages();
    } catch (e: any) {
      setMsg(`アップロードエラー: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(id: string) {
    if (
      !confirm("この画像を削除する？（DB行のみ。Storageファイル削除は未対応）")
    )
      return;
    setBusy(true);
    setMsg("");
    try {
      const del = await supabase.from("project_images").delete().eq("id", id);
      if (del.error) throw del.error;
      await loadImages();
    } catch (e: any) {
      setMsg(`削除エラー: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tierApp">
      <div className="panel">
        <div className="topbar">
          <div className="title">
            <h1>🛠️ 管理（{projectId}）</h1>
            <div className="sub">タイトル設定 & 画像登録</div>
          </div>
          <div className="actions">
            <a className="btn" href={`/p/${projectId}`}>
              Tierへ戻る
            </a>
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 14 }}>
          {/* タイトル設定 */}
          <div className="panel" style={{ padding: 12, borderRadius: 16 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              Tier表のタイトル（admin入力）
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                className="btn"
                style={{ textAlign: "left" }}
                value={projectTitle}
                placeholder="例）推しキャラ / おすすめ映画 / 最強ラーメン など"
                onChange={(e) => setProjectTitle(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => void saveProject()}
                disabled={busy}
              >
                {busy ? "保存中..." : "タイトルを保存"}
              </button>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                見出しは：🌙✨ [参加者名]が作る最強の「
                {projectTitle || "（ここ）"}」Tier 表
              </div>
            </div>
          </div>

          {/* 画像アップロード */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>画像をまとめて追加</div>

            <input
              className="btn"
              style={{ textAlign: "left" }}
              value={overrideName}
              placeholder="（任意）表示名。空なら各ファイル名 / 複数なら prefix_1.."
              onChange={(e) => setOverrideName(e.target.value)}
            />

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />

            <button
              className="btn"
              disabled={!canUpload}
              onClick={() => void uploadAll()}
            >
              {busy ? "処理中..." : `アップロードして追加（${files.length}件）`}
            </button>
          </div>

          {msg ? (
            <div style={{ fontSize: 12, opacity: 0.85 }}>{msg}</div>
          ) : null}

          <div style={{ marginTop: 8, fontWeight: 900 }}>
            登録済み（{rows.length}）
          </div>
          <div
            className="dropzone"
            style={{ background: "rgba(255,255,255,.5)" }}
          >
            {rows.map((r) => (
              <div key={r.id} style={{ position: "relative" }}>
                <div className="card" style={{ cursor: "default" }}>
                  <img src={r.image_url} alt={r.name} />
                  <div className="name">{r.name}</div>
                </div>
                <button
                  className="btn"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    padding: "6px 8px",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  onClick={() => void removeRow(r.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="hint">
            ✅ 名前未入力→ファイル名になる／✅
            複数アップ可（prefix入れたら連番）
          </div>
        </div>
      </div>
    </div>
  );
}
