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

/* =========================================================
   CONFIG
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

  cloudinary: {
    cloudName: "ddlnf32a6",
    uploadPreset: "insta_grupo_unsigned_v2"
  },

  admins: [
    "jZvf3RDntVQxRFU9jRFi3hS4wjU2",
    "fMCWcyQ2odZZ05I480JEWZhiXts2"
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

  // chat
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
  imgModalClose: document.getElementById("imgModalClose")
};

/* =========================================================
   UTILS
========================================================= */
const utils = {
  escapeHtml(s = "") {
    return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  },

  fmtDate(ts) {
    if (!ts) return "agora";
    try { return ts.toDate().toLocaleString("pt-BR"); }
    catch { return "agora"; }
  },

  isValidUrl(u) {
    try { return !!u && new URL(u).protocol.startsWith("http"); }
    catch { return false; }
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
    return STATE.user && utils.isAdminUser(STATE.user.uid);
  },

  admTagHtml(uid) {
    return utils.isAdminUser(uid) ? ` <span class="badgeAdm">ADM</span>` : "";
  },

  setStatus(text) {
    if (el.status) el.status.textContent = text;
  },

  safeAlert(msg) {
    // centraliza alertas pra você trocar depois por toast
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

    modal.close();
  },

  showApp() {
    el.authScreen.style.display = "none";
    el.appScreen.style.display = "block";

    if (el.chatFab) el.chatFab.style.display = "flex";
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
    STATE.uploads.selectedFiles.forEach(f => dt.items.add(f));
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
        <img src="${url}" alt="preview ${idx+1}">
        <button type="button" title="Remover">✕</button>
      `;

      div.querySelector("button").addEventListener("click", () => uploads.removeAt(idx));
      el.photoPreviewList.appendChild(div);
    });
  },

  init() {
    el.photo?.addEventListener("change", uploads.onPick);
    el.removeAllPhotos?.addEventListener("click", uploads.clearAll);
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

    if (el.imgModalSrc) el.imgModalSrc.style.cursor = "zoom-in";
  },

  open(src) {
    if (!el.imgModal || !el.imgModalSrc) return;
    el.imgModal.classList.add("open");
    el.imgModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    el.imgModalSrc.src = src;
    STATE.modal.open = true;
    modal.reset();
  },

  close() {
    if (!el.imgModal || !el.imgModalSrc) return;
    el.imgModal.classList.remove("open");
    el.imgModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    el.imgModalSrc.src = "about:blank";
    STATE.modal.open = false;
    modal.reset();
  },

  onWheel(e) {
    if (!STATE.modal.open) return;
    e.preventDefault();

    const delta = Math.sign(e.deltaY);
    const factor = delta > 0 ? 0.9 : 1.1;

    STATE.modal.zoom = utils.clamp(STATE.modal.zoom * factor, 1, 4);
    if (STATE.modal.zoom === 1) {
      STATE.modal.panX = 0;
      STATE.modal.panY = 0;
    }

    if (el.imgModalSrc) el.imgModalSrc.style.cursor = (STATE.modal.zoom > 1 ? "grab" : "zoom-in");
    modal.apply();
  },

  onPointerDown(e) {
    if (!STATE.modal.open) return;
    if (STATE.modal.zoom <= 1) return;

    STATE.modal.panning = true;
    el.imgModalSrc?.setPointerCapture(e.pointerId);
    STATE.modal.panStartX = e.clientX - STATE.modal.panX;
    STATE.modal.panStartY = e.clientY - STATE.modal.panY;
    if (el.imgModalSrc) el.imgModalSrc.style.cursor = "grabbing";
  },

  onPointerMove(e) {
    if (!STATE.modal.panning) return;

    STATE.modal.panX = e.clientX - STATE.modal.panStartX;
    STATE.modal.panY = e.clientY - STATE.modal.panStartY;
    modal.apply();
  },

  stopPan() {
    STATE.modal.panning = false;
    if (el.imgModalSrc) el.imgModalSrc.style.cursor = (STATE.modal.zoom > 1 ? "grab" : "zoom-in");
  },

  onDblClick(e) {
    if (!STATE.modal.open) return;
    e.preventDefault();

    if (STATE.modal.zoom === 1) {
      STATE.modal.zoom = 2;
    } else {
      STATE.modal.zoom = 1;
      STATE.modal.panX = 0;
      STATE.modal.panY = 0;
    }

    modal.stopPan();
    modal.apply();
  },

  init() {
    el.imgModalClose?.addEventListener("click", modal.close);

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
  _getImageUrls(p) {
    // compat: antigo imageUrl, novo imageUrls[]
    if (Array.isArray(p.imageUrls)) return p.imageUrls;
    if (p.imageUrl) return [p.imageUrl];
    return [];
  },

  renderSnapshot(snap) {
    el.feed.innerHTML = "";

    if (snap.empty) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Ainda não tem posts. Publique a primeira tarefa 😄";
      el.feed.appendChild(empty);
      return;
    }

    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const postId = docSnap.id;

      const urls = posts._getImageUrls(p);

      const imgsHtml = urls.length
        ? `<div class="postImgs">
            ${urls.map(u => `
              <img
                src="${utils.escapeHtml(u)}"
                class="postImg"
                data-src="${utils.escapeHtml(u)}"
                loading="lazy"
                alt="foto"
              >
            `).join("")}
          </div>`
        : "";

      const teacherHtml = p.teacher
        ? `<span class="pill">👨‍🏫 ${utils.escapeHtml(p.teacher)}</span>`
        : "";

      const linkHtml = utils.isValidUrl(p.link)
        ? `<div class="meta"><span class="pill">🔗 <a href="${utils.escapeHtml(p.link)}" target="_blank" rel="noreferrer">Abrir link</a></span></div>`
        : "";

      const canDelete = STATE.user && (p.uid === STATE.user.uid || utils.isAdmin());
      const delBtnHtml = canDelete ? `<button class="btnDel" data-id="${postId}">Excluir</button>` : "";

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="meta" style="align-items:center">
          <span class="pill">📚 ${utils.escapeHtml(p.subject || "Geral")}</span>
          ${teacherHtml}
          <span class="pill">
            👤 ${utils.escapeHtml(p.author || "Anon")}
            ${utils.admTagHtml(p.uid)}
          </span>
          <span class="pill">🕒 ${utils.fmtDate(p.createdAt)}</span>
          ${delBtnHtml}
        </div>

        <p class="title" style="margin-top:12px">${utils.escapeHtml(p.title || "Sem título")}</p>
        <p class="content">${utils.escapeHtml(p.body || "")}</p>

        ${imgsHtml}
        ${linkHtml}
      `;

      el.feed.appendChild(card);
    });
  },

  async create() {
    if (!STATE.user) return utils.safeAlert("Faça login.");

    const subject = el.subject?.value || "Geral";
    const teacher = el.teacher?.disabled ? "" : (el.teacher?.value || "");
    const title = el.title.value.trim();
    const body = el.body.value.trim();
    const link = el.link.value.trim();

    if (!title || !body) return utils.safeAlert("Coloca pelo menos Título e Texto!");

    const files = [...STATE.uploads.selectedFiles];

    el.btnPost.disabled = true;
    utils.setStatus("Postando… ⏳");

    try {
      let imageUrls = [];
      if (files.length) {
        imageUrls = await Promise.all(files.map(services.upload.toCloudinary));
      }

      await services.db.addPost({
        uid: STATE.user.uid,
        author: STATE.user.displayName || "Usuário",
        subject,
        teacher,
        title,
        body,
        link: utils.isValidUrl(link) ? link : "",
        imageUrls,
        createdAt: serverTimestamp()
      });

      // limpa campos
      el.title.value = "";
      el.body.value = "";
      el.link.value = "";
      if (el.photo) el.photo.value = "";
      if (!el.teacher.disabled) el.teacher.value = "";

      uploads.clearAll();

      utils.setStatus("Postado ✅");
      setTimeout(() => utils.setStatus(utils.isAdmin() ? "Online ✅ (ADM)" : "Online ✅"), 1200);
    } catch (err) {
      console.error(err);
      utils.safeAlert("Erro ao postar: " + (err?.message || "desconhecido"));
      utils.setStatus("Erro ❌");
    } finally {
      el.btnPost.disabled = false;
    }
  },

  async remove(postId) {
    try {
      await services.db.deletePost(postId);
    } catch (err) {
      console.error(err);
      utils.safeAlert("Não consegui excluir. Veja o Console (F12).");
    }
  },

  onFeedClick(e) {
    const btnDel = e.target.closest(".btnDel");
    if (btnDel) {
      const id = btnDel.dataset.id;
      if (!confirm("Quer excluir esse post?")) return;
      posts.remove(id);
      return;
    }

    const img = e.target.closest(".postImg");
    if (img) {
      const src = img.getAttribute("data-src") || img.src;
      modal.open(src);
    }
  },

  init() {
    services.db.listenPosts(posts.renderSnapshot);
    el.feed.addEventListener("click", posts.onFeedClick);
    el.btnPost.addEventListener("click", posts.create);
  }
};

/* =========================================================
   FEATURE: Chat
========================================================= */
const chat = {
  setBadge(n) {
    STATE.chat.unread = n;
    if (!el.chatBadge) return;

    if (n <= 0) {
      el.chatBadge.hidden = true;
      el.chatBadge.textContent = "0";
    } else {
      el.chatBadge.hidden = false;
      el.chatBadge.textContent = n > 99 ? "99+" : String(n);
    }
  },

  open() {
    STATE.chat.open = true;
    el.chatDrawer.classList.add("open");
    el.chatDrawer.setAttribute("aria-hidden", "false");
    chat.setBadge(0);
    el.chatBox.scrollTop = el.chatBox.scrollHeight;
  },

  close() {
    STATE.chat.open = false;
    el.chatDrawer.classList.remove("open");
    el.chatDrawer.setAttribute("aria-hidden", "true");
  },

  toggle() {
    STATE.chat.open ? chat.close() : chat.open();
  },

  renderSnapshot(snap) {
    el.chatBox.innerHTML = "";

    if (snap.empty) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Sem mensagens ainda. Manda a primeira 👇";
      el.chatBox.appendChild(empty);
      return;
    }

    let newestIdThisRender = null;

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const msgId = docSnap.id;
      newestIdThisRender = msgId;

      const div = document.createElement("div");
      div.className = "chatMsg";

      const canManage = STATE.user && (m.uid === STATE.user.uid || utils.isAdmin());
      const actions = canManage ? `
        <div class="chatActions">
          <button class="chatBtn chatEdit" data-id="${msgId}">Editar</button>
          <button class="chatBtn chatDel" data-id="${msgId}">Apagar</button>
        </div>` : "";

      const edited = m.editedAt ? " • editado" : "";

      div.innerHTML = `
        <div class="chatMeta">
          <span>👤 ${utils.escapeHtml(m.author || "Anon")}${utils.admTagHtml(m.uid)}</span>
          <span>🕒 ${utils.fmtDate(m.createdAt)}${edited}</span>
        </div>
        <div class="chatText" style="white-space:pre-wrap">${utils.escapeHtml(m.text || "")}</div>
        ${actions}
      `;

      el.chatBox.appendChild(div);
    });

    if (newestIdThisRender && STATE.chat.lastSeenId && newestIdThisRender !== STATE.chat.lastSeenId) {
      if (!STATE.chat.open) chat.setBadge(STATE.chat.unread + 1);
    }
    if (!STATE.chat.lastSeenId) chat.setBadge(0);
    STATE.chat.lastSeenId = newestIdThisRender;

    if (STATE.chat.open) {
      el.chatBox.scrollTop = el.chatBox.scrollHeight;
      chat.setBadge(0);
    }
  },

  async send() {
    if (!STATE.user) return utils.safeAlert("Faça login.");

    const text = el.chatText.value.trim();
    if (!text) return;

    el.btnSend.disabled = true;
    try {
      await services.db.sendChatMessage({
        uid: STATE.user.uid,
        author: STATE.user.displayName || "Usuário",
        text,
        createdAt: serverTimestamp(),
        editedAt: null
      });

      el.chatText.value = "";
      if (STATE.chat.open) chat.setBadge(0);
    } catch (err) {
      console.error(err);
      utils.safeAlert("Erro ao enviar mensagem");
    } finally {
      el.btnSend.disabled = false;
    }
  },

  async onBoxClick(e) {
    const del = e.target.closest(".chatDel");
    const edit = e.target.closest(".chatEdit");

    if (del) {
      const id = del.dataset.id;
      if (!confirm("Apagar essa mensagem?")) return;
      try { await services.db.deleteChatMessage(id); }
      catch (err) { console.error(err); utils.safeAlert("Não consegui apagar."); }
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

    el.chatFab?.addEventListener("click", chat.toggle);
    el.chatClose?.addEventListener("click", chat.close);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") chat.close();
    });

    el.btnSend.addEventListener("click", chat.send);

    el.chatText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chat.send();
      }
    });

    el.chatBox.addEventListener("click", chat.onBoxClick);
  }
};

/* =========================================================
   FEATURE: Auth UI
========================================================= */
const authUI = {
  bind() {
    el.btnSignup.addEventListener("click", async () => {
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

    el.btnLogin.addEventListener("click", async () => {
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

    el.btnLogout.addEventListener("click", () => services.auth.logout());
  }
};

/* =========================================================
   BOOTSTRAP
========================================================= */
async function main() {
  await services.auth.initPersistence();

  // init modules
  authUI.bind();
  teachers.init();
  uploads.init();
  modal.init();
  posts.init();
  chat.init();

  // auth state
  onAuthStateChanged(auth, (user) => {
    STATE.user = user || null;

    if (STATE.user) {
      ui.showApp();

      const me = STATE.user.displayName || "Usuário";
      el.who.textContent = me;

      el.author.value = me;
      el.author.disabled = true;

      teachers.fill(el.subject?.value || "Geral");
      utils.setStatus(utils.isAdmin() ? "Online ✅ (ADM)" : "Online ✅");
    } else {
      ui.showLogin();
    }
  });
}

main();
