const SUPABASE_URL = "https://uqcodazkoityuhhnbmum.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WQwKJgTCh9fTaQV3dNWL-A_LrcipKPi";

// avoid global conflicts
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const feed = document.getElementById("feed");

function addPost(post) {
  const div = document.createElement("div");
  div.className = "post";
  div.innerHTML = `<img src="${post.image_url}" />`;
  feed.prepend(div); // newest on top
}

async function loadPosts() {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  feed.innerHTML = "";
  data.forEach(addPost);
}

// IMPORTANT: attach to window so button can always access it
window.uploadImage = async function () {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("No file selected");

  const fileName = `${Date.now()}-${file.name}`;

  // 1. Upload image
  const { error: uploadError } = await client.storage
    .from("Images")
    .upload(fileName, file);

  if (uploadError) {
    console.log(uploadError);
    return alert("Upload failed");
  }

  // 2. Get public URL
  const { data } = client.storage
    .from("Images")
    .getPublicUrl(fileName);

  // 3. Insert into database
  const { error: dbError } = await client
    .from("posts")
    .insert([{ image_url: data.publicUrl }]);

  if (dbError) {
    console.log(dbError);
    return alert("DB insert failed");
  }
};

// REALTIME SYNC (INSERT ONLY)
client
  .channel("posts-channel")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "posts" },
    (payload) => {
      addPost(payload.new);
    }
  )
  .subscribe();

loadPosts();