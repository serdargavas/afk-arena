import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLASS_LIST } from '../game';
import { formatNum } from './format';
import {
  leaderboardEnabled,
  fetchTop,
  subscribeScores,
  signInWithGoogle,
  signOut,
  getSignedInName,
  submitScore,
  type LeaderRow,
} from '../net/leaderboard';

function classIcon(id: string): string {
  return CLASS_LIST.find((c) => c.id === id)?.icon ?? '⚔';
}

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const save = useGameStore((s) => s.save);
  const setPlayerName = useGameStore((s) => s.actions.setPlayerName);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const enabled = leaderboardEnabled();

  const refresh = () => {
    setLoading(true);
    fetchTop()
      .then(setRows)
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getSignedInName().then((n) => {
      if (!alive) return;
      setMe(n);
      // Reflect our latest best as soon as the board opens.
      if (n && save) {
        void submitScore({
          name: save.meta.playerName || n,
          bestStage: save.meta.bestStage,
          bestEssence: save.meta.bestEssence,
          classId: save.meta.selectedClass,
        }).then(refresh);
      }
    });
    refresh();
    const unsub = subscribeScores(refresh);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const doSignIn = async () => {
    setBusy(true);
    setErr(null);
    try {
      const name = await signInWithGoogle();
      setPlayerName(name);
      setMe(name);
      if (save) {
        await submitScore({
          name,
          bestStage: save.meta.bestStage,
          bestEssence: save.meta.bestEssence,
          classId: save.meta.selectedClass,
        });
      }
      refresh();
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    await signOut();
    setMe(null);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal sheet">
        <div className="sheet-head">
          <span className="modal-title">🏆 Leaderboard</span>
          <span className="tb-spacer" />
          {me ? (
            <button className="tb-btn" onClick={doSignOut} title={`Signed in as ${me}`}>
              ⎋
            </button>
          ) : null}
          <button className="tb-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sheet-body">
          {!enabled ? (
            <div className="lb-note">Leaderboard is available in the desktop app.</div>
          ) : loading && rows.length === 0 ? (
            <div className="lb-loader">
              <span className="spinner" />
              Loading leaderboard…
            </div>
          ) : (
            <ol className="lb-list">
              {rows.map((r, i) => (
                <li key={r.user_id} className={`lb-row ${me && r.name === me ? 'lb-me' : ''}`}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">
                    {classIcon(r.class)} {r.name}
                  </span>
                  <span className="lb-stage">stage {r.best_stage}</span>
                  <span className="lb-ess">◆ {formatNum(r.best_essence)}</span>
                </li>
              ))}
              {rows.length === 0 && <div className="lb-note">No scores yet — be the first!</div>}
            </ol>
          )}
        </div>

        <div className="sheet-foot">
          {err && <div className="lb-err">{err}</div>}
          {enabled &&
            (me ? (
              <div className="lb-signed">Signed in as <b>{me}</b> · your best auto-syncs</div>
            ) : (
              <button className="modal-btn" onClick={doSignIn} disabled={busy}>
                {busy ? 'Opening browser…' : 'Sign in with Google'}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
