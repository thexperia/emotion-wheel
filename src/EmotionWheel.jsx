import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBPOJDDStveJFvI67HPUiKeJxFjikRGzVI",
  authDomain: "emotion-wheel-915ef.firebaseapp.com",
  databaseURL: "https://emotion-wheel-915ef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "emotion-wheel-915ef",
  storageBucket: "emotion-wheel-915ef.firebasestorage.app",
  messagingSenderId: "603588267453",
  appId: "1:603588267453:web:ff409fef9b2ac75af516d4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================================
// DATA EMOSI (Bahasa Indonesia)
// ============================================================
const EMOTIONS = {
  bahagia: {
    label: "BAHAGIA", color: "#E8544A", lightColor: "#F5A89A",
    angle: -150, span: 60, emoji: "😄",
    sub: ["Bersemangat", "Optimis", "Percaya Diri", "Gembira", "Bersyukur"]
  },
  takut: {
    label: "TAKUT", color: "#E8A838", lightColor: "#F5D08A",
    angle: -90, span: 60, emoji: "😱",
    sub: ["Khawatir", "Gelisah", "Diabaikan", "Tertekan", "Pasrah"]
  },
  dicintai: {
    label: "DICINTAI", color: "#E88FAA", lightColor: "#F5C4D0",
    angle: -30, span: 60, emoji: "🥰",
    sub: ["Diakui", "Disayangi", "Dipercaya", "Nyaman", "Diapresiasi"]
  },
  marah: {
    label: "MARAH", color: "#5B5B9E", lightColor: "#A0A0CC",
    angle: 30, span: 60, emoji: "😤",
    sub: ["Muak", "Kecewa", "Kesal", "Tersinggung", "Iri"]
  },
  sedih: {
    label: "SEDIH", color: "#7BAED4", lightColor: "#B8D4EC",
    angle: 90, span: 60, emoji: "😢",
    sub: ["Kecewa", "Menyesal", "Terluka", "Kehilangan", "Kesepian"]
  },
  cemas: {
    label: "CEMAS", color: "#88B888", lightColor: "#B8D8B8",
    angle: 150, span: 60, emoji: "😰",
    sub: ["Canggung", "Kewalahan", "Terbebani", "Galau", "Stres"]
  },
};

const EMOTION_KEYS = Object.keys(EMOTIONS);
const INNER_R = 80, MID_R = 170, OUTER_R = 270, CX = 300, CY = 300;
const ADMIN_PASSWORD = "admin123";
const DOT_COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F43","#F368E0","#00D2D3"];

// ============================================================
// HELPERS
// ============================================================
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx, cy, r1, r2, a1, a2) {
  const s1 = polar(cx, cy, r1, a1), e1 = polar(cx, cy, r1, a2);
  const s2 = polar(cx, cy, r2, a1), e2 = polar(cx, cy, r2, a2);
  const lg = a2 - a1 > 180 ? 1 : 0;
  return `M${s1.x} ${s1.y} A${r1} ${r1} 0 ${lg} 1 ${e1.x} ${e1.y} L${e2.x} ${e2.y} A${r2} ${r2} 0 ${lg} 0 ${s2.x} ${s2.y}Z`;
}

function midPoint(cx, cy, r, a1, a2) {
  const mid = (a1 + a2) / 2;
  const rad = ((mid - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle: mid };
}

function dotPosition(cx, cy, startAngle, endAngle, index, total) {
  const midA = (startAngle + endAngle) / 2;
  const spread = (endAngle - startAngle) * 0.35;
  const rSpread = (OUTER_R - MID_R) * 0.3;
  const rMid = (MID_R + OUTER_R) / 2;
  const angleOffset = total <= 1 ? 0 : ((index / (total - 1)) - 0.5) * spread;
  const rOffset = (((index * 7) % 5) / 5 - 0.5) * rSpread;
  const angle = midA + angleOffset;
  const r = rMid + rOffset;
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ============================================================
// FIREBASE STORAGE
// ============================================================
const DB_PATH = "votes";

async function loadVotes() {
  try {
    const snapshot = await get(ref(db, DB_PATH));
    return snapshot.exists() ? snapshot.val() : {};
  } catch { return {}; }
}

async function saveVotes(votes) {
  try {
    await set(ref(db, DB_PATH), votes);
  } catch (e) { console.error(e); }
}

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function EmotionWheel() {
  const [votes, setVotes] = useState({});
  const [myVote, setMyVote] = useState(() => localStorage.getItem("ew_myVote") || null);
  const [myId] = useState(() => {
    let id = localStorage.getItem("ew_myId");
    if (!id) { id = "user_" + Math.random().toString(36).slice(2, 9); localStorage.setItem("ew_myId", id); }
    return id;
  });
  const [myColor] = useState(() => {
    let color = localStorage.getItem("ew_myColor");
    if (!color) { color = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)]; localStorage.setItem("ew_myColor", color); }
    return color;
  });
  const [selected, setSelected] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const votesRef = ref(db, DB_PATH);
    const unsubscribe = onValue(votesRef, (snapshot) => {
      const data = snapshot.exists() ? snapshot.val() : {};
      setVotes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const handleVote = useCallback(async (emotionKey, subLabel) => {
    const key = `${emotionKey}:${subLabel}`;
    const fresh = await loadVotes();

    if (myVote) {
      if (fresh[myVote]) {
        fresh[myVote] = fresh[myVote].filter(d => d.id !== myId);
        if (fresh[myVote].length === 0) delete fresh[myVote];
      }
    }

    if (myVote === key) {
      setMyVote(null);
      localStorage.removeItem("ew_myVote");
      await saveVotes(fresh);
      setVotes({ ...fresh });
      showToast("Pilihan dicabut");
      return;
    }

    if (!fresh[key]) fresh[key] = [];
    fresh[key].push({ id: myId, color: myColor });
    setMyVote(key);
    localStorage.setItem("ew_myVote", key);
    await saveVotes(fresh);
    setVotes({ ...fresh });
    showToast(`Kamu memilih: ${subLabel}`);
  }, [myVote, myId, myColor]);

  async function handleReset() {
    if (pwInput === ADMIN_PASSWORD) {
      await saveVotes({});
      setVotes({});
      setMyVote(null);
      localStorage.removeItem("ew_myVote");
      setPwInput("");
      setShowAdmin(false);
      setPwError(false);
      showToast("✅ Data berhasil direset!");
    } else {
      setPwError(true);
    }
  }

  function countByEmotion(key) {
    return Object.entries(votes)
      .filter(([k]) => k.startsWith(key + ":"))
      .reduce((sum, [, arr]) => sum + arr.length, 0);
  }

  const totalVotes = Object.values(votes).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #fdf6ee 0%, #f0e8f5 50%, #e8f4f8 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", fontFamily: "'Nunito', sans-serif",
      padding: "24px 16px 40px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Baloo+2:wght@700;800&display=swap');
        .sec { transition: filter 0.18s, opacity 0.18s; cursor: pointer; }
        .sec:hover { filter: brightness(1.13) drop-shadow(0 2px 10px rgba(0,0,0,0.18)); }
        .btn { transition: all 0.18s; border: none; cursor: pointer; font-family: inherit; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
        .toast { animation: fadeUp 0.3s ease; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:100; }
        .modal { background:white; border-radius:20px; padding:28px 32px; width:320px; box-shadow:0 8px 40px rgba(0,0,0,0.2); }
      `}</style>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Baloo 2',cursive", fontSize: "clamp(18px,3.5vw,28px)", fontWeight: 800, color: "#3d2c5e", margin: 0 }}>
          D'Specialist Emotional Spectrum
        </h1>
        <p style={{ color: "#7a6b9a", fontSize: 13, margin: "8px auto 0", fontWeight: 500, maxWidth: 500, lineHeight: 1.6 }}>
          Yth Bapak/Ibu D'Specialist, silahkan pilih emosi yang paling menggambarkan perasaan Anda minggu ini.
        </p>
        <p style={{ color: "#b0a8c0", fontSize: 11, margin: "4px auto 0", maxWidth: 480, lineHeight: 1.5, fontStyle: "italic" }}>
          Data bersifat anonim — admin ataupun user tidak memiliki akses terhadap sumber data.
        </p>
        <p style={{ color: "#a0a0a0", fontSize: 13, margin: "6px 0 0" }}>
          Total responden: <strong style={{ color: "#5B5B9E" }}>{totalVotes} pegawai</strong>
          {myVote && <span style={{ color: "#059669", marginLeft: 10 }}>• Kamu sudah memilih ✓</span>}
        </p>
      </div>

      {/* COUNTER BADGE PER EMOSI */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16, maxWidth: 600 }}>
        {EMOTION_KEYS.map(key => {
          const em = EMOTIONS[key];
          const count = countByEmotion(key);
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "white", borderRadius: 20, padding: "5px 12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: `2px solid ${em.color}44`,
            }}>
              <span style={{ fontSize: 16 }}>{em.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: em.color }}>{em.label}</span>
              <span style={{
                background: count > 0 ? em.color : "#E5E7EB",
                color: count > 0 ? "white" : "#9CA3AF",
                borderRadius: 10, padding: "1px 8px", fontSize: 12, fontWeight: 800,
              }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* WHEEL */}
      <div style={{
        background: "white", borderRadius: "50%", padding: 8,
        boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
        width: "min(560px,92vw)", height: "min(560px,92vw)",
      }}>
        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#7a6b9a", fontWeight:700, fontSize:16 }}>
            ⏳ Memuat data...
          </div>
        ) : (
          <svg viewBox="0 0 600 600" width="100%" height="100%" style={{ display: "block" }}>
            {EMOTION_KEYS.map(key => {
              const em = EMOTIONS[key];
              const startA = em.angle - em.span / 2;
              const isSelected = selected === key;

              return (
                <g key={key}>
                  {/* Inner sector */}
                  <path
                    className="sec"
                    d={arc(CX, CY, INNER_R + 2, MID_R - 2, startA, em.angle + em.span / 2)}
                    fill={em.color} stroke="white" strokeWidth={3}
                    opacity={selected && !isSelected ? 0.5 : 1}
                    onClick={() => setSelected(selected === key ? null : key)}
                  />

                  {/* Sub sectors */}
                  {em.sub.map((sub, i) => {
                    const subSpan = em.span / em.sub.length;
                    const sA = startA + i * subSpan;
                    const eA = sA + subSpan;
                    const tp = midPoint(CX, CY, (MID_R + OUTER_R) / 2, sA, eA);
                    const rot = tp.angle > 90 && tp.angle < 270 ? tp.angle + 180 : tp.angle;
                    const voteKey = `${key}:${sub}`;
                    const isMyChoice = myVote === voteKey;

                    return (
                      <g key={i}>
                        <path
                          className="sec"
                          d={arc(CX, CY, MID_R + 1, OUTER_R, sA, eA)}
                          fill={isMyChoice ? em.color : em.lightColor}
                          stroke="white" strokeWidth={2}
                          opacity={selected && !isSelected ? 0.4 : 1}
                          onClick={() => handleVote(key, sub)}
                        />
                        {sub.includes(" ") ? (
                          <text
                            x={tp.x} y={tp.y}
                            textAnchor="middle"
                            transform={`rotate(${rot},${tp.x},${tp.y})`}
                            fontSize={isMyChoice ? 9 : 8}
                            fontWeight={isMyChoice ? "900" : "700"}
                            fontFamily="Nunito,sans-serif"
                            fill={isMyChoice ? "white" : "#3d2c5e"}
                            opacity={selected && !isSelected ? 0.4 : 1}
                            style={{ pointerEvents:"none", userSelect:"none" }}
                          >
                            {sub.split(" ").map((word, wi) => (
                              <tspan
                                key={wi}
                                x={tp.x}
                                dy={wi === 0 ? "-0.5em" : "1.1em"}
                              >{word}</tspan>
                            ))}
                          </text>
                        ) : (
                          <text
                            x={tp.x} y={tp.y}
                            textAnchor="middle" dominantBaseline="middle"
                            transform={`rotate(${rot},${tp.x},${tp.y})`}
                            fontSize={isMyChoice ? 10 : 9}
                            fontWeight={isMyChoice ? "900" : "700"}
                            fontFamily="Nunito,sans-serif"
                            fill={isMyChoice ? "white" : "#3d2c5e"}
                            opacity={selected && !isSelected ? 0.4 : 1}
                            style={{ pointerEvents:"none", userSelect:"none" }}
                          >{sub}</text>
                        )}
                      </g>
                    );
                  })}

                  {/* Inner label */}
                  {(() => {
                    const mid = (startA + em.angle + em.span / 2) / 2;
                    const r = (INNER_R + MID_R) / 2;
                    const rad = ((mid - 90) * Math.PI) / 180;
                    const tx = CX + r * Math.cos(rad), ty = CY + r * Math.sin(rad);
                    const rot = mid > 90 && mid < 270 ? mid + 180 : mid;
                    return (
                      <g style={{ pointerEvents:"none" }}>
                        <text x={tx} y={ty - 14} textAnchor="middle" dominantBaseline="middle"
                          transform={`rotate(${rot},${tx},${ty})`} fontSize={20} style={{ userSelect:"none" }}>
                          {em.emoji}
                        </text>
                        <text x={tx} y={ty + 10} textAnchor="middle" dominantBaseline="middle"
                          transform={`rotate(${rot},${tx},${ty + 10})`}
                          fontSize={9} fontWeight="900" fontFamily="Baloo 2,cursive" fill="white" style={{ userSelect:"none" }}>
                          {em.label}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* DOTS — render di atas semua sektor */}
            {EMOTION_KEYS.map(key => {
              const em = EMOTIONS[key];
              const startA = em.angle - em.span / 2;
              return em.sub.map((sub, i) => {
                const subSpan = em.span / em.sub.length;
                const sA = startA + i * subSpan;
                const eA = sA + subSpan;
                const voteKey = `${key}:${sub}`;
                const dotsHere = votes[voteKey] || [];
                return dotsHere.map((dot, di) => {
                  const pos = dotPosition(CX, CY, sA, eA, di, dotsHere.length);
                  const isMe = dot.id === myId;
                  return (
                    <g key={dot.id}>
                      <circle cx={pos.x} cy={pos.y} r={isMe ? 9 : 7}
                        fill={dot.color} stroke="white" strokeWidth={isMe ? 2.5 : 1.5}
                        opacity={0.92}
                        style={{ filter: isMe ? "drop-shadow(0 1px 4px rgba(0,0,0,0.3))" : "none" }}
                      />
                      {isMe && <circle cx={pos.x} cy={pos.y} r={3} fill="white" opacity={0.8} />}
                    </g>
                  );
                });
              });
            })}

            {/* Center */}
            <circle cx={CX} cy={CY} r={INNER_R - 2} fill="white" />
            <circle cx={CX} cy={CY} r={INNER_R - 8} fill="#fdf6ee" />
            <text x={CX} y={CY - 12} textAnchor="middle" dominantBaseline="middle" fontSize={28} style={{ userSelect:"none" }}>💭</text>
            <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight="800" fontFamily="Baloo 2,cursive" fill="#3d2c5e" style={{ userSelect:"none" }}>Aku</text>
            <text x={CX} y={CY + 22} textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight="800" fontFamily="Baloo 2,cursive" fill="#3d2c5e" style={{ userSelect:"none" }}>Merasa...</text>
          </svg>
        )}
      </div>

      <p style={{ color:"#7a6b9a", fontSize:13, marginTop:14, textAlign:"center", fontWeight:600 }}>
        👆 Klik sektor emosi untuk memilih · Klik lagi untuk membatalkan
      </p>

      {/* TOMBOL ADMIN */}
      <button className="btn" onClick={() => setShowAdmin(true)} style={{
        marginTop: 20, padding: "10px 22px", borderRadius: 24,
        background: "white", color: "#6B7280", fontWeight: 700, fontSize: 13,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "2px solid #E5E7EB",
      }}>
        🔐 Reset Data (Admin)
      </button>

      {/* MODAL ADMIN */}
      {showAdmin && (
        <div className="modal-bg" onClick={() => { setShowAdmin(false); setPwInput(""); setPwError(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:"0 0 8px", color:"#3d2c5e", fontFamily:"'Baloo 2',cursive" }}>🔐 Reset Data Admin</h3>
            <p style={{ color:"#6B7280", fontSize:14, margin:"0 0 16px" }}>
              Masukkan password admin untuk menghapus semua pilihan pegawai minggu ini.
            </p>
            <input
              type="password"
              placeholder="Password admin..."
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={e => e.key === "Enter" && handleReset()}
              style={{
                width:"100%", padding:"10px 14px", borderRadius:10, fontSize:15,
                border:`2px solid ${pwError ? "#EF4444" : "#E5E7EB"}`,
                outline:"none", boxSizing:"border-box", fontFamily:"inherit",
              }}
            />
            {pwError && <p style={{ color:"#EF4444", fontSize:13, margin:"6px 0 0" }}>❌ Password salah</p>}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button className="btn" onClick={handleReset} style={{
                flex:1, padding:"10px", borderRadius:12,
                background:"#EF4444", color:"white", fontWeight:700, fontSize:14,
              }}>Reset Sekarang</button>
              <button className="btn" onClick={() => { setShowAdmin(false); setPwInput(""); setPwError(false); }} style={{
                flex:1, padding:"10px", borderRadius:12,
                background:"#F3F4F6", color:"#374151", fontWeight:700, fontSize:14,
              }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{
          position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)",
          background:"#1F2937", color:"white", padding:"12px 24px",
          borderRadius:24, fontSize:14, fontWeight:700,
          boxShadow:"0 4px 20px rgba(0,0,0,0.25)", zIndex:200, whiteSpace:"nowrap",
        }}>{toast}</div>
      )}
    </div>
  );
}
