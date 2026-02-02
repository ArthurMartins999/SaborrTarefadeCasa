import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* =========================
   CONFIG FIREBASE
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDbfX_DvlefT_3TrTZPX9Me0RxDVAas_M0",
  authDomain: "as-tarefas.firebaseapp.com",
  projectId: "as-tarefas",
  storageBucket: "as-tarefas.firebasestorage.app",
  messagingSenderId: "1054687052156",
  appId: "1:1054687052156:web:d8440548f0a4ba029724f9",
  measurementId: "G-HSS8K8H14R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================
   ADMINS (SEUS UIDs)
========================= */
const ADMINS = [
  "jZvf3RDntVQxRFU9jRFi3hS4wjU2",
  "fMCWcyQ2odZZ05I480JEWZhiXts2"
];

let currentUser = null;
function isAdminUser(uid) { return ADMINS.includes(uid); }
function isAdmin() { return currentUser && isAdminUser(currentUser.uid); }
function admTagHtml(uid) { return isAdminUser(uid) ? ` <span class="badgeAdm">ADM</span>` : ""; }

/* =========================
   MATÉRIA -> PROFESSORES
========================= */
const SUBJECT_TEACHERS = {
  "Geral": [],
  "Matemática": ["Júlia", "Fernando", "Catenassi", "A1000🚗"],
  "Português": ["Marcela", "Michely"],
  "Física": ["Ramiro", "Sostag"],
  "Química": ["Iury", "Tércio"],
  "Biologia": ["Paulo Henrique", "Robyson"],
  "Geografia": ["Jibran", "Thelma"],
  "História": ["Itamar", "Melo"],
  "Inglês": ["Tom"]
};

function fillTeacherOptions(subjectValue) {
  const list = SUBJECT_TEACHERS[subjectValue] || [];
  teacherEl.innerHTML = `<option value="">Professor</option>`;

  if (!list.length) {
    teacherEl.disabled = true;
    teacherEl.innerHTML = `<option value="">Professor (opcional)</option>`;
    return;
  }

  list.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    teacherEl.appendChild(opt);
  });
  teacherEl.disabled = false;
}

/* =========================
   ELEMENTOS
========================= */
// telas
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("app");

// status
const statusEl = document.getElementById("status");
const whoEl = document.getElementById("who");

// auth ui
const authStatus = document.getElementById("authStatus");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");

// posts ui
const feedEl = document.getElementById("feed");
const btnPost = document.getElementById("btnPost");
const authorEl = document.getElementById("author");
const subjectEl = document.getElementById("subject");
const teacherEl = document.getElementById("teacher");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const linkEl = document.getElementById("link");
const photoEl = document.getElementById("photo");

// preview multi
const photoPreviewWrap = document.getElementById("photoPreviewWrap");
const photoPreviewList = document.getElementById("photoPreviewList");
const removeAllPhotos = document.getElementById("removeAllPhotos");

// chat ui
const chatFab = document.getElementById("chatFab");
const chatBadge = document.getElementById("chatBadge");
const chatDrawer = document.getElementById("chatDrawer");
const chatClose = document.getElementById("chatClose");
const chatBox = document.getElementById("chatBox");
const chatText = document.getElementById("chatText");
const btnSend = document.getElementById("btnSend");

// modal imagem
const imgModal = document.getElementById("imgModal");
const imgModalSrc = document.getElementById("imgModalSrc");
const imgModalClose = document.getElementById("imgModalClose");

/* =========================
   HELPERS
========================= */
function escapeHtml(s = "") {
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function fmtDate(ts){
  if(!ts) return "agora";
  return ts.toDate().toLocaleString("pt-BR");
}
function isValidUrl(u){
  try { return !!u && new URL(u).protocol.startsWith("http"); }
  catch { return false; }
}
function normalizeUser(u){
  return (u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}
function emailFromUser(user){
  const u = normalizeUser(user);
  return `${u}@grupo.local`;
}

/* =========================
   ✅ MULTI-IMAGENS
   - seleciona várias de uma vez
   - pode selecionar de novo e SOMAR
   - preview + remover 1 + remover todas
========================= */
let selectedFiles = [];

function syncInputFiles(){
  if (!photoEl) return;
  const dt = new DataTransfer();
  selectedFiles.forEach(f => dt.items.add(f));
  photoEl.files = dt.files;
}

function renderPreviews(){
  if (!photoPreviewWrap || !photoPreviewList) return;

  photoPreviewList.innerHTML = "";

  if (selectedFiles.length === 0) {
    photoPreviewWrap.hidden = true;
    return;
  }

  photoPreviewWrap.hidden = false;

  selectedFiles.forEach((file, idx) => {
    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "photoThumb";
    div.innerHTML = `
      <img src="${url}" alt="preview ${idx+1}">
      <button type="button" title="Remover">✕</button>
    `;

    div.querySelector("button").addEventListener("click", () => {
      selectedFiles.splice(idx, 1);
      syncInputFiles();
      renderPreviews();
    });

    photoPreviewList.appendChild(div);
  });
}

photoEl?.addEventListener("change", () => {
  const files = Array.from(photoEl.files || []);

  // valida
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      alert("Escolhe apenas imagens (JPG/PNG).");
      return;
    }
  }

  // ✅ SOMA seleções
  selectedFiles = [...selectedFiles, ...files];

  // evita duplicar pelo mesmo nome/tamanho (opcional)
  const uniq = [];
  const seen = new Set();
  for (const f of selectedFiles) {
    const key = `${f.name}-${f.size}-${f.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(f);
  }
  selectedFiles = uniq;

  syncInputFiles();
  renderPreviews();
});

removeAllPhotos?.addEventListener("click", () => {
  selectedFiles = [];
  if (photoEl) photoEl.value = "";
  renderPreviews();
});

/* =========================
   AUTH (persistência + telas)
========================= */
await setPersistence(auth, browserLocalPersistence);

function showLogin(){
  authScreen.style.display = "block";
  appScreen.style.display = "none";
  if (chatFab) chatFab.style.display = "none";
  if (chatDrawer) chatDrawer.classList.remove("open");
  document.body.classList.remove("modal-open");
}

function showApp(){
  authScreen.style.display = "none";
  appScreen.style.display = "block";
  if (chatFab) chatFab.style.display = "flex";
  statusEl.textContent = "Online ✅";
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  if (user) {
    showApp();

    const me = user.displayName || "Usuário";
    whoEl.textContent = me;

    authorEl.value = me;
    authorEl.disabled = true;

    fillTeacherOptions(subjectEl?.value || "Geral");

    if (isAdmin()) statusEl.textContent = "Online ✅ (ADM)";
  } else {
    showLogin();
  }
});

subjectEl?.addEventListener("change", () => {
  fillTeacherOptions(subjectEl.value);
});

// Criar conta
btnSignup.addEventListener("click", async () => {
  const user = normalizeUser(usernameEl.value);
  const pass = passwordEl.value;

  if (!user || user.length < 3) return alert("Usuário muito curto (mínimo 3).");
  if (!pass || pass.length < 6) return alert("Senha fraca (mínimo 6).");

  authStatus.textContent = "Criando conta…";
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailFromUser(user), pass);
    await updateProfile(cred.user, { displayName: user });
    passwordEl.value = "";
    authStatus.textContent = "Conta criada ✅";
  } catch (e) {
    console.error(e);
    authStatus.textContent = "Erro ❌";
    alert("Não consegui criar. Talvez esse usuário já existe.");
  }
});

// Entrar
btnLogin.addEventListener("click", async () => {
  const user = normalizeUser(usernameEl.value);
  const pass = passwordEl.value;

  if (!user || !pass) return alert("Preenche usuário e senha.");

  authStatus.textContent = "Entrando…";
  try {
    await signInWithEmailAndPassword(auth, emailFromUser(user), pass);
    passwordEl.value = "";
    authStatus.textContent = "Entrou ✅";
  } catch (e) {
    console.error(e);
    authStatus.textContent = "Erro ❌";
    alert("Não consegui entrar. Usuário ou senha inválidos.");
  }
});

// Sair
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

/* =========================
   CLOUDINARY (multi upload)
========================= */
async function uploadToCloudinary(file){
  const CLOUD_NAME = "ddlnf32a6";
  const UPLOAD_PRESET = "insta_grupo_unsigned_v2";

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(url, { method:"POST", body: form });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok){
    console.error("Cloudinary error:", data);
    throw new Error(data?.error?.message || "Erro ao subir imagem");
  }
  return data.secure_url;
}

/* =========================
   POSTS (feed + criar + excluir)
   - compat: post antigo com imageUrl
   - novo: imageUrls []
========================= */
const postsQ = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(postsQ, (snap) => {
  feedEl.innerHTML = "";

  if (snap.empty) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Ainda não tem posts. Publique a primeira tarefa 😄";
    feedEl.appendChild(empty);
    return;
  }

  snap.forEach((docSnap) => {
    const p = docSnap.data();
    const postId = docSnap.id;

    const card = document.createElement("div");
    card.className = "card";

    const linkHtml = isValidUrl(p.link)
      ? `<div class="meta"><span class="pill">🔗 <a href="${escapeHtml(p.link)}" target="_blank" rel="noreferrer">Abrir link</a></span></div>`
      : "";

    // ✅ compatibilidade
    const urls = Array.isArray(p.imageUrls)
      ? p.imageUrls
      : (p.imageUrl ? [p.imageUrl] : []);

    const imgsHtml = urls.length
      ? `<div class="postImgs">
          ${urls.map(u => `
            <img
              src="${escapeHtml(u)}"
              class="postImg"
              data-src="${escapeHtml(u)}"
              loading="lazy"
              alt="foto"
            >
          `).join("")}
        </div>`
      : "";

    const canDelete = currentUser && (p.uid === currentUser.uid || isAdmin());
    const delBtnHtml = canDelete
      ? `<button class="btnDel" data-id="${postId}">Excluir</button>`
      : "";

    const teacherHtml = p.teacher
      ? `<span class="pill">👨‍🏫 ${escapeHtml(p.teacher)}</span>`
      : ``;

    card.innerHTML = `
      <div class="meta" style="align-items:center">
        <span class="pill">📚 ${escapeHtml(p.subject || "Geral")}</span>
        ${teacherHtml}
        <span class="pill">
          👤 ${escapeHtml(p.author || "Anon")}
          ${admTagHtml(p.uid)}
        </span>
        <span class="pill">🕒 ${fmtDate(p.createdAt)}</span>
        ${delBtnHtml}
      </div>

      <p class="title" style="margin-top:12px">${escapeHtml(p.title || "Sem título")}</p>
      <p class="content">${escapeHtml(p.body || "")}</p>

      ${imgsHtml}
      ${linkHtml}
    `;

    feedEl.appendChild(card);
  });
});

// click feed: excluir OU abrir modal
feedEl.addEventListener("click", async (e) => {
  const btnDel = e.target.closest(".btnDel");
  if (btnDel) {
    const id = btnDel.dataset.id;
    if (!confirm("Quer excluir esse post?")) return;

    try {
      await deleteDoc(doc(db, "posts", id));
    } catch (err) {
      console.error(err);
      alert("Não consegui excluir. Veja o Console (F12).");
    }
    return;
  }

  const img = e.target.closest(".postImg");
  if (img) {
    const src = img.getAttribute("data-src") || img.src;
    openModalWithSrc(src);
  }
});

btnPost.addEventListener("click", async () => {
  if (!currentUser) return alert("Faça login.");

  const subject = subjectEl?.value || "Geral";
  const teacher = teacherEl?.disabled ? "" : (teacherEl?.value || "");
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  const link = linkEl.value.trim();

  if (!title || !body) return alert("Coloca pelo menos Título e Texto!");

  const files = [...selectedFiles];

  btnPost.disabled = true;
  statusEl.textContent = "Postando… ⏳";

  try {
    let imageUrls = [];
    if (files.length) {
      imageUrls = await Promise.all(files.map(uploadToCloudinary));
    }

    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      author: currentUser.displayName || "Usuário",
      subject,
      teacher,
      title,
      body,
      link: isValidUrl(link) ? link : "",
      imageUrls,
      createdAt: serverTimestamp()
    });

    titleEl.value = "";
    bodyEl.value = "";
    linkEl.value = "";
    if (photoEl) photoEl.value = "";
    if (!teacherEl.disabled) teacherEl.value = "";

    selectedFiles = [];
    renderPreviews();

    statusEl.textContent = "Postado ✅";
    setTimeout(() => (statusEl.textContent = isAdmin() ? "Online ✅ (ADM)" : "Online ✅"), 1200);
  } catch (err) {
    console.error(err);
    alert("Erro ao postar: " + (err?.message || "desconhecido"));
    statusEl.textContent = "Erro ❌";
  } finally {
    btnPost.disabled = false;
  }
});

/* =========================
   MODAL + ZOOM/PAN (SEM BUG)
========================= */
let zoomScale = 1;
let panX = 0;
let panY = 0;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function applyTransform(){
  if (!imgModalSrc) return;
  imgModalSrc.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

function resetZoom(){
  zoomScale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
  if (imgModalSrc) imgModalSrc.style.cursor = "zoom-in";
}

function openModalWithSrc(src){
  if (!imgModal || !imgModalSrc) return;

  imgModal.classList.add("open");
  imgModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  imgModalSrc.src = src;
  resetZoom();
}

function closeModal(){
  if (!imgModal || !imgModalSrc) return;

  imgModal.classList.remove("open");
  imgModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  imgModalSrc.src = "about:blank";
  resetZoom();
}

imgModalClose?.addEventListener("click", closeModal);
imgModal?.addEventListener("click", (e) => { if (e.target === imgModal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imgModal?.classList.contains("open")) closeModal();
});

// zoom scroll
imgModal?.addEventListener("wheel", (e) => {
  if (!imgModal.classList.contains("open")) return;
  e.preventDefault();

  const delta = Math.sign(e.deltaY);
  const factor = delta > 0 ? 0.9 : 1.1;
  zoomScale = clamp(zoomScale * factor, 1, 4);

  if (zoomScale === 1) { panX = 0; panY = 0; }

  imgModalSrc.style.cursor = (zoomScale > 1 ? "grab" : "zoom-in");
  applyTransform();
}, { passive: false });

// pan
imgModalSrc?.addEventListener("pointerdown", (e) => {
  if (!imgModal?.classList.contains("open")) return;
  if (zoomScale <= 1) return;

  isPanning = true;
  imgModalSrc.setPointerCapture(e.pointerId);
  panStartX = e.clientX - panX;
  panStartY = e.clientY - panY;
  imgModalSrc.style.cursor = "grabbing";
});

imgModalSrc?.addEventListener("pointermove", (e) => {
  if (!isPanning) return;
  panX = e.clientX - panStartX;
  panY = e.clientY - panStartY;
  applyTransform();
});

function stopPan(){
  isPanning = false;
  if (imgModalSrc) imgModalSrc.style.cursor = (zoomScale > 1 ? "grab" : "zoom-in");
}
imgModalSrc?.addEventListener("pointerup", stopPan);
imgModalSrc?.addEventListener("pointercancel", stopPan);

// dblclick 1x <-> 2x
imgModalSrc?.addEventListener("dblclick", (e) => {
  if (!imgModal?.classList.contains("open")) return;
  e.preventDefault();

  if (zoomScale === 1) {
    zoomScale = 2;
  } else {
    zoomScale = 1;
    panX = 0; panY = 0;
  }
  stopPan();
  applyTransform();
});

/* =========================
   CHAT (drawer + badge)
========================= */
let chatOpen = false;
let unread = 0;
let lastSeenMsgId = null;

function setBadge(n){
  unread = n;
  if (!chatBadge) return;
  if (n <= 0) {
    chatBadge.hidden = true;
    chatBadge.textContent = "0";
  } else {
    chatBadge.hidden = false;
    chatBadge.textContent = n > 99 ? "99+" : String(n);
  }
}

function openChat(){
  chatOpen = true;
  chatDrawer.classList.add("open");
  chatDrawer.setAttribute("aria-hidden", "false");
  setBadge(0);
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

function closeChat(){
  chatOpen = false;
  chatDrawer.classList.remove("open");
  chatDrawer.setAttribute("aria-hidden", "true");
}

chatFab?.addEventListener("click", () => chatOpen ? closeChat() : openChat());
chatClose?.addEventListener("click", closeChat);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeChat(); });

/* =========================
   CHAT (tempo real + enviar + editar + apagar)
========================= */
const chatQ = query(collection(db, "messages"), orderBy("createdAt", "asc"));

onSnapshot(chatQ, (snap) => {
  chatBox.innerHTML = "";

  if (snap.empty) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Sem mensagens ainda. Manda a primeira 👇";
    chatBox.appendChild(empty);
    return;
  }

  let newestIdThisRender = null;

  snap.forEach((docSnap) => {
    const m = docSnap.data();
    const msgId = docSnap.id;
    newestIdThisRender = msgId;

    const div = document.createElement("div");
    div.className = "chatMsg";

    const canManage = currentUser && (m.uid === currentUser.uid || isAdmin());

    const actions = canManage
      ? `<div class="chatActions">
           <button class="chatBtn chatEdit" data-id="${msgId}">Editar</button>
           <button class="chatBtn chatDel" data-id="${msgId}">Apagar</button>
         </div>`
      : "";

    const edited = m.editedAt ? " • editado" : "";

    div.innerHTML = `
      <div class="chatMeta">
        <span>
          👤 ${escapeHtml(m.author || "Anon")}
          ${admTagHtml(m.uid)}
        </span>
        <span>🕒 ${fmtDate(m.createdAt)}${edited}</span>
      </div>
      <div class="chatText" style="white-space:pre-wrap">${escapeHtml(m.text || "")}</div>
      ${actions}
    `;

    chatBox.appendChild(div);
  });

  if (newestIdThisRender && lastSeenMsgId && newestIdThisRender !== lastSeenMsgId) {
    if (!chatOpen) setBadge(unread + 1);
  }
  if (!lastSeenMsgId) setBadge(0);
  lastSeenMsgId = newestIdThisRender;

  if (chatOpen) {
    chatBox.scrollTop = chatBox.scrollHeight;
    setBadge(0);
  }
});

// enviar
btnSend.addEventListener("click", async () => {
  if (!currentUser) return alert("Faça login.");

  const text = chatText.value.trim();
  if (!text) return;

  btnSend.disabled = true;
  try {
    await addDoc(collection(db, "messages"), {
      uid: currentUser.uid,
      author: currentUser.displayName || "Usuário",
      text,
      createdAt: serverTimestamp(),
      editedAt: null
    });
    chatText.value = "";
    if (chatOpen) setBadge(0);
  } catch (e) {
    console.error(e);
    alert("Erro ao enviar mensagem");
  } finally {
    btnSend.disabled = false;
  }
});

// Enter envia (Shift+Enter quebra linha)
chatText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btnSend.click();
  }
});

// editar/apagar
chatBox.addEventListener("click", async (e) => {
  const del = e.target.closest(".chatDel");
  const edit = e.target.closest(".chatEdit");

  if (del) {
    const id = del.dataset.id;
    if (!confirm("Apagar essa mensagem?")) return;
    try { await deleteDoc(doc(db, "messages", id)); }
    catch (err) { console.error(err); alert("Não consegui apagar."); }
    return;
  }

  if (edit) {
    const id = edit.dataset.id;
    const msgEl = edit.closest(".chatMsg")?.querySelector(".chatText");
    const currentText = msgEl?.textContent ?? "";

    const newText = prompt("Editar mensagem:", currentText);
    if (newText === null) return;
    const trimmed = newText.trim();
    if (!trimmed) return alert("A mensagem não pode ficar vazia.");

    try {
      await updateDoc(doc(db, "messages", id), {
        text: trimmed,
        editedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert("Não consegui editar.");
    }
  }
});
