/**
 * Measure a block of text: rows, and widths in code points (never bytes).
 * A final newline ends the last row and is not a row of its own.
 * @param {string} text
 * @returns {{ rows: number, cols: number, widths: number[] }}
 */
export function measure(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const widths = lines.map((line) => [...line].length);
  const cols = widths.reduce((a, b) => (b > a ? b : a), 0);
  return { rows: lines.length, cols, widths };
}
