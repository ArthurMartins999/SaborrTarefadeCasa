import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   CONFIG
   -> COLE AQUI A SUA CONFIG ORIGINAL DO FIREBASE E CLOUDINARY
========================================================= */
const CONFIG = {

  firebase: {
    apiKey: "AIzaSyDbfX_DvlefT_3TrTZPX9Me0RxDVAas_M0",
    authDomain: "as-tarefas.firebaseapp.com",
    projectId: "as-tarefas",
    storageBucket: "as-tarefas.firebasestorage.app",
    messagingSenderId: "1054687052156",
    appId: "1:1054687052156:web:d8440548f0a4ba029724f9",
    measurementId: "G-HSS8K8H14R"
  },

  admins: [
    // coloque UIDs admin aqui se quiser
  ],

  subjectTeachers: {
    "Geral": [],
    "Matemática": ["Júlia", "Fernando", "Catenassi", "A1000🚗"],
    "Português": ["Marcela", "Michely"],
    "Física": ["Ramiro", "Sostag"],
    "Química": ["Iury", "Tércio"],
    "Biologia": ["Paulo Henrique", "Robyson"],
    "Geografia": ["Jibran", "Thelma"],
    "História": ["Itamar", "Melo"],
    "Inglês": ["Tom"]
  }
};

/* =========================================================
   APP STATE
========================================================= */
const STATE = {
  user: null,

  uploads: {
    selectedFiles: []
  },

  chat: {
    open: false,
    unread: 0,
    lastSeenId: null
  },

  ai: {
    open: false,
    messages: []
  },

  modal: {
    open: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    panning: false,
    panStartX: 0,
    panStartY: 0
  }
};

/* =========================================================
   INIT FIREBASE
========================================================= */
const app = initializeApp(CONFIG.firebase);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================================================
   DOM CACHE
========================================================= */
const el = {
  // screens
  authScreen: document.getElementById("authScreen"),
  appScreen: document.getElementById("app"),

  // header
  status: document.getElementById("status"),
  who: document.getElementById("who"),

  // auth
  authStatus: document.getElementById("authStatus"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  btnLogin: document.getElementById("btnLogin"),
  btnSignup: document.getElementById("btnSignup"),
  btnLogout: document.getElementById("btnLogout"),

  // post form
  feed: document.getElementById("feed"),
  btnPost: document.getElementById("btnPost"),
  author: document.getElementById("author"),
  subject: document.getElementById("subject"),
  teacher: document.getElementById("teacher"),
  title: document.getElementById("title"),
  body: document.getElementById("body"),
  link: document.getElementById("link"),
  photo: document.getElementById("photo"),

  // preview multi
  photoPreviewWrap: document.getElementById("photoPreviewWrap"),
  photoPreviewList: document.getElementById("photoPreviewList"),
  removeAllPhotos: document.getElementById("removeAllPhotos"),

  // chat do grupo
  chatFab: document.getElementById("chatFab"),
  chatBadge: document.getElementById("chatBadge"),
  chatDrawer: document.getElementById("chatDrawer"),
  chatClose: document.getElementById("chatClose"),
  chatBox: document.getElementById("chatBox"),
  chatText: document.getElementById("chatText"),
  btnSend: document.getElementById("btnSend"),

  // modal image
  imgModal: document.getElementById("imgModal"),
  imgModalSrc: document.getElementById("imgModalSrc"),
  imgModalClose: document.getElementById("imgModalClose"),

  // IA
  aiFab: document.getElementById("aiFab"),
  aiDrawer: document.getElementById("aiDrawer"),
  aiClose: document.getElementById("aiClose"),
  aiBox: document.getElementById("aiBox"),
  aiText: document.getElementById("aiText"),
  btnAiSend: document.getElementById("btnAiSend")
};

/* =========================================================
   UTILS
========================================================= */
const utils = {
  escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  },

  fmtDate(ts) {
    if (!ts) return "agora";
    try {
      return ts.toDate().toLocaleString("pt-BR");
    } catch {
      return "agora";
    }
  },

  isValidUrl(u) {
    try {
      return !!u && new URL(u).protocol.startsWith("http");
    } catch {
      return false;
    }
  },

  normalizeUser(u) {
    return (u || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");
  },

  emailFromUser(user) {
    const u = utils.normalizeUser(user);
    return `${u}@grupo.local`;
  },

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  isAdminUser(uid) {
    return CONFIG.admins.includes(uid);
  },

  isAdmin() {
    return !!(STATE.user && utils.isAdminUser(STATE.user.uid));
  },

  admTagHtml(uid) {
    return utils.isAdminUser(uid) ? ` <span class="badgeAdm">ADM</span>` : "";
  },

  setStatus(text) {
    if (el.status) el.status.textContent = text;
  },

  safeAlert(msg) {
    alert(msg);
  }
};

/* =========================================================
   SERVICES
========================================================= */
const services = {
  auth: {
    async initPersistence() {
      await setPersistence(auth, browserLocalPersistence);
    },

    async signup(user, pass) {
      const u = utils.normalizeUser(user);
      if (!u || u.length < 3) throw new Error("Usuário muito curto (mínimo 3).");
      if (!pass || pass.length < 6) throw new Error("Senha fraca (mín. 6).");

      const cred = await createUserWithEmailAndPassword(auth, utils.emailFromUser(u), pass);
      await updateProfile(cred.user, { displayName: u });
      return cred.user;
    },

    async login(user, pass) {
      const u = utils.normalizeUser(user);
      if (!u || !pass) throw new Error("Preenche usuário e senha.");
      await signInWithEmailAndPassword(auth, utils.emailFromUser(u), pass);
    },

    async logout() {
      await signOut(auth);
    }
  },

  upload: {
    async toCloudinary(file) {
      const { cloudName, uploadPreset } = CONFIG.cloudinary;
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", uploadPreset);

      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Cloudinary error:", data);
        throw new Error(data?.error?.message || "Erro ao subir imagem");
      }

      return data.secure_url;
    }
  },

  db: {
    listenPosts(onChange) {
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      return onSnapshot(q, onChange);
    },

    async addPost(payload) {
      await addDoc(collection(db, "posts"), payload);
    },

    async deletePost(postId) {
      await deleteDoc(doc(db, "posts", postId));
    },

    listenChat(onChange) {
      const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
      return onSnapshot(q, onChange);
    },

    async sendChatMessage(payload) {
      await addDoc(collection(db, "messages"), payload);
    },

    async deleteChatMessage(msgId) {
      await deleteDoc(doc(db, "messages", msgId));
    },

    async editChatMessage(msgId, payload) {
      await updateDoc(doc(db, "messages", msgId), payload);
    },

    async getAiChat(uid) {
      const snap = await getDoc(doc(db, "ai_chats", uid));
      return snap.exists() ? snap.data() : { messages: [] };
    },

    async saveAiChat(uid, messages) {
      await setDoc(
        doc(db, "ai_chats", uid),
        {
          uid,
          messages,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  }
};

/* =========================================================
   UI (Screens)
========================================================= */
const ui = {
  showLogin() {
    el.authScreen.style.display = "block";
    el.appScreen.style.display = "none";

    if (el.chatFab) el.chatFab.style.display = "none";
    if (el.chatDrawer) el.chatDrawer.classList.remove("open");

    if (el.aiFab) el.aiFab.style.display = "none";
    if (el.aiDrawer) el.aiDrawer.classList.remove("open");

    modal.close();
  },

  showApp() {
    el.authScreen.style.display = "none";
    el.appScreen.style.display = "block";

    if (el.chatFab) el.chatFab.style.display = "flex";
    if (el.aiFab) el.aiFab.style.display = "flex";

    utils.setStatus(utils.isAdmin() ? "Online ✅ (ADM)" : "Online ✅");
  }
};

/* =========================================================
   FEATURE: Teachers
========================================================= */
const teachers = {
  fill(subjectValue) {
    if (!el.teacher) return;

    const list = CONFIG.subjectTeachers[subjectValue] || [];
    el.teacher.innerHTML = `<option value="">Professor</option>`;

    if (!list.length) {
      el.teacher.disabled = true;
      el.teacher.innerHTML = `<option value="">Professor (opcional)</option>`;
      return;
    }

    list.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      el.teacher.appendChild(opt);
    });

    el.teacher.disabled = false;
  },

  init() {
    teachers.fill(el.subject?.value || "Geral");
    el.subject?.addEventListener("change", () => teachers.fill(el.subject.value));
  }
};

/* =========================================================
   FEATURE: Uploads Multi
========================================================= */
const uploads = {
  _syncInput() {
    if (!el.photo) return;
    const dt = new DataTransfer();
    STATE.uploads.selectedFiles.forEach((f) => dt.items.add(f));
    el.photo.files = dt.files;
  },

  _dedupeFiles(files) {
    const uniq = [];
    const seen = new Set();

    for (const f of files) {
      const key = `${f.name}-${f.size}-${f.lastModified}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(f);
    }

    return uniq;
  },

  clearAll() {
    STATE.uploads.selectedFiles = [];
    if (el.photo) el.photo.value = "";
    uploads.render();
  },

  removeAt(index) {
    STATE.uploads.selectedFiles.splice(index, 1);
    uploads._syncInput();
    uploads.render();
  },

  onPick() {
    const files = Array.from(el.photo?.files || []);

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        utils.safeAlert("Escolhe apenas imagens (JPG/PNG).");
        return;
      }
    }

    STATE.uploads.selectedFiles = uploads._dedupeFiles([
      ...STATE.uploads.selectedFiles,
      ...files
    ]);

    uploads._syncInput();
    uploads.render();
  },

  render() {
    if (!el.photoPreviewWrap || !el.photoPreviewList) return;

    el.photoPreviewList.innerHTML = "";

    if (STATE.uploads.selectedFiles.length === 0) {
      el.photoPreviewWrap.hidden = true;
      return;
    }

    el.photoPreviewWrap.hidden = false;

    STATE.uploads.selectedFiles.forEach((file, idx) => {
      const url = URL.createObjectURL(file);

      const div = document.createElement("div");
      div.className = "photoThumb";
      div.innerHTML = `
        <img src="${url}" alt="preview ${idx + 1}">
        <button type="button" title="Remover">✕</button>
      `;

      div.querySelector("button")?.addEventListener("click", () => uploads.removeAt(idx));
      el.photoPreviewList.appendChild(div);
    });
  },

  init() {
    el.photo?.addEventListener("change", () => uploads.onPick());
    el.removeAllPhotos?.addEventListener("click", () => uploads.clearAll());
  }
};

/* =========================================================
   FEATURE: Modal (zoom / pan)
========================================================= */
const modal = {
  apply() {
    if (!el.imgModalSrc) return;
    const m = STATE.modal;
    el.imgModalSrc.style.transform = `translate(${m.panX}px, ${m.panY}px) scale(${m.zoom})`;
  },

  reset() {
    STATE.modal.zoom = 1;
    STATE.modal.panX = 0;
    STATE.modal.panY = 0;
    STATE.modal.panning = false;
    modal.apply();
  },

  open(src) {
    if (!el.imgModal || !el.imgModalSrc) return;
    STATE.modal.open = true;
    el.imgModal.style.display = "flex";
    el.imgModal.setAttribute("aria-hidden", "false");
    el.imgModalSrc.src = src;
    modal.reset();
  },

  close() {
    if (!el.imgModal || !el.imgModalSrc) return;
    STATE.modal.open = false;
    el.imgModal.style.display = "none";
    el.imgModal.setAttribute("aria-hidden", "true");
    el.imgModalSrc.src = "";
    modal.reset();
  },

  onWheel(e) {
    if (!STATE.modal.open) return;
    e.preventDefault();

    const next = STATE.modal.zoom + (e.deltaY < 0 ? 0.12 : -0.12);
    STATE.modal.zoom = utils.clamp(next, 1, 4);
    modal.apply();
  },

  onPointerDown(e) {
    if (!STATE.modal.open || STATE.modal.zoom <= 1) return;
    STATE.modal.panning = true;
    STATE.modal.panStartX = e.clientX - STATE.modal.panX;
    STATE.modal.panStartY = e.clientY - STATE.modal.panY;
    el.imgModalSrc?.setPointerCapture?.(e.pointerId);
  },

  onPointerMove(e) {
    if (!STATE.modal.open || !STATE.modal.panning) return;
    STATE.modal.panX = e.clientX - STATE.modal.panStartX;
    STATE.modal.panY = e.clientY - STATE.modal.panStartY;
    modal.apply();
  },

  stopPan() {
    STATE.modal.panning = false;
  },

  onDblClick() {
    STATE.modal.zoom = STATE.modal.zoom > 1 ? 1 : 2;
    if (STATE.modal.zoom === 1) {
      STATE.modal.panX = 0;
      STATE.modal.panY = 0;
    }
    modal.apply();
  },

  init() {
    el.imgModalClose?.addEventListener("click", () => modal.close());
    el.imgModal?.addEventListener("click", (e) => {
      if (e.target === el.imgModal) modal.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && STATE.modal.open) modal.close();
    });

    el.imgModal?.addEventListener("wheel", modal.onWheel, { passive: false });
    el.imgModalSrc?.addEventListener("pointerdown", modal.onPointerDown);
    el.imgModalSrc?.addEventListener("pointermove", modal.onPointerMove);
    el.imgModalSrc?.addEventListener("pointerup", modal.stopPan);
    el.imgModalSrc?.addEventListener("pointercancel", modal.stopPan);
    el.imgModalSrc?.addEventListener("dblclick", modal.onDblClick);
  }
};

/* =========================================================
   FEATURE: Posts
========================================================= */
const posts = {
  _postCard(docSnap) {
    const p = docSnap.data();
    const id = docSnap.id;

    const photos = Array.isArray(p.photos) ? p.photos : [];
    const canDelete = STATE.user && (STATE.user.uid === p.uid || utils.isAdmin());

    const imgsHtml = photos.length
      ? `
        <div class="postImgs">
          ${photos
            .filter(utils.isValidUrl)
            .map((src) => `<img src="${src}" class="postImg" alt="imagem da tarefa">`)
            .join("")}
        </div>
      `
      : "";

    const linkHtml =
      p.link && utils.isValidUrl(p.link)
        ? `<a class="postLink" href="${p.link}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
        : "";

    return `
      <article class="card post" data-id="${id}">
        <div class="meta">
          <span class="pill">${utils.escapeHtml(p.subject || "Geral")}</span>
          ${p.teacher ? `<span class="pill">${utils.escapeHtml(p.teacher)}</span>` : ""}
          <span class="muted">${utils.fmtDate(p.createdAt)}</span>
        </div>

        <h3 class="postTitle">${utils.escapeHtml(p.title || "Sem título")}</h3>
        <div class="postBody">${utils.escapeHtml(p.body || "")}</div>

        ${linkHtml}
        ${imgsHtml}

        <div class="meta" style="margin-top:12px">
          <span>Por <b>${utils.escapeHtml(p.author || "Usuário")}</b>${utils.admTagHtml(p.uid)}</span>
          ${canDelete ? `<button class="btnGhost postDel" data-id="${id}">Apagar</button>` : ""}
        </div>
      </article>
    `;
  },

  renderSnapshot(snap) {
    if (!el.feed) return;

    if (snap.empty) {
      el.feed.innerHTML = `<div class="card muted">Nenhuma tarefa publicada ainda.</div>`;
      return;
    }

    el.feed.innerHTML = snap.docs.map((docSnap) => posts._postCard(docSnap)).join("");

    el.feed.querySelectorAll(".postImg").forEach((img) => {
      img.addEventListener("click", () => modal.open(img.src));
    });

    el.feed.querySelectorAll(".postDel").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;
        if (!confirm("Apagar esse post?")) return;

        try {
          await services.db.deletePost(id);
        } catch (err) {
          console.error(err);
          utils.safeAlert("Não consegui apagar.");
        }
      });
    });
  },

  async submit() {
    if (!STATE.user) return utils.safeAlert("Você precisa entrar primeiro.");

    const author = (el.author?.value || "").trim();
    const subject = (el.subject?.value || "Geral").trim();
    const teacher = (el.teacher?.value || "").trim();
    const title = (el.title?.value || "").trim();
    const body = (el.body?.value || "").trim();
    const link = (el.link?.value || "").trim();

    if (!author) return utils.safeAlert("Escreve seu nome.");
    if (!title) return utils.safeAlert("Coloca um título.");
    if (!body) return utils.safeAlert("Escreve a tarefa/resposta.");

    el.btnPost.disabled = true;
    const oldText = el.btnPost.textContent;
    el.btnPost.textContent = "Publicando...";

    try {
      const photos = [];
      for (const file of STATE.uploads.selectedFiles) {
        const url = await services.upload.toCloudinary(file);
        photos.push(url);
      }

      await services.db.addPost({
        uid: STATE.user.uid,
        author,
        subject,
        teacher,
        title,
        body,
        link: utils.isValidUrl(link) ? link : "",
        photos,
        createdAt: serverTimestamp()
      });

      if (el.title) el.title.value = "";
      if (el.body) el.body.value = "";
      if (el.link) el.link.value = "";
      uploads.clearAll();
    } catch (err) {
      console.error(err);
      utils.safeAlert(err?.message || "Não consegui publicar.");
    } finally {
      el.btnPost.disabled = false;
      el.btnPost.textContent = oldText;
    }
  },

  init() {
    services.db.listenPosts(posts.renderSnapshot);
    el.btnPost?.addEventListener("click", () => posts.submit());
  }
};

/* =========================================================
   FEATURE: Chat do Grupo
========================================================= */
const chat = {
  toggle() {
    STATE.chat.open ? chat.close() : chat.open();
  },

  open() {
    STATE.chat.open = true;
    if (el.chatDrawer) el.chatDrawer.classList.add("open");
    if (el.chatDrawer) el.chatDrawer.setAttribute("aria-hidden", "false");
    STATE.chat.unread = 0;
    chat.updateBadge();
  },

  close() {
    STATE.chat.open = false;
    if (el.chatDrawer) el.chatDrawer.classList.remove("open");
    if (el.chatDrawer) el.chatDrawer.setAttribute("aria-hidden", "true");
  },

  updateBadge() {
    if (!el.chatBadge) return;

    if (!STATE.chat.unread) {
      el.chatBadge.hidden = true;
      el.chatBadge.textContent = "0";
      return;
    }

    el.chatBadge.hidden = false;
    el.chatBadge.textContent = String(STATE.chat.unread);
  },

  renderSnapshot(snap) {
    if (!el.chatBox) return;

    const docs = snap.docs;
    el.chatBox.innerHTML = "";

    if (!docs.length) {
      el.chatBox.innerHTML = `<div class="muted">Sem mensagens ainda.</div>`;
      return;
    }

    docs.forEach((docSnap) => {
      const m = docSnap.data();
      const id = docSnap.id;

      const mine = STATE.user && STATE.user.uid === m.uid;
      const canEdit = mine;
      const canDelete = mine || utils.isAdmin();

      const msg = document.createElement("div");
      msg.className = `chatMsg ${mine ? "me" : ""}`;
      msg.dataset.id = id;

      msg.innerHTML = `
        <div class="chatMeta">
          <span><b>${utils.escapeHtml(m.author || "Usuário")}</b>${utils.admTagHtml(m.uid)}</span>
          <span>${utils.fmtDate(m.createdAt)}${m.editedAt ? " • editado" : ""}</span>
        </div>
        <div class="chatText">${utils.escapeHtml(m.text || "")}</div>
        <div class="chatActions">
          ${canEdit ? `<button class="chatEdit" data-id="${id}">Editar</button>` : ""}
          ${canDelete ? `<button class="chatDel" data-id="${id}">Apagar</button>` : ""}
        </div>
      `;

      el.chatBox.appendChild(msg);
    });

    el.chatBox.scrollTop = el.chatBox.scrollHeight;

    if (!STATE.chat.open && docs.length) {
      STATE.chat.unread += 1;
      chat.updateBadge();
    }
  },

  async send() {
    if (!STATE.user) return utils.safeAlert("Você precisa entrar.");
    const text = (el.chatText?.value || "").trim();
    if (!text) return;

    try {
      await services.db.sendChatMessage({
        uid: STATE.user.uid,
        author: STATE.user.displayName || "Usuário",
        text,
        createdAt: serverTimestamp()
      });

      el.chatText.value = "";
    } catch (err) {
      console.error(err);
      utils.safeAlert("Não consegui enviar.");
    }
  },

  async onBoxClick(e) {
    const del = e.target.closest(".chatDel");
    const edit = e.target.closest(".chatEdit");

    if (del) {
      const id = del.dataset.id;
      if (!confirm("Apagar essa mensagem?")) return;
      try {
        await services.db.deleteChatMessage(id);
      } catch (err) {
        console.error(err);
        utils.safeAlert("Não consegui apagar.");
      }
      return;
    }

    if (edit) {
      const id = edit.dataset.id;
      const msgEl = edit.closest(".chatMsg")?.querySelector(".chatText");
      const currentText = msgEl?.textContent ?? "";

      const newText = prompt("Editar mensagem:", currentText);
      if (newText === null) return;

      const trimmed = newText.trim();
      if (!trimmed) return utils.safeAlert("A mensagem não pode ficar vazia.");

      try {
        await services.db.editChatMessage(id, {
          text: trimmed,
          editedAt: serverTimestamp()
        });
      } catch (err) {
        console.error(err);
        utils.safeAlert("Não consegui editar.");
      }
    }
  },

  init() {
    services.db.listenChat(chat.renderSnapshot);

    el.chatFab?.addEventListener("click", () => chat.toggle());
    el.chatClose?.addEventListener("click", () => chat.close());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") chat.close();
    });

    el.btnSend?.addEventListener("click", () => chat.send());

    el.chatText?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chat.send();
      }
    });

    el.chatBox?.addEventListener("click", (e) => chat.onBoxClick(e));
  }
};

/* =========================================================
   FEATURE: AI Assistant
========================================================= */
const aiAssistant = {
  toggle() {
    STATE.ai.open ? aiAssistant.close() : aiAssistant.open();
  },

  open() {
    STATE.ai.open = true;
    el.aiDrawer?.classList.add("open");
    el.aiDrawer?.setAttribute("aria-hidden", "false");
  },

  close() {
    STATE.ai.open = false;
    el.aiDrawer?.classList.remove("open");
    el.aiDrawer?.setAttribute("aria-hidden", "true");
  },

  fmtTime(iso) {
    if (!iso) return "agora";
    try {
      return new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "agora";
    }
  },

  render() {
    if (!el.aiBox) return;

    el.aiBox.innerHTML = "";

    if (!STATE.ai.messages.length) {
      el.aiBox.innerHTML = `
        <div class="aiEmpty">
          Pergunte sobre tarefas, conteúdos, resumo de prova e dúvidas.
        </div>
      `;
      return;
    }

    STATE.ai.messages.forEach((msg) => {
      const wrap = document.createElement("div");
      wrap.className = `aiMsg ${msg.role === "user" ? "me" : "bot"}`;

      wrap.innerHTML = `
        <div class="aiBubble">${utils.escapeHtml(msg.text || "")}</div>
        <div class="aiMeta">${msg.role === "user" ? "Você" : "IA"} • ${aiAssistant.fmtTime(msg.createdAt)}</div>
      `;

      el.aiBox.appendChild(wrap);
    });

    el.aiBox.scrollTop = el.aiBox.scrollHeight;
  },

  async load() {
    if (!STATE.user) return;
    const data = await services.db.getAiChat(STATE.user.uid);
    STATE.ai.messages = Array.isArray(data.messages) ? data.messages : [];
    aiAssistant.render();
  },

  async persist() {
    if (!STATE.user) return;
    await services.db.saveAiChat(STATE.user.uid, STATE.ai.messages);
  },

  async fakeReply(prompt) {
    const lower = prompt.toLowerCase();

    if (lower.includes("resumo")) {
      return "Aqui vai um resumo inicial: organize o tema em definição, pontos principais e conclusão. Depois eu posso deixar isso mais forte e mais curto.";
    }

    if (lower.includes("prova") || lower.includes("revis")) {
      return "Para revisar prova, eu sugiro: conceito, exemplo e exercício rápido. Depois vamos ligar uma IA real para responder melhor.";
    }

    if (lower.includes("matem")) {
      return "Manda a questão completa de matemática e eu organizo em dados, conta e resposta final.";
    }

    return "Recebi sua pergunta. Essa área já está pronta para salvar histórico por usuário. Depois vamos trocar essa resposta simulada pela IA real.";
  },

  addTyping() {
    if (!el.aiBox) return;

    const wrap = document.createElement("div");
    wrap.className = "aiMsg bot";
    wrap.id = "aiTypingMsg";
    wrap.innerHTML = `
      <div class="aiBubble">
        <div class="aiTyping"><span></span><span></span><span></span></div>
      </div>
      <div class="aiMeta">IA • agora</div>
    `;
    el.aiBox.appendChild(wrap);
    el.aiBox.scrollTop = el.aiBox.scrollHeight;
  },

  removeTyping() {
    document.getElementById("aiTypingMsg")?.remove();
  },

  async send() {
    if (!STATE.user) return;
    const text = el.aiText?.value.trim();
    if (!text) return;

    STATE.ai.messages.push({
      role: "user",
      text,
      createdAt: new Date().toISOString()
    });

    if (el.aiText) el.aiText.value = "";
    aiAssistant.render();
    await aiAssistant.persist();

    aiAssistant.addTyping();

    setTimeout(async () => {
      aiAssistant.removeTyping();

      const reply = await aiAssistant.fakeReply(text);

      STATE.ai.messages.push({
        role: "assistant",
        text: reply,
        createdAt: new Date().toISOString()
      });

      aiAssistant.render();
      await aiAssistant.persist();
    }, 900);
  },

  init() {
    el.aiFab?.addEventListener("click", () => aiAssistant.toggle());
    el.aiClose?.addEventListener("click", () => aiAssistant.close());
    el.btnAiSend?.addEventListener("click", () => aiAssistant.send());

    el.aiText?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        aiAssistant.send();
      }
    });
  }
};

/* =========================================================
   FEATURE: Auth UI
========================================================= */
const authUI = {
  bind() {
    el.btnSignup?.addEventListener("click", async () => {
      const user = el.username.value;
      const pass = el.password.value;

      el.authStatus.textContent = "Criando conta…";
      try {
        await services.auth.signup(user, pass);
        el.password.value = "";
        el.authStatus.textContent = "Conta criada ✅";
      } catch (err) {
        console.error(err);
        el.authStatus.textContent = "Erro ❌";
        utils.safeAlert(err?.message || "Não consegui criar.");
      }
    });

    el.btnLogin?.addEventListener("click", async () => {
      const user = el.username.value;
      const pass = el.password.value;

      el.authStatus.textContent = "Entrando…";
      try {
        await services.auth.login(user, pass);
        el.password.value = "";
        el.authStatus.textContent = "Entrou ✅";
      } catch (err) {
        console.error(err);
        el.authStatus.textContent = "Erro ❌";
        utils.safeAlert(err?.message || "Não consegui entrar.");
      }
    });

    el.btnLogout?.addEventListener("click", () => services.auth.logout());
  }
};

/* =========================================================
   BOOTSTRAP
========================================================= */
async function main() {
  await services.auth.initPersistence();

  authUI.bind();
  teachers.init();
  uploads.init();
  modal.init();
  posts.init();
  chat.init();
  aiAssistant.init();

  onAuthStateChanged(auth, async (user) => {
    STATE.user = user || null;

    if (STATE.user) {
      ui.showApp();

      const me = STATE.user.displayName || "Usuário";
      if (el.who) el.who.textContent = me;

      if (el.author) {
        el.author.value = me;
        el.author.disabled = true;
      }

      teachers.fill(el.subject?.value || "Geral");
      utils.setStatus(utils.isAdmin() ? "Online ✅ (ADM)" : "Online ✅");
      await aiAssistant.load();
    } else {
      ui.showLogin();
      STATE.ai.messages = [];
      aiAssistant.render();
    }
  });
}

main().catch((err) => {
  console.error(err);
  utils.setStatus("Erro ao iniciar ❌");
  utils.safeAlert("Deu erro ao iniciar o app. Veja o console.");
});