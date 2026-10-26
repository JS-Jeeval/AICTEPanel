/**
 * Minimal, dependency-free PDF builder (A4, standard Helvetica fonts).
 * Supports headings, wrapped paragraphs, key/value grids, bullet lists,
 * auto-paginating tables with repeating headers, and a running header/footer.
 * Text is limited to WinAnsi characters; anything else is transliterated.
 */

// Helvetica advance widths (1/1000 em) for ASCII 32..126.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Characters outside ASCII that WinAnsiEncoding can show: [code, width]. */
const SPECIAL: Record<string, [number, number]> = {
  "—": [0x97, 1000], "–": [0x96, 556], "·": [0xb7, 278], "•": [0x95, 350], "…": [0x85, 1000],
  "‘": [0x91, 222], "’": [0x92, 222], "“": [0x93, 333], "”": [0x94, 333], "°": [0xb0, 400], "×": [0xd7, 584],
};
const TRANSLIT: Record<string, string> = { "→": "->", "←": "<-", "↔": "<->", "₹": "Rs ", "≥": ">=", "≤": "<=", "\u00a0": " ", "\t": " " };

/** Replace anything WinAnsi can't show with a safe equivalent. */
function clean(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    if ((code >= 32 && code <= 126) || ch in SPECIAL) out += ch;
    else if (ch in TRANSLIT) out += TRANSLIT[ch];
    else if (ch === "\n") out += "\n";
    else out += "?";
  }
  return out;
}

export type FontKey = "F1" | "F2" | "F3";
const BOLD_SCALE = 1.07;

function charWidth(ch: string, font: FontKey): number {
  const sp = SPECIAL[ch];
  const base = sp ? sp[1] : (W[ch.charCodeAt(0) - 32] ?? 556);
  return font === "F2" ? base * BOLD_SCALE : base;
}
export function textWidth(text: string, size: number, font: FontKey = "F1"): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, font);
  return (w * size) / 1000;
}

function wrap(text: string, size: number, font: FontKey, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      // Hard-split words that can never fit on a line.
      let w = word;
      while (textWidth(w, size, font) > maxW && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && textWidth(w.slice(0, cut), size, font) > maxW) cut--;
        if (line) { lines.push(line); line = ""; }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = line ? `${line} ${w}` : w;
      if (textWidth(next, size, font) <= maxW) line = next;
      else { if (line) lines.push(line); line = w; }
    }
    lines.push(line);
  }
  return lines;
}

type RGB = [number, number, number];
const NAVY: RGB = [0.1, 0.22, 0.45];
const GREY: RGB = [0.4, 0.42, 0.46];
const INK: RGB = [0.1, 0.11, 0.14];
const RULE: RGB = [0.8, 0.82, 0.86];
const HEAD_BG: RGB = [0.92, 0.94, 0.97];
const ZEBRA: RGB = [0.97, 0.975, 0.985];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const TOP = 62; // below running header
const BOTTOM = 52; // above footer
const CONTENT_W = PAGE_W - MARGIN * 2;

const f2 = (n: number) => n.toFixed(2);
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const col = (c: RGB, stroke = false) => `${f2(c[0])} ${f2(c[1])} ${f2(c[2])} ${stroke ? "RG" : "rg"}`;

/** Encode a cleaned string to WinAnsi byte-chars. */
function encode(text: string): string {
  let out = "";
  for (const ch of clean(text)) {
    const sp = SPECIAL[ch];
    out += sp ? String.fromCharCode(sp[0]) : ch;
  }
  return esc(out);
}

export interface PdfOptions {
  title: string;
  /** Short line shown top-left on every page. */
  running: string;
  /** Text at the bottom-left of every page. */
  footer: string;
}

export class PdfBuilder {
  private pages: string[][] = [];
  private y = TOP; // distance from top edge
  private cur: string[] = [];

  constructor(private opts: PdfOptions) {
    this.newPage();
  }

  // ---- page management -------------------------------------------------
  private newPage() {
    this.cur = [];
    this.pages.push(this.cur);
    this.y = TOP;
  }
  private ensure(h: number) {
    if (this.y + h > PAGE_H - BOTTOM) this.newPage();
  }
  private py = (y: number) => PAGE_H - y;

  private text(x: number, yTop: number, s: string, size: number, font: FontKey, color: RGB = INK) {
    this.cur.push(`BT ${col(color)} /${font} ${size} Tf ${f2(x)} ${f2(this.py(yTop))} Td (${encode(s)}) Tj ET`);
  }
  private rect(x: number, yTop: number, w: number, h: number, color: RGB) {
    this.cur.push(`${col(color)} ${f2(x)} ${f2(this.py(yTop + h))} ${f2(w)} ${f2(h)} re f`);
  }
  private line(x1: number, y1: number, x2: number, y2: number, color: RGB = RULE, width = 0.6) {
    this.cur.push(`${col(color, true)} ${width} w ${f2(x1)} ${f2(this.py(y1))} m ${f2(x2)} ${f2(this.py(y2))} l S`);
  }

  // ---- content blocks --------------------------------------------------
  space(h = 8) { this.y += h; return this; }

  /** Large document title block. */
  title(main: string, sub?: string, tag?: string) {
    this.ensure(54);
    this.text(MARGIN, this.y + 16, main, 18, "F2", NAVY);
    if (tag) {
      const w = textWidth(tag, 8, "F2") + 12;
      this.rect(PAGE_W - MARGIN - w, this.y + 4, w, 15, NAVY);
      this.text(PAGE_W - MARGIN - w + 6, this.y + 14.5, tag, 8, "F2", [1, 1, 1]);
    }
    this.y += 24;
    if (sub) { this.text(MARGIN, this.y + 10, clean(sub), 9.5, "F1", GREY); this.y += 16; }
    this.line(MARGIN, this.y + 2, PAGE_W - MARGIN, this.y + 2, NAVY, 1.2);
    this.y += 12;
    return this;
  }

  heading(text: string) {
    this.ensure(34);
    this.y += 6;
    this.text(MARGIN, this.y + 11, clean(text).toUpperCase(), 9.5, "F2", NAVY);
    this.y += 16;
    this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 7;
    return this;
  }

  paragraph(text: string, o: { size?: number; font?: FontKey; color?: RGB; indent?: number } = {}) {
    const size = o.size ?? 9.5;
    const font = o.font ?? "F1";
    const lead = size * 1.38;
    const x = MARGIN + (o.indent ?? 0);
    for (const ln of wrap(text, size, font, CONTENT_W - (o.indent ?? 0))) {
      this.ensure(lead);
      this.text(x, this.y + size, ln, size, font, o.color ?? INK);
      this.y += lead;
    }
    this.y += 3;
    return this;
  }

  bullets(items: string[], size = 9.5) {
    if (!items.length) return this.paragraph("None.", { color: GREY, font: "F3" });
    const lead = size * 1.38;
    for (const it of items) {
      const lines = wrap(it, size, "F1", CONTENT_W - 14);
      this.ensure(lead * Math.min(lines.length, 2));
      this.text(MARGIN + 3, this.y + size, "\u2022", size, "F1", NAVY);
      lines.forEach((ln, i) => {
        if (i) this.ensure(lead);
        this.text(MARGIN + 14, this.y + size, ln, size, "F1");
        this.y += lead;
      });
    }
    this.y += 3;
    return this;
  }

  /** Label/value grid with `cols` columns. */
  kv(pairs: [string, string][], cols = 3) {
    const colW = CONTENT_W / cols;
    for (let i = 0; i < pairs.length; i += cols) {
      const row = pairs.slice(i, i + cols);
      const cells = row.map(([k, v]) => ({ k, lines: wrap(v || "-", 9.5, "F1", colW - 10) }));
      const h = 11 + Math.max(...cells.map((c) => c.lines.length)) * 12.5 + 4;
      this.ensure(h);
      cells.forEach((c, j) => {
        const x = MARGIN + j * colW;
        this.text(x, this.y + 8, c.k, 7.5, "F1", GREY);
        c.lines.forEach((ln, n) => this.text(x, this.y + 20 + n * 12.5, ln, 9.5, "F1"));
      });
      this.y += h;
    }
    this.y += 2;
    return this;
  }

  /** Auto-paginating table. `widths` are relative weights. */
  table(headers: string[], widths: number[], rows: string[][], o: { size?: number } = {}) {
    const size = o.size ?? 8;
    const total = widths.reduce((a, b) => a + b, 0);
    const cw = widths.map((w) => (w / total) * CONTENT_W);
    const pad = 4;
    const lead = size * 1.3;

    const header = () => {
      const lines = headers.map((h, i) => wrap(h, size, "F2", (cw[i] ?? 40) - pad * 2));
      const h = Math.max(...lines.map((l) => l.length)) * lead + pad * 2;
      this.ensure(h + lead * 2);
      this.rect(MARGIN, this.y, CONTENT_W, h, HEAD_BG);
      let x = MARGIN;
      lines.forEach((ls, i) => { ls.forEach((ln, n) => this.text(x + pad, this.y + pad + size + n * lead - 1, ln, size, "F2", NAVY)); x += cw[i] ?? 0; });
      this.y += h;
    };

    header();
    if (!rows.length) {
      this.paragraph("No records.", { color: GREY, font: "F3", indent: pad });
      return this;
    }
    rows.forEach((r, ri) => {
      const cells = r.map((c, i) => wrap(c || "-", size, "F1", (cw[i] ?? 40) - pad * 2));
      const h = Math.max(...cells.map((c) => c.length)) * lead + pad * 2;
      if (this.y + h > PAGE_H - BOTTOM) { this.newPage(); header(); }
      if (ri % 2) this.rect(MARGIN, this.y, CONTENT_W, h, ZEBRA);
      let x = MARGIN;
      cells.forEach((ls, i) => { ls.forEach((ln, n) => this.text(x + pad, this.y + pad + size + n * lead - 1, ln, size, "F1")); x += cw[i] ?? 0; });
      this.line(MARGIN, this.y + h, PAGE_W - MARGIN, this.y + h, RULE, 0.4);
      this.y += h;
    });
    this.y += 6;
    return this;
  }

  /** Signature boxes (name printed under a rule). */
  signatures(items: { role: string; name: string }[]) {
    this.ensure(70);
    this.y += 34;
    const w = CONTENT_W / items.length;
    items.forEach((s, i) => {
      const x = MARGIN + i * w;
      this.line(x, this.y, x + w - 24, this.y, INK, 0.7);
      this.text(x, this.y + 11, s.name, 9, "F2");
      this.text(x, this.y + 22, s.role, 8, "F1", GREY);
    });
    this.y += 34;
    return this;
  }

  // ---- output ----------------------------------------------------------
  build(): Uint8Array<ArrayBuffer> {
    const n = this.pages.length;
    // Running header/footer are added now that page count is known.
    this.pages.forEach((p, i) => {
      const prev = this.cur;
      this.cur = p;
      this.text(MARGIN, 30, this.opts.running, 8, "F2", NAVY);
      this.line(MARGIN, 38, PAGE_W - MARGIN, 38);
      this.line(MARGIN, PAGE_H - 38, PAGE_W - MARGIN, PAGE_H - 38);
      this.text(MARGIN, PAGE_H - 26, clean(this.opts.footer), 7.5, "F1", GREY);
      const label = `Page ${i + 1} of ${n}`;
      this.text(PAGE_W - MARGIN - textWidth(label, 7.5), PAGE_H - 26, label, 7.5, "F1", GREY);
      this.cur = prev;
    });

    // Object layout: 1 catalog, 2 pages, 3-5 fonts, 6 info, then (page, content) pairs.
    const objs: string[] = [];
    const firstPage = 7;
    const kids = this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ");
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>";
    objs[6] = `<< /Title (${encode(this.opts.title)}) /Producer (AICTE ICMS) >>`;
    this.pages.forEach((p, i) => {
      const stream = p.join("\n");
      const pageNo = firstPage + i * 2;
      objs[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(PAGE_W)} ${f2(PAGE_H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${pageNo + 1} 0 R >>`;
      objs[pageNo + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const offsets: number[] = [];
    for (let i = 1; i < objs.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

/** Trigger a browser download for generated bytes. */
export function downloadPdf(bytes: Uint8Array<ArrayBuffer>, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
