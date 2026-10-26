// Küçük, bağımlılıksız Markdown çevirici (ekran için yeterli alt küme).
// Desteklenen: # başlıklar, - / 1. listeler, - [ ] / - [x] görevler, > alıntı,
// --- ayraç, **kalın**, *italik*, ~~üstü çizili~~, ==vurgu==, `kod`, [link](url), !!acil!!

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
  const codes = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, "$1<em>$2</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/!!(.+?)!!/g, '<span class="urgent">$1</span>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(src = "") {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let list = null; // "ul" | "ol"
  let para = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`);
    quote = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const openList = (type) => {
    if (list !== type) {
      closeList();
      out.push(`<${type}>`);
      list = type;
    }
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    closeList();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const indent = (raw.match(/^\s*/)[0] || "").replace(/\t/g, "  ").length;
    const sub = indent >= 2 ? " sub" : "";
    let m;

    if (!line.trim()) {
      flushAll();
      continue;
    }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushAll();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      out.push("<hr>");
      continue;
    }
    if ((m = line.match(/^\s*>\s?(.*)$/))) {
      flushPara();
      closeList();
      quote.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      openList("ul");
      const done = m[1].toLowerCase() === "x" ? " done" : "";
      out.push(`<li class="task${done}${sub}">${inline(m[2])}</li>`);
      continue;
    }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      openList("ul");
      out.push(`<li class="${sub.trim()}">${inline(m[1])}</li>`);
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      openList("ol");
      out.push(`<li class="${sub.trim()}">${inline(m[1])}</li>`);
      continue;
    }
    flushQuote();
    closeList();
    para.push(line.trim());
  }
  flushAll();
  return out.join("");
}
