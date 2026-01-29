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
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const linkEl = document.getElementById("link");
const photoEl = document.getElementById("photo");

// chat ui
const chatFab = document.getElementById("chatFab");
const chatBadge = document.getElementById("chatBadge");
const chatDrawer = document.getElementById("chatDrawer");
const chatClose = document.getElementById("chatClose");
const chatBox = document.getElementById("chatBox");
const chatText = document.getElementById("chatText");
const btnSend = document.getElementById("btnSend");

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
   AUTH (persistência + telas)
========================= */
let currentUser = null;

// Persistência: não pedir login de novo no mesmo aparelho/navegador
await setPersistence(auth, browserLocalPersistence);

function showLogin(){
  authScreen.style.display = "block";
  appScreen.style.display = "none";
  if (chatFab) chatFab.style.display = "none";
  if (chatDrawer) chatDrawer.classList.remove("open");
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
    whoEl.textContent = user.displayName || "Usuário";
    authorEl.value = user.displayName || "";
    authorEl.disabled = true; // nome travado (evita fingir)
  } else {
    showLogin();
  }
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
   CLOUDINARY (foto opcional)
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

    const imgHtml = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}"
              style="width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--line);background:#0f1424"
              loading="lazy" alt="foto">`
      : "";

    const canDelete = currentUser && p.uid === currentUser.uid;
    const delBtnHtml = canDelete
      ? `<button class="btnDel" data-id="${postId}">Excluir</button>`
      : "";

    card.innerHTML = `
      <div class="meta" style="align-items:center">
        <span class="pill">📚 ${escapeHtml(p.subject || "Geral")}</span>
        <span class="pill">👤 ${escapeHtml(p.author || "Anon")}</span>
        <span class="pill">🕒 ${fmtDate(p.createdAt)}</span>
        ${delBtnHtml}
      </div>

      <p class="title" style="margin-top:10px">${escapeHtml(p.title || "Sem título")}</p>
      <p class="content">${escapeHtml(p.body || "")}</p>

      ${imgHtml}
      ${linkHtml}
    `;

    feedEl.appendChild(card);
  });
});

feedEl.addEventListener("click", async (e) => {
  const btnDel = e.target.closest(".btnDel");
  if (!btnDel) return;

  const id = btnDel.dataset.id;
  if (!confirm("Quer excluir esse post?")) return;

  try {
    await deleteDoc(doc(db, "posts", id));
  } catch (err) {
    console.error(err);
    alert("Não consegui excluir. Veja o Console (F12).");
  }
});

btnPost.addEventListener("click", async () => {
  if (!currentUser) return alert("Faça login.");

  const subject = subjectEl?.value || "Geral";
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  const link = linkEl.value.trim();

  if (!title || !body) return alert("Coloca pelo menos Título e Texto!");

  const file = photoEl?.files?.[0] || null;
  btnPost.disabled = true;
  statusEl.textContent = "Postando… ⏳";

  try {
    let imageUrl = "";
    if (file) imageUrl = await uploadToCloudinary(file);

    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      author: currentUser.displayName || "Usuário",
      subject,
      title,
      body,
      link: isValidUrl(link) ? link : "",
      imageUrl,
      createdAt: serverTimestamp()
    });

    titleEl.value = "";
    bodyEl.value = "";
    linkEl.value = "";
    if (photoEl) photoEl.value = "";

    statusEl.textContent = "Postado ✅";
    setTimeout(() => (statusEl.textContent = "Online ✅"), 1200);
  } catch (err) {
    console.error(err);
    alert("Erro ao postar: " + (err?.message || "desconhecido"));
    statusEl.textContent = "Erro ❌";
  } finally {
    btnPost.disabled = false;
  }
});

/* =========================
   CHAT (drawer + badge + editar/apagar)
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

    const canManage = currentUser && m.uid === currentUser.uid;
    const actions = canManage
      ? `<div class="chatActions">
           <button class="chatBtn chatEdit" data-id="${msgId}">Editar</button>
           <button class="chatBtn chatDel" data-id="${msgId}">Apagar</button>
         </div>`
      : "";

    const edited = m.editedAt ? " • editado" : "";

    div.innerHTML = `
      <div class="chatMeta">
        <span>👤 ${escapeHtml(m.author || "Anon")}</span>
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
