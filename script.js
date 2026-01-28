import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// firebaseConfig do projeto
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

// Elementos
const statusEl = document.getElementById("status");
const feedEl = document.getElementById("feed");
const btnPost = document.getElementById("btnPost");

const authorEl = document.getElementById("author");
const subjectEl = document.getElementById("subject");
const titleEl = document.getElementById("title");
const bodyEl = document.getElementById("body");
const linkEl = document.getElementById("link");
const photoEl = document.getElementById("photo");

// Chat elementos
const chatBox = document.getElementById("chatBox");
const chatText = document.getElementById("chatText");
const btnSend = document.getElementById("btnSend");

statusEl.textContent = "Online ✅";

// Helpers
function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function fmtDate(ts) {
  if (!ts) return "agora";
  return ts.toDate().toLocaleString("pt-BR");
}
function isValidUrl(u) {
  try {
    return !!u && new URL(u).protocol.startsWith("http");
  } catch {
    return false;
  }
}

// ✅ Upload Cloudinary (foto opcional)
async function uploadToCloudinary(file) {
  const CLOUD_NAME = "ddlnf32a6";
  const UPLOAD_PRESET = "insta_grupo_unsigned_v2";

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("Cloudinary error:", data);
    throw new Error(data?.error?.message || "Erro ao subir imagem");
  }

  return data.secure_url;
}

/* =========================
   POSTS (feed + criar + excluir)
========================= */

// Feed em tempo real
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

    // regra simples: só deixa excluir se o nome digitado bater com o author do post
    const currentName = (authorEl.value.trim() || "Anon");
    const canDelete = currentName === (p.author || "Anon");

    const delBtnHtml = canDelete
      ? `<button class="btnDel" data-id="${postId}" title="Excluir post">Excluir</button>`
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

// Clique para excluir post (delegação)
feedEl.addEventListener("click", async (e) => {
  const btnDel = e.target.closest(".btnDel");
  if (!btnDel) return;

  const id = btnDel.dataset.id;
  const ok = confirm("Quer excluir esse post?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "posts", id));
  } catch (err) {
    console.error(err);
    alert("Não consegui excluir. Veja o Console (F12).");
  }
});

// Publicar post
btnPost.addEventListener("click", async () => {
  const author = authorEl.value.trim() || "Anon";
  const subject = subjectEl?.value || "Geral";
  const title = titleEl.value.trim();
  const body = bodyEl.value.trim();
  const link = linkEl.value.trim();

  if (!title || !body) {
    alert("Coloca pelo menos Título e Texto!");
    return;
  }

  const file = photoEl?.files?.[0] || null;

  btnPost.disabled = true;
  statusEl.textContent = "Postando… ⏳";

  try {
    let imageUrl = "";

    if (file) imageUrl = await uploadToCloudinary(file);

    await addDoc(collection(db, "posts"), {
      author,
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
   CHAT (tempo real + enviar + editar + apagar)
========================= */

if (!chatBox || !chatText || !btnSend) {
  console.warn("Chat não encontrado no HTML. Verifique chatBox/chatText/btnSend.");
} else {
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

    const currentName = (authorEl.value.trim() || "Anon");

    snap.forEach((docSnap) => {
      const m = docSnap.data();
      const msgId = docSnap.id;

      const div = document.createElement("div");
      div.className = "chatMsg";

      const canManage = currentName === (m.author || "Anon");
      const actions = canManage
        ? `
          <div class="chatActions">
            <button class="chatBtn chatEdit" data-id="${msgId}">Editar</button>
            <button class="chatBtn chatDel" data-id="${msgId}">Apagar</button>
          </div>
        `
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

    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // enviar
  btnSend.addEventListener("click", async () => {
    const author = authorEl.value.trim() || "Anon";
    const text = chatText.value.trim();
    if (!text) return;

    btnSend.disabled = true;
    try {
      await addDoc(collection(db, "messages"), {
        author,
        text,
        createdAt: serverTimestamp(),
        editedAt: null
      });
      chatText.value = "";
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

  // editar/apagar (delegação)
  chatBox.addEventListener("click", async (e) => {
    const del = e.target.closest(".chatDel");
    const edit = e.target.closest(".chatEdit");

    // apagar
    if (del) {
      const id = del.dataset.id;
      const ok = confirm("Apagar essa mensagem?");
      if (!ok) return;

      try {
        await deleteDoc(doc(db, "messages", id));
      } catch (err) {
        console.error(err);
        alert("Não consegui apagar. Veja o Console (F12).");
      }
      return;
    }

    // editar
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
        alert("Não consegui editar. Veja o Console (F12).");
      }
    }
  });
}
