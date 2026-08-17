import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import { speak, speechSynthesisSupported } from "../speech.js";
import Icon from "../components/Icon.jsx";
import ScriptField from "../components/ScriptField.jsx";

export default function SakhiNavigator() {
  const { t, lang } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [articles, setArticles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.knowledgeCategories(lang).then(setCategories).catch(() => {});
  }, [lang]);

  useEffect(() => {
    if (!activeCategory) { setArticles([]); return; }
    setLoading(true);
    api.knowledgeBrowse(activeCategory, lang)
      .then((data) => { setArticles(data); setExpanded(null); })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [activeCategory, lang]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setActiveCategory(null);
    try {
      const results = await api.knowledgeSearch(searchQuery.trim(), lang);
      setSearchResults(results);
      setExpanded(null);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setSearchResults(null);
    setSearchQuery("");
  }

  const displayList = searchResults !== null ? searchResults : articles;

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 720 }}>
      <h1 className="display" style={{ fontSize: 28 }}>
        {t("nav_triage")}
      </h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.6 }}>
        Learn about health topics from trusted sources — WHO, India's National Health Mission,
        and ASHA worker training materials. Every piece of information shows where it came from.
        This is not a chatbot and does not generate advice.
      </p>

      {/* Search bar */}
      {/* The search box is a ScriptField: someone looking for "बुखार" has to be
          able to type it, and the phone very often has no Devanagari keyboard
          installed. Phonetic typing ("bukhaar") works here too. */}
      <form onSubmit={handleSearch} style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <ScriptField
          type="text"
          value={searchQuery}
          onValueChange={setSearchQuery}
          onEnter={() => handleSearch({ preventDefault() {} })}
          placeholder={lang === "hi" ? "यहां खोजें..." : lang === "kn" ? "ಇಲ್ಲಿ ಹುಡುಕಿ..." : "Search health topics..."}
          aria-label="Search health topics"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 999,
            border: "1px solid var(--border)", fontSize: 14.5,
            background: "var(--surface)", color: "var(--ink)",
          }}
          wrapperStyle={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading} aria-label="Search">
          {loading ? "…" : <Icon name="search" size={18} />}
        </button>
      </form>
      {searchResults !== null && (
        <button onClick={clearSearch} className="btn-text" style={{ marginTop: 8 }}>
          <Icon name="arrowLeft" size={13} /> Back to categories
        </button>
      )}

      {/* Category grid */}
      {searchResults === null && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10, marginTop: 22,
        }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
              className="card"
              style={{
                textAlign: "center", cursor: "pointer", padding: "18px 10px",
                border: activeCategory === cat.id ? "2px solid var(--rose)" : "1px solid var(--border)",
                background: activeCategory === cat.id ? "var(--surface-alt)" : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", color: "var(--rose-deep)" }}>
                <Icon name={cat.icon} size={26} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: "var(--ink)", lineHeight: 1.4 }}>
                {cat.label}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading && <p style={{ marginTop: 24, color: "var(--ink-muted)" }}>Loading...</p>}

      {!loading && displayList.length === 0 && (activeCategory || searchResults !== null) && (
        <p style={{ marginTop: 24, color: "var(--ink-muted)" }}>
          {searchResults !== null ? "No results found. Try different keywords." : "No articles in this category."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
        {displayList.map((article) => (
          <KnowledgeCard
            key={article.id}
            article={article}
            isExpanded={expanded === article.id}
            onToggle={() => setExpanded(expanded === article.id ? null : article.id)}
            lang={lang}
          />
        ))}
      </div>
    </div>
  );
}

function KnowledgeCard({ article, isExpanded, onToggle, lang }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", textAlign: "left", padding: "18px 20px",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          {article.title}
        </h3>
        <span style={{ fontSize: 18, color: "var(--rose)", flexShrink: 0, marginLeft: 12 }}>
          {isExpanded ? "−" : "+"}
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: "0 20px 20px" }}>
          <p style={{ fontSize: 14.5, color: "var(--ink)", lineHeight: 1.75, margin: 0 }}>
            {article.content}
          </p>

          <div style={{
            marginTop: 16, padding: "10px 14px", background: "var(--cream-dim)",
            borderRadius: 10, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5,
          }}>
            <strong>Source:</strong> {article.source}
          </div>

          {speechSynthesisSupported() && (
            <button
              onClick={() => speak(article.content, lang)}
              className="btn btn-ghost"
              style={{ marginTop: 10, padding: "6px 14px", fontSize: 12.5 }}
            >
              <Icon name="speaker" size={15} /> Read aloud
            </button>
          )}
        </div>
      )}
    </div>
  );
}
