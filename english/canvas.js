const SUPABASE_URL = "https://uqcodazkoityuhhnbmum.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WQwKJgTCh9fTaQV3dNWL-A_LrcipKPi";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let posts = [];
let activeEditId = null;
let isDraggingGlobal = false;
let isTypingGlobal = false;

let moveId = null;
let moveGhost = null;

const noteDebounceMap = new Map();

const canvas = document.getElementById("canvas");

// -------------------------
// RENDER SAFETY
// -------------------------
let renderQueued = false;

const safeRender = () => {
    if (renderQueued) return;

    renderQueued = true;

    requestAnimationFrame(() => {
        renderQueued = false;
        renderCanvas();
    });
};

// -------------------------
// RENDER
// -------------------------
function renderCanvas() {
    const activeValue =
        document.querySelector("textarea.note-input")?.value;

    canvas.innerHTML = "";

    if (activeEditId) {
        canvas.classList.add("editing");
    } else {
        canvas.classList.remove("editing");
    }

    posts.forEach((post) => {
        const wrapper = document.createElement("div");
        wrapper.className = "post";

        wrapper.style.position = "absolute";
        wrapper.style.left = post.x + "px";
        wrapper.style.top = post.y + "px";

        const img = document.createElement("img");
        img.src = post.image_url;
        img.style.width = "150px";

        wrapper.appendChild(img);

        const info = document.createElement("div");
        info.className = "info";

        const isActive = post.id === activeEditId;

        const isEditingThis = isActive;
        if (isActive) {
            wrapper.classList.add("editing");
        }

        if (isEditingThis) {
            const textarea = document.createElement("textarea");
            textarea.className = "note-input";
            textarea.value = post.note || "";
            textarea.style.width = "150px";
        
            // IMPORTANT: prevent render interruptions
            textarea.onfocus = () => (isTypingGlobal = true);
        
            textarea.onblur = () => {
                isTypingGlobal = false;
            };
        
            textarea.oninput = (e) => {
                const value = e.target.value;
        
                // keep local state
                post.note = value;
        
                clearTimeout(noteDebounceMap.get(post.id));
                noteDebounceMap.set(
                    post.id,
                    setTimeout(() => {
                        client
                            .from("posts")
                            .update({ note: value })
                            .eq("id", post.id);
                    }, 300)
                );
            };
        
            const btn = document.createElement("button");
            btn.textContent = "Finish Editing";
        
            btn.onclick = async () => {
                isTypingGlobal = false;
            
                const id = post.id;
                activeEditId = null;
            
                await client
                    .from("posts")
                    .update({ locked: true, note: post.note })
                    .eq("id", id);

                safeRender();
                wrapper.classList.remove("editing");
            };
        
            info.appendChild(textarea);
            info.appendChild(btn);
        
            enableDrag(wrapper, post.id);
        } else {
            if (post.note) {
                const note = document.createElement("div");
                note.textContent = "📝 " + post.note;
                info.appendChild(note);
            }

            const time = document.createElement("div");
            time.textContent =
                "🕒 " + new Date(post.created_at).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                });

            info.appendChild(time);
        }

        wrapper.appendChild(info);
        canvas.appendChild(wrapper);
    });
}

// -------------------------
// LOAD POSTS
// -------------------------
async function loadPosts() {
    const { data } = await client
        .from("posts")
        .select("*")
        .order("created_at");

    posts = (data || []).map(p => ({
        ...p,
        locked: p.locked ?? true
    }));

    renderCanvas();
}

// -------------------------
// UPLOAD
// -------------------------
async function handleUpload(file, x, y) {
    const fileExt = file.name.split('.').pop();
    const fileName =
      `uploads/${Date.now()}-${Math.floor(Math.random() * 10000)}.${fileExt}`;

    const { error: uploadError } = await client.storage
        .from("Images")
        .upload(fileName, file);

    if (uploadError) {
        console.error("UPLOAD FAILED:", uploadError);
        return;
    }

    const { data: url } = client.storage
        .from("Images")
        .getPublicUrl(fileName);

    const { data, error: dbError } = await client
        .from("posts")
        .insert({
            image_url: url.publicUrl,
            x,
            y,
            locked: false,
            note: "",
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (dbError) {
        console.error("DB INSERT FAILED:", dbError);
        return;
    }

    posts.push(data);
    activeEditId = data.id;

    renderCanvas();
}

// -------------------------
// FILE UPLOAD BUTTON
// -------------------------
window.uploadImage = async () => {
    const file = document.getElementById("fileInput").files[0];
    if (file) {
        await handleUpload(file, innerWidth / 2, innerHeight / 2);
    }
};

// -------------------------
// DROP TO UPLOAD (NEW FIX)
// -------------------------
canvas.addEventListener("dragover", (e) => {
    e.preventDefault();
});

canvas.addEventListener("drop", async (e) => {
    e.preventDefault();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    await handleUpload(file, x, y);
});

// optional UX feedback
canvas.addEventListener("dragenter", () => {
    canvas.classList.add("dragging");
});

canvas.addEventListener("dragleave", () => {
    canvas.classList.remove("dragging");
});

canvas.addEventListener("drop", () => {
    canvas.classList.remove("dragging");
});

// -------------------------
// DRAG EXISTING POSTS
// -------------------------
function enableDrag(el, id) {
    el.onpointerdown = (e) => {
        if (["TEXTAREA", "BUTTON"].includes(e.target.tagName)) return;

        if (!e.shiftKey) return;

        // IMPORTANT: stop browser behavior (prevents jump)
        e.preventDefault();
        e.stopPropagation();

        moveId = id;

        el.classList.add("moving");
        canvas.classList.add("moving-mode");

        const rect = el.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        // IMPORTANT: lock initial offset so ghost doesn't jump
        const offsetX = rect.left - canvasRect.left;
        const offsetY = rect.top - canvasRect.top;

        moveGhost = el.cloneNode(true);
        moveGhost.style.opacity = "0.4";
        moveGhost.style.pointerEvents = "none";
        moveGhost.style.position = "absolute";
        moveGhost.style.zIndex = 9999;

        moveGhost.style.left = offsetX + "px";
        moveGhost.style.top = offsetY + "px";

        canvas.appendChild(moveGhost);
    };
}
// -------------------------
// REALTIME SYNC
// -------------------------
client
    .channel("posts-channel")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        ({ eventType, new: n, old: o }) => {

            if (eventType === "INSERT") {
                posts.push(n);
            }

            if (eventType === "UPDATE") {
                posts = posts.map(p => {
                    if (p.id !== n.id) return p;
            
                    return {
                        ...p,
                        ...n,
                        note: p.id === activeEditId ? p.note : n.note
                    };
                });
            }

            if (eventType === "DELETE") {
                posts = posts.filter(p => p.id !== o.id);
            }

            safeRender();
        }
    )
    .subscribe();

window.addEventListener("pointermove", (e) => {
    if (moveId === null || !moveGhost) return;

    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    moveGhost.style.left = x + "px";
    moveGhost.style.top = y + "px";
});

canvas.addEventListener("pointerdown", async (e) => {
    if (moveId === null) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    posts = posts.map(p =>
        p.id === moveId ? { ...p, x, y } : p
    );

    if (moveGhost) {
        moveGhost.remove();
        moveGhost = null;
    }

    canvas.classList.remove("moving-mode");

    const id = moveId;
    moveId = null;

    safeRender();

    await client
        .from("posts")
        .update({ x, y })
        .eq("id", id);
});
// -------------------------
// INIT
// -------------------------
loadPosts();