const GENRE_GRADIENTS = {
  "electronic":    "linear-gradient(135deg, #667eea, #764ba2)",
  "ambient":       "linear-gradient(135deg, #89f7fe, #66a6ff)",
  "folk":          "linear-gradient(135deg, #a8edea, #fed6e3)",
  "hip-hop":       "linear-gradient(135deg, #f093fb, #f5576c)",
  "rock":          "linear-gradient(135deg, #4facfe, #00f2fe)",
  "experimental":  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "instrumental":  "linear-gradient(135deg, #fa709a, #fee140)",
  "chiptune":      "linear-gradient(135deg, #30cfd0, #330867)",
  "jazz":          "linear-gradient(135deg, #f6d365, #fda085)",
  "classical":     "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
  "pop":           "linear-gradient(135deg, #ff9a9e, #fecfef)",
  "country":       "linear-gradient(135deg, #d4fc79, #96e6a1)",
  "soul":          "linear-gradient(135deg, #fccb90, #d57eeb)",
  "blues":         "linear-gradient(135deg, #4481eb, #04befe)",
  "international": "linear-gradient(135deg, #ffd89b, #19547b)",
  "spoken":        "linear-gradient(135deg, #a18cd1, #fbc2eb)",
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, #434343, #1a1a1a)";

function getGradient(genre_top, genres) {
  const key = (genre_top || genres[0] || "").toLowerCase();
  for (const [name, gradient] of Object.entries(GENRE_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return DEFAULT_GRADIENT;
}

function renderResults(results) {
  const container = document.getElementById("results");

  if (results.length === 0) {
    container.innerHTML = '<p class="message">No results found. Try a different vibe.</p>';
    return;
  }

  container.innerHTML = results.map((result) => {
    const gradient = getGradient(result.genre_top, result.genres);
    const score = Math.round(result.score * 100);
    const tags = result.genres.map((g) => `<span class="tag">${g}</span>`).join("");

    return `
      <div class="card">
        <div class="card-color-bar" style="background: ${gradient}"></div>
        <div class="card-body">
          <div class="card-title">${result.title}</div>
          <div class="card-artist">${result.artist}</div>
          <div class="tags">${tags}</div>
          <div class="card-footer">
            <span class="score">Match: ${score}%</span>
            <a class="fma-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(result.title + ' ' + result.artist)}" target="_blank" rel="noopener">Find on YouTube →</a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderMeta(meta) {
  const pipeline = meta.pipeline.map((stage) => JSON.stringify(stage, null, 2)).join(",\n");
  const vectorPreview = `[${meta.embeddingPreview.map(v => v.toFixed(4)).join(", ")}, ...]`;

  document.getElementById("meta").innerHTML = `
    <div class="meta-section">
      <h2 class="meta-heading">How this worked</h2>
      <div class="meta-grid">
        <span class="meta-label">Query</span>
        <span class="meta-value">"${meta.query}"</span>
        <span class="meta-label">Embedding</span>
        <span class="meta-value">${meta.embeddingDimensions} dimensions &nbsp;·&nbsp; ${vectorPreview}</span>
      </div>
      <p class="meta-label" style="margin-top: 1.25rem; margin-bottom: 0.5rem;">MongoDB aggregation pipeline</p>
      <pre class="meta-pipeline">[\n${pipeline}\n]</pre>
    </div>
  `;
}

document.getElementById("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const query = document.getElementById("query-input").value.trim();
  if (!query) return;

  const container = document.getElementById("results");
  container.innerHTML = '<div class="spinner"></div>';

  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    container.innerHTML = '<p class="message error">Something went wrong. Please try again.</p>';
    return;
  }

  const { results, meta } = await response.json();
  renderResults(results);
  renderMeta(meta);
});
