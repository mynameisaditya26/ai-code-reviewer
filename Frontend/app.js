const reviewBtn = document.getElementById("reviewBtn");
const codeEl = document.getElementById("code");
const languageEl = document.getElementById("language");
const resultEl = document.getElementById("result");
const filenameEl = document.getElementById("filename");
const pastEl = document.getElementById("past");

async function loadPast() {
  try {
    const res = await fetch("/api/reviews");
    const data = await res.json();
    pastEl.innerHTML = data.map(r => {
      const t = new Date(r.createdAt).toLocaleString();
      return `<li><strong>${r.filename || 'snippet'}</strong> (${r.language}) — ${t}<br/><small>${escapeHtml(r.reviewText).slice(0,250)}...</small></li>`;
    }).join("");
  } catch (e) {
    pastEl.innerHTML = "<li>Failed to load past reviews</li>";
  }
}

function escapeHtml(str) {
  return (str||"").replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]);
}

reviewBtn.addEventListener("click", async () => {
  const code = codeEl.value;
  const language = languageEl.value;
  const filename = filenameEl.value;
  if (!code.trim()) {
    alert("Please paste code to review.");
    return;
  }
  resultEl.textContent = "Reviewing… (this may take a few seconds)";
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, filename })
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.innerHTML = `<div>${data.reviewText.replace(/\n/g,"<br/>")}</div>`;
      loadPast();
    } else {
      resultEl.textContent = "Error: " + (data.error || JSON.stringify(data));
    }
  } catch (err) {
    resultEl.textContent = "Network error: " + err.message;
  }
});

loadPast();
