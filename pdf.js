'use strict';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 42;
const HEADER_SAFE_RIGHT = PAGE_W - MARGIN;

const PDF_COLORS = {
  plum: [0.290, 0.188, 0.255],
  teal: [0, 0.573, 0.737],
  lime: [0.769, 0.839, 0],
  plumSoft: [0.953, 0.937, 0.949],
  tealSoft: [0.906, 0.961, 0.976],
  lightGray: [0.87, 0.84, 0.86],
  gray: [0.38, 0.34, 0.38],
  text: [0.184, 0.145, 0.173],
  white: [1, 1, 1]
};

const ITEM_TABLE_X = MARGIN;
const ITEM_TABLE_W = PAGE_W - MARGIN * 2;
const ITEM_LABEL_X = MARGIN + 10;
const ITEM_LABEL_W = 185;
const ITEM_RESPONSE_X = ITEM_LABEL_X + ITEM_LABEL_W + 18;
const ITEM_RESPONSE_W = ITEM_TABLE_X + ITEM_TABLE_W - ITEM_RESPONSE_X - 10;

/* Persist the current form, generate its PDF bytes, and download the packet. */
async function generatePacket() {
  try {
    setStatus('Building PDF packet...');
    currentJob = collectJobFromForm();
    await putStore('jobs', currentJob);
    writeCurrentJobSnapshot(currentJob);
    await loadDraftList();

    const photos = await getCurrentPhotos();
    const bytes = await buildDocumentPacketPdf(currentJob, photos);
    const filename = packetFilename(currentJob);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    currentJob.downloadedAt = new Date().toISOString();
    await putStore('jobs', currentJob);
    writeCurrentJobSnapshot(currentJob);
    await loadDraftList();
    setPdfPreviewGuard(currentJob);
    downloadBlob(blob, filename);
    setStatus(`Generated ${filename} (${formatBytes(blob.size)}).`);
  } catch (err) {
    console.error(err);
    alert(`Could not generate PDF: ${err.message}`);
    setStatus('PDF generation failed.');
  }
}

/* Build a name_job-number_file-type filename with filesystem-safe text sections. */
function packetFilename(job) {
  const doc = getDocumentDefinition(job.documentType);
  const jobNumberPhase = String(job.fields?.jobNumberPhase || '').trim();
  const jobNumber = jobNumberPhase.match(/^\d+/)?.[0] || '';
  const customer = safeFilename(job.fields?.customerName || 'Customer');
  const documentLabel = safeFilename(doc.filenameLabel);
  return `${[customer, jobNumber, documentLabel].filter(Boolean).join('_')}.pdf`;
}

/* Build the PDF document structure for the selected packet */
async function buildDocumentPacketPdf(job, photos) {
  job = normalizeJob(job);
  const doc = { pages: [], logo: await loadPdfLogo(), job };
  await addDocumentPages(doc, job);
  await addPhotoPages(doc, job, photos);
  doc.pages.forEach((page, index) => addPageNumber(page, index + 1, doc.pages.length));
  return buildPdf(doc);
}

/* Add the main form pages to the PDF document */
async function addDocumentPages(doc, job) {
  const definition = getDocumentDefinition(job.documentType);
  let page = newPdfPage(doc.logo);
  let y = startPdfPage(page, job);
  const jobFields = filledJobFields(job, definition);

  if (jobFields.length) {
    y = sectionBar(page, 'JOB INFORMATION', y);
    y = addJobInfo(page, job, y, jobFields);
  }

  for (const group of definition.groups) {
    const groupItems = filledItems(group.items, job[group.key]);
    if (groupItems.length) {
      ({ page, y } = ensurePageSpace(doc, page, y + 6, 48));
      y = sectionBar(page, group.pdfTitle, y);
      ({ page, y } = addItemTable(doc, page, job, groupItems, job[group.key], y, group.continuedTitle));
    }
  }

  if (hasPdfValue(job.summaryNotes)) {
    ({ page, y } = ensurePageSpace(doc, page, y + 4, 78));
    y = sectionBar(page, 'SUMMARY NOTES', y);
    y = addSummaryBlock(page, job, y);
  }

  ({ page, y } = ensurePageSpace(doc, page, y + 4, 104));
  addSignatureBlock(page, job, y + 8);
  doc.pages.push(page);
}

/* Create an empty PDF page container */
function newPdfPage(logo = null) { return { commands: [], images: [], logo }; }

/* Load and prepare the logo that is embedded in PDF pages */
async function loadPdfLogo() {
  try {
    return await dataUrlToJpegImage(await blobToDataUrl(await fetch('assets/absolute-aluminum-logo.png').then(response => response.blob())), 520, 0.9);
  } catch (err) {
    console.warn('Logo could not be embedded in PDF', err);
    return null;
  }
}

/* Add the full document header to the first PDF form page. */
function startPdfPage(page, job) {
  addHeader(page, getDocumentDefinition(job.documentType).pdfTitle, job);
  return 154;
}

/* Draw an Absolute Aluminum branded header for generated packets. */
function addHeader(page, title, job) {
  const headerH = 118;
  rectFill(page, 0, headerH, PAGE_W, 5, PDF_COLORS.lime);
  rectFill(page, 0, headerH + 5, PAGE_W, 3, PDF_COLORS.teal);
  line(page, MARGIN, headerH - 5, PAGE_W - MARGIN, headerH - 5, PDF_COLORS.lightGray);

  if (page.logo) {
    const logoFit = fitRect(page.logo.width, page.logo.height, 190, 76);
    imageOnPage(page, page.logo, MARGIN, 22, logoFit.w, logoFit.h);
  }

  const lines = title === 'ZERO DEFECT REPORT' ? ['ZERO DEFECT', 'REPORT'] : ['PRE-CONSTRUCTION', 'CHECKLIST'];
  const titleX = 304;
  const titleW = HEADER_SAFE_RIGHT - titleX;
  fittedCenteredText(page, lines[0], titleX, titleW, 57, 26, 'F3', PDF_COLORS.plum);
  fittedCenteredText(page, lines[1], titleX, titleW, 89, 26, 'F3', PDF_COLORS.plum);

  const customer = String(job.fields?.customerName || '').trim();
  const jobNumber = String(job.fields?.jobNumberPhase || '').trim();
  const meta = [customer, jobNumber].filter(Boolean).join(' | ');
  if (meta) textRight(page, meta, HEADER_SAFE_RIGHT, 103, 8.5, 'F1', PDF_COLORS.gray);
}

/* Draw a filled section label and return the next content position. */
function sectionBar(page, title, y) {
  const displayTitle = title.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  rectFill(page, MARGIN, y, PAGE_W - MARGIN * 2, 22, PDF_COLORS.plum);
  rectFill(page, MARGIN, y + 20, PAGE_W - MARGIN * 2, 3, PDF_COLORS.teal);
  text(page, displayTitle, MARGIN + 10, y + 14.5, 10.5, 'F2', PDF_COLORS.white);
  return y + 28;
}

/* Ensure enough space remains on the current PDF page or create a new page */
function ensurePageSpace(doc, page, y, needed) {
  if (y + needed <= 752) return { page, y, newPage: false };
  doc.pages.push(page);
  const nextPage = newPdfPage(doc.logo);
  return { page: nextPage, y: 44, newPage: true };
}

/* Match the references' unobtrusive page count in the upper-right corner. */
function addPageNumber(page, pageNumber, pageCount) {
  textRight(page, `Page ${pageNumber} of ${pageCount}`, HEADER_SAFE_RIGHT, 28, 8, 'F1', PDF_COLORS.gray);
}

/* Return only job fields that contain printable content. */
function filledJobFields(job, definition = getDocumentDefinition(job.documentType)) {
  const addressIds = new Set(['streetAddress', 'city', 'state', 'zip']);
  const fields = [];
  let addressAdded = false;

  definition.fields.forEach(field => {
    if (addressIds.has(field.id)) {
      if (!addressAdded) {
        const value = formatAddress(job.fields);
        if (hasPdfValue(value)) fields.push({ id: 'address', label: 'Address', value });
        addressAdded = true;
      }
      return;
    }
    if (hasPdfValue(job.fields?.[field.id])) fields.push(field);
  });

  return fields;
}

/* Return only checklist items with a selected or entered value. */
function filledItems(items, values) {
  return items.filter(item => itemHasPdfValue(item, values?.[item.id] || {}));
}

/* Treat trimmed, non-empty values as printable PDF content. */
function hasPdfValue(value) {
  return String(value ?? '').trim().length > 0;
}

/* Resolve whether an option or free-text item should appear in the PDF. */
function itemHasPdfValue(item, row) {
  return item.options ? hasPdfValue(row.selection) : hasPdfValue(row.value);
}

/* Find any long-form acknowledgment text tied to the selected option. */
function selectedWording(item, row) {
  const selection = row.selection || '';
  return (getDocumentDefinition(currentJob?.documentType).displayedWording?.[item.id] || []).filter(([sel]) => sel === selection);
}

/* Render compact label/value rows inside one outlined section. */
function addJobInfo(page, job, y, fields = filledJobFields(job)) {
  const rowH = 18;
  rectFill(page, MARGIN, y, PAGE_W - MARGIN * 2, fields.length * rowH, PDF_COLORS.white);
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, fields.length * rowH, PDF_COLORS.lightGray);
  fields.forEach((field, idx) => {
    const rowY = y + idx * rowH;
    if (idx % 2 === 1) rectFill(page, MARGIN, rowY, PAGE_W - MARGIN * 2, rowH, PDF_COLORS.plumSoft);
    text(page, field.label, MARGIN + 8, rowY + 12, 7.5, 'F2', PDF_COLORS.plum);
    textRight(page, field.value ?? job.fields?.[field.id] ?? '', PAGE_W - MARGIN - 8, rowY + 12, 9, 'F1', PDF_COLORS.text);
  });
  return y + fields.length * rowH + 4;
}

/* Return the raw display value for an option or text item. */
function itemDisplayValue(item, row) {
  return item.options ? row.selection || '' : row.value || '';
}

/* Count the lines produced using the selected PDF font's real glyph widths. */
function wrappedLineCount(value, width, size, font = 'F1') {
  return wrapPdfText(value, width, size, font).length;
}

/* Size rows for side-by-side question and response text. */
function itemRowHeight(item, row) {
  const response = itemPdfMessage(item, row);
  const labelLines = wrappedLineCount(item.label, ITEM_LABEL_W, 7.5, 'F2');
  const responseLines = wrappedLineCount(response, ITEM_RESPONSE_W, 8.5, 'F2');
  return Math.max(34, 18 + Math.max(labelLines * 9, responseLines * 9));
}

/* Add a table of checklist items to the PDF */
function addItemTable(doc, page, job, items, values, y, continuationTitle) {
  for (const item of items) {
    const row = values?.[item.id] || {};
    const h = itemRowHeight(item, row);
    const ensured = ensurePageSpace(doc, page, y, h + 2);
    page = ensured.page;
    y = ensured.y;
    if (ensured.newPage) {
      y = sectionBar(page, continuationTitle.replace(' continued', '').toUpperCase(), y);
    }
    addItemRow(page, item, row, y, h);
    y += h;
  }
  return { page, y: y + 4 };
}

/* Draw each checklist item as a compact question column with a wider response column. */
function addItemRow(page, item, row, y, h) {
  const response = itemPdfMessage(item, row);
  rectFill(page, ITEM_TABLE_X, y, ITEM_TABLE_W, h, PDF_COLORS.white);
  rectFill(page, ITEM_TABLE_X, y, 4, h, PDF_COLORS.lime);
  rectStroke(page, ITEM_TABLE_X, y, ITEM_TABLE_W, h, PDF_COLORS.lightGray);
  wrappedText(page, item.label, ITEM_LABEL_X, y + 13, ITEM_LABEL_W, 7.5, 9, 'F2', Infinity, PDF_COLORS.plum);
  if (wrappedLineCount(response, ITEM_RESPONSE_W, 8.5, 'F2') === 1) {
    wrappedTextRight(page, response, ITEM_RESPONSE_X + ITEM_RESPONSE_W, y + 13, ITEM_RESPONSE_W, 8.5, 9, 'F2', Infinity, PDF_COLORS.text);
  } else {
    wrappedText(page, response, ITEM_RESPONSE_X, y + 13, ITEM_RESPONSE_W, 8.5, 9, 'F2', Infinity, PDF_COLORS.text);
  }
}

/* Prefer configured acknowledgment wording over the raw selected value. */
function itemPdfMessage(item, row) {
  const wording = selectedWording(item, row);
  if (wording.length) return wording.map(([, body]) => body).join(' ');
  return itemDisplayValue(item, row);
}

/* Add summary notes block to the PDF */
function addSummaryBlock(page, job, y) {
  const notesWidth = PAGE_W - MARGIN * 2 - 30;
  const h = Math.min(110, Math.max(44, wrappedLineCount(job.summaryNotes || ' ', notesWidth, 8.5, 'F1') * 9.5 + 24));
  rectFill(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.tealSoft);
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.teal);
  text(page, 'Notes', MARGIN + 8, y + 12, 7.5, 'F2', PDF_COLORS.plum);
  wrappedText(page, job.summaryNotes || ' ', MARGIN + 24, y + 27, PAGE_W - MARGIN * 2 - 30, 8.5, 9.5, 'F1');
  return y + h + 6;
}

/* Place the invisible One Click signature/date tokens on visible signing lines. */
function addSignatureBlock(page, job, y) {
  const lineW = 310;
  rectFill(page, MARGIN, y, PAGE_W - MARGIN * 2, 96, PDF_COLORS.white);
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, 96, PDF_COLORS.lightGray);
  line(page, MARGIN + 12, y + 46, MARGIN + 12 + lineW, y + 46, PDF_COLORS.gray);
  text(page, '{{bsr}}', MARGIN + 6, y + 36, 12, 'F1', PDF_COLORS.white);
  text(page, job.fields?.customerName || 'Customer', MARGIN + 16, y + 58, 7.5, 'F2', PDF_COLORS.plum);
  line(page, MARGIN + 12, y + 78, MARGIN + 12 + lineW, y + 78, PDF_COLORS.gray);
  text(page, '{{bdr}}', MARGIN + 10, y + 74, 9, 'F1', PDF_COLORS.white);
  text(page, 'Date', MARGIN + 16, y + 90, 7, 'F1', PDF_COLORS.gray);
}

/* Add photo pages in the three-up vertical layout used by the source documents. */
async function addPhotoPages(doc, job, photos) {
  if (!photos.length) return;

  for (let i = 0; i < photos.length; i += 3) {
    const page = newPdfPage(doc.logo);
    addPhotoHeader(page, job);
    const slots = [
      { x: MARGIN, y: 86, w: 420, h: 204 },
      { x: MARGIN, y: 318, w: 420, h: 204 },
      { x: MARGIN, y: 550, w: 420, h: 176 }
    ];

    for (let j = 0; j < 3 && i + j < photos.length; j++) {
      const photo = photos[i + j];
      const image = await photoToJpegImage(photo, 1700, 0.74);
      const slot = slots[j];
      text(page, photoLabel(job, photo, i + j + 1), slot.x, slot.y + 10, 9, 'F2', PDF_COLORS.plum);
      const fit = fitRect(image.width, image.height, slot.w, slot.h - 16);
      rectStroke(page, slot.x, slot.y + 16, slot.w, slot.h - 16, PDF_COLORS.lightGray);
      imageOnPage(page, image, slot.x, slot.y + 16, fit.w, fit.h);
    }

    doc.pages.push(page);
  }
}

/* Add a compact branded heading to appended photo pages. */
function addPhotoHeader(page, job) {
  rectFill(page, 0, 52, PAGE_W, 5, PDF_COLORS.lime);
  rectFill(page, 0, 57, PAGE_W, 3, PDF_COLORS.teal);
  text(page, 'Photo Documentation', MARGIN, 34, 16, 'F3', PDF_COLORS.plum);
  const customer = String(job.fields?.customerName || '').trim();
  if (customer) textRight(page, customer, HEADER_SAFE_RIGHT, 46, 8.5, 'F1', PDF_COLORS.gray);
}

/* Label QC photos as Photo N, with optional caption text after the number. */
function photoLabel(job, photo, number) {
  const caption = String(photo.caption || '').trim();
  if (job.documentType === 'qualityControl') {
    const base = `Photo ${number}`;
    return caption ? `${base}: ${caption}` : base;
  }
  return caption || `Precon ${number}`;
}

/* Place an image object on a PDF page */
function imageOnPage(page, image, xTop, yTop, w, h) {
  const name = `Im${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const imageObj = { ...image, name };
  page.images.push(imageObj);
  page.commands.push(`q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(xTop)} ${fmt(PAGE_H - yTop - h)} cm /${name} Do Q`);
}

/* Add a text drawing command using top-origin page coordinates. */
function text(page, value, x, yTop, size = 10, font = 'F1', color = null) {
  const command = `BT /${font} ${fmt(size)} Tf ${fmt(x)} ${fmt(PAGE_H - yTop)} Td (${escapePdfString(pdfCleanText(value))}) Tj ET`;
  page.commands.push(color ? `q ${pdfRgb(color)} rg ${command} Q` : command);
}

/* Standard Helvetica glyph widths in thousandths of one text unit. */
const HELVETICA_WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
  s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584
};

/* Helvetica-Bold and Helvetica-BoldOblique share these standard PDF widths. */
const HELVETICA_BOLD_WIDTHS = {
  ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 238,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611, '@': 975,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 333, '\\': 278, ']': 333, '^': 584, _: 556, '`': 333,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278,
  j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389,
  s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
  '{': 389, '|': 280, '}': 389, '~': 584
};

/* Measure text using the metrics of the base font embedded in the PDF. */
function helveticaTextWidth(value, size, font = 'F1') {
  const widths = font === 'F1' ? HELVETICA_WIDTHS : HELVETICA_BOLD_WIDTHS;
  return Array.from(pdfCleanText(value)).reduce((width, char) => {
    const glyphWidth = char >= '0' && char <= '9' ? 556 : (widths[char] || 556);
    return width + glyphWidth;
  }, 0) * size / 1000;
}

/* Right-align text to an exact shared edge using Helvetica font metrics. */
function textRight(page, value, rightX, yTop, size = 10, font = 'F1', color = null) {
  text(page, value, rightX - helveticaTextWidth(value, size, font), yTop, size, font, color);
}

/* Center text in a fixed box, reducing size when needed so it never hits the page edge. */
function fittedCenteredText(page, value, x, width, yTop, size = 10, font = 'F1', color = null) {
  const fittedSize = Math.max(16, Math.min(size, size * width / Math.max(helveticaTextWidth(value, size, font), 1)));
  const textW = helveticaTextWidth(value, fittedSize, font);
  text(page, value, x + (width - textW) / 2, yTop, fittedSize, font, color);
}

/* Wrap PDF text by measured width, splitting an oversized word when necessary. */
function wrapPdfText(value, width, size, font = 'F1') {
  const input = pdfCleanText(value || '').replace(/\s+/g, ' ').trim();
  if (!input) return [''];

  const lines = [];
  let lineText = '';
  const pushWord = word => {
    const candidate = lineText ? `${lineText} ${word}` : word;
    if (helveticaTextWidth(candidate, size, font) <= width) {
      lineText = candidate;
      return;
    }
    if (lineText) {
      lines.push(lineText);
      lineText = '';
    }
    if (helveticaTextWidth(word, size, font) <= width) {
      lineText = word;
      return;
    }

    let segment = '';
    Array.from(word).forEach(char => {
      if (segment && helveticaTextWidth(segment + char, size, font) > width) {
        lines.push(segment);
        segment = char;
      } else {
        segment += char;
      }
    });
    lineText = segment;
  };

  input.split(' ').forEach(pushWord);
  if (lineText) lines.push(lineText);
  return lines;
}

/* Wrap text to a fixed width and append one PDF command per line. */
function wrappedText(page, value, x, yTop, width, size = 10, lineHeight = 12, font = 'F1', maxLines = Infinity, color = null) {
  const lines = wrapPdfText(value, width, size, font).slice(0, maxLines);
  lines.forEach((lineText, index) => text(page, lineText, x, yTop + index * lineHeight, size, font, color));
  return yTop + lines.length * lineHeight;
}

/* Wrap text to a fixed width and align each line to the same right edge. */
function wrappedTextRight(page, value, rightX, yTop, width, size = 10, lineHeight = 12, font = 'F1', maxLines = Infinity, color = null) {
  const lines = wrapPdfText(value, width, size, font).slice(0, maxLines);
  lines.forEach((lineText, index) => textRight(page, lineText, rightX, yTop + index * lineHeight, size, font, color));
  return yTop + lines.length * lineHeight;
}

/* Add a stroked line after converting top-origin coordinates to PDF space. */
function line(page, x1, y1Top, x2, y2Top, color = null) {
  const command = `${fmt(x1)} ${fmt(PAGE_H - y1Top)} m ${fmt(x2)} ${fmt(PAGE_H - y2Top)} l S`;
  page.commands.push(color ? `q ${pdfRgb(color)} RG ${command} Q` : command);
}

/* Add an outlined rectangle in top-origin coordinates. */
function rectStroke(page, x, yTop, w, h, color = null) {
  const command = `${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re S`;
  page.commands.push(color ? `q ${pdfRgb(color)} RG ${command} Q` : command);
}

/* Add a filled rectangle in top-origin coordinates. */
function rectFill(page, x, yTop, w, h, color = null) {
  const command = `${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re f`;
  page.commands.push(color ? `q ${pdfRgb(color)} rg ${command} Q` : command);
}

/* Convert a normalized RGB array into PDF color operands. */
function pdfRgb(color) { return color.map(fmt).join(' '); }

/* Convert the page and image model into a raw PDF file */
function buildPdf(doc) {
  const images = [];
  doc.pages.forEach(page => page.images.forEach(img => images.push(img)));
  let nextObj = 6;
  images.forEach(img => { img.obj = nextObj++; });
  doc.pages.forEach(page => { page.contentObj = nextObj++; page.pageObj = nextObj++; });

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${doc.pages.map(p => `${p.pageObj} 0 R`).join(' ')}] /Count ${doc.pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique >>';
  images.forEach(img => { objects[img.obj] = imageObject(img); });

  doc.pages.forEach(page => {
    const content = ['0 g', '0.7 w', ...page.commands].join('\n');
    objects[page.contentObj] = streamObject(asciiBytes(content));
    const xObjects = page.images.length ? `/XObject << ${page.images.map(img => `/${img.name} ${img.obj} 0 R`).join(' ')} >>` : '';
    objects[page.pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${xObjects} >> /Contents ${page.contentObj} 0 R >>`;
  });

  const chunks = [];
  const offsets = [0];
  pushAscii(chunks, '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = byteLength(chunks);
    pushAscii(chunks, `${i} 0 obj\n`);
    if (objects[i] instanceof Uint8Array) chunks.push(objects[i]); else pushAscii(chunks, objects[i]);
    pushAscii(chunks, '\nendobj\n');
  }

  const xrefOffset = byteLength(chunks);
  pushAscii(chunks, `xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < objects.length; i++) pushAscii(chunks, `${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  pushAscii(chunks, `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return concatBytes(chunks);
}

/* Encode an image object for PDF embedding */
function imageObject(img) {
  return concatBytes([
    asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`),
    img.bytes,
    asciiBytes('\nendstream')
  ]);
}

/* Wrap raw bytes in a length-declared PDF stream object. */
function streamObject(bytes) {
  return concatBytes([asciiBytes(`<< /Length ${bytes.length} >>\nstream\n`), bytes, asciiBytes('\nendstream')]);
}
