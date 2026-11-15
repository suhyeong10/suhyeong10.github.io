const maxFormulaLength = 2048;

// KaTeX 0.19.1, unmodified ESM build from the npm release (MIT).
// SHA-256 of dist/katex.mjs: 5f0c3749f8b28ce1a63b68de34d3950bb4aa1a9e0130865e4b09ecc9a250c8b7
let renderer;

export function enableInlineMath(markdown) {
  markdown.inline.ruler.after("escape", "inline_math", readInlineMath);
  markdown.renderer.rules.inline_math = (tokens, index) => {
    const source = markdown.utils.escapeHtml(tokens[index].content);
    return `<span data-blog-inline-math>$${source}$</span>`;
  };
}

function readInlineMath(state, silent) {
  const { src, pos: start, posMax } = state;
  if (src[start] !== "$" || src[start - 1] === "$" || !src[start + 1] || /[\s$]/.test(src[start + 1])) {
    return false;
  }

  const end = Math.min(posMax, start + maxFormulaLength + 2);
  for (let index = start + 1; index < end; index++) {
    const char = src[index];
    if (/[\r\n`]/.test(char)) return false;
    if (char === "\\" && index + 1 < end && !/[\r\n]/.test(src[index + 1])) {
      index++;
      continue;
    }
    if (char !== "$") continue;
    // Leave prices like "$5–$10" and double-dollar delimiters as plain text.
    if (/\s/.test(src[index - 1]) || /[\d$]/.test(src[index + 1] ?? "")) return false;
    if (!silent) state.push("inline_math", "", 0).content = src.slice(start + 1, index);
    state.pos = index + 1;
    return true;
  }
  return false;
}

export function typesetInlineMath(container) {
  const formulas = container.querySelectorAll("[data-blog-inline-math]");
  if (!formulas.length) return;

  renderer ??= import("./katex.esm.js");
  void renderer.then(({ default: katex }) => {
    for (const formula of formulas) {
      if (!formula.isConnected) continue;
      try {
        formula.innerHTML = katex.renderToString(formula.textContent.slice(1, -1), {
          output: "mathml",
          trust: false,
          maxExpand: 100,
          maxSize: 10,
          macros: { "\\*": "\\ast" }
        });
      } catch {
        // An incomplete or unsupported expression stays as its literal source.
      }
    }
  }, () => { /* Keep the source visible if the renderer could not load. */ });
}
