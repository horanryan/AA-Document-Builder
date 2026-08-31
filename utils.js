'use strict';

/* Create a collision-resistant local identifier with a readable prefix. */
function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
/* Register the offline app shell when service workers are supported. */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err));
  }
}
/* Download a Blob to the user's device */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* Convert a string to ASCII bytes for PDF building */
function asciiBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}

/* Append ASCII text to a list of binary output chunks. */
function pushAscii(chunks, str) { chunks.push(asciiBytes(str)); }

/* Sum binary chunk lengths without allocating a combined buffer. */
function byteLength(chunks) { return chunks.reduce((total, chunk) => total + chunk.length, 0); }

/* Merge binary chunks into one contiguous byte array. */
function concatBytes(chunks) {
  const out = new Uint8Array(byteLength(chunks));
  let offset = 0;
  chunks.forEach(chunk => {
    out.set(chunk, offset);
    offset += chunk.length;
  });
  return out;
}

/* Format numeric values for PDF content streams */
function fmt(n) { return Number(n).toFixed(2).replace(/\.00$/, ''); }
/* Normalize text before embedding it into the PDF */
function pdfCleanText(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

/* Escape special characters inside PDF strings */
function escapePdfString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/* Wrap text to a maximum character width for PDF output */
function wrapText(value, maxChars) {
  const input = pdfCleanText(value || '').replace(/\s+/g, ' ').trim();
  if (!input) return [''];
  const words = input.split(' ');
  const lines = [];
  let lineText = '';
  words.forEach(word => {
    if ((lineText + ' ' + word).trim().length > maxChars && lineText) {
      lines.push(lineText);
      lineText = word;
    } else {
      lineText = (lineText + ' ' + word).trim();
    }
  });
  if (lineText) lines.push(lineText);
  return lines;
}
/* Format bytes as a human-readable string for UI display */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/* Replace filesystem-invalid filename characters while preserving entered text. */
function safeFilename(value) {
  const cleaned = String(value || '')
    .replace(/,/g, '')
    .replace(/[<>:"\/\\|?*\u0000-\u001f\u007f]/g, ' ');
  return cleaned.trim() ? cleaned : 'PreCon';
}

/* Split a legacy customer name so older saved drafts populate the new fields. */
function splitCustomerName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/* Build the customer's display name from separate fields with legacy fallback. */
function formatCustomerName(fields = {}) {
  const name = [fields.firstName, fields.lastName]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  return name || String(fields.customerName || '').trim();
}
/* Escape user-provided text before inserting it into generated HTML. */
function escapeHtml(value) {
   return String(value ?? '')
    .replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); 
}
/* Delay repeated calls until activity has stopped for the given interval. */
function debounce(fn, delay) {
   let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
