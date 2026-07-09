'use strict';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 42;
const HEADER_SAFE_RIGHT = PAGE_W - MARGIN;
const HEADER_TITLE_MAX_W = 252;

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
    downloadBlob(blob, filename);
    setStatus(`Generated ${filename} (${formatBytes(blob.size)}).`);
  } catch (err) {
    console.error(err);
    alert(`Could not generate PDF: ${err.message}`);
    setStatus('PDF generation failed.');
  }
}

/* Build a stable, filesystem-safe filename from the customer and job number. */
function packetFilename(job) {
  const doc = getDocumentDefinition(job.documentType);
  const jobNumberPhase = String(job.fields?.jobNumberPhase || '').trim();
  const jobNum = jobNumberPhase.match(/^\d+/)?.[0] || '';
  const customer = safeFilename(job.fields?.customerName || 'Customer');
  return `${[customer, jobNum, doc.filenameLabel].filter(Boolean).join('_')}.pdf`;
}

/* Build the PDF document structure for the selected packet */
async function buildDocumentPacketPdf(job, photos) {
  job = normalizeJob(job);
  const doc = { pages: [], logo: await loadPdfLogo(), brandText: await loadPdfBrandText(job), job };
  await addDocumentPages(doc, job);
  await addPhotoPages(doc, job, photos);
  doc.pages.forEach((page, index) => addPageNumber(page, index + 1, doc.pages.length));
  return buildPdf(doc);
}

/* Add the main form pages to the PDF document */
async function addDocumentPages(doc, job) {
  const definition = getDocumentDefinition(job.documentType);
  let page = newPdfPage(doc.logo, doc.brandText);
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
function newPdfPage(logo = null, brandText = null) { return { commands: [], images: [], logo, brandText }; }

/* Load and prepare the logo that is embedded in PDF pages */
async function loadPdfLogo() {
  try {
    return await dataUrlToJpegImage(await blobToDataUrl(await fetch('assets/absolute-aluminum-logo.png').then(response => response.blob())), 520, 0.9);
  } catch (err) {
    console.warn('Logo could not be embedded in PDF', err);
    return null;
  }
}

/* Render brand-font headings as image snippets when browser font APIs are available. */
async function loadPdfBrandText(job) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load('700 32px "Alkaline"'),
        document.fonts.load('700 18px "Alkaline"')
      ]);
    }

    const title = getDocumentDefinition(job.documentType).pdfTitle;
    const lines = title === 'ZERO DEFECT REPORT' ? ['ZERO DEFECT', 'REPORT'] : ['PRE-CONSTRUCTION', 'CHECKLIST'];
    return {
      headerLines: await Promise.all(lines.map(lineText => brandTextImage(lineText, '700 32px "Alkaline", "Arial Black", sans-serif', '#4A3041', { padX: 10, padY: 5, maxDisplayW: HEADER_TITLE_MAX_W }))),
      photoTitle: await brandTextImage('Photo Documentation', '700 22px "Alkaline", "Arial Black", sans-serif', '#4A3041', { padX: 5, padY: 4, maxDisplayW: 250 })
    };
  } catch (err) {
    console.warn('Brand PDF heading fonts could not be rendered', err);
    return null;
  }
}

/* Draw a small canvas text label and return it as a JPEG image for PDF embedding. */
async function brandTextImage(value, font, color, options = {}) {
  const { padX = 4, padY = 3, maxDisplayW = Infinity } = options;
  const scale = Math.max(4, Math.ceil((globalThis.devicePixelRatio || 1) * 2));
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const metrics = measure.measureText(value);
  const cssW = Math.ceil(metrics.width + padX * 2);
  const cssH = Math.ceil((metrics.actualBoundingBoxAscent || 24) + (metrics.actualBoundingBoxDescent || 8) + padY * 2);
  const canvas = document.createElement('canvas');
  canvas.width = cssW * scale;
  canvas.height = cssH * scale;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(value, padX, padY);
  const displayScale = Math.min(1, maxDisplayW / cssW);
  return {
    ...(await dataUrlToJpegImage(canvas.toDataURL('image/jpeg', 1), 1800, 1)),
    displayW: cssW * displayScale,
    displayH: cssH * displayScale
  };
}

/* Add the document header to each PDF page */
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
  const titleX = 322;
  if (page.brandText?.headerLines?.length === 2) {
    const [line1, line2] = page.brandText.headerLines;
    const line1X = Math.min(titleX - 8, HEADER_SAFE_RIGHT - line1.displayW);
    const line2IdealX = titleX + (lines[1] === 'REPORT' ? 36 : 30);
    const line2X = Math.min(line2IdealX, HEADER_SAFE_RIGHT - line2.displayW);
    imageOnPage(page, line1, line1X, 29, line1.displayW, line1.displayH);
    imageOnPage(page, line2, line2X, 61, line2.displayW, line2.displayH);
  } else {
    text(page, lines[0], titleX, 43, 24, 'F2', PDF_COLORS.plum);
    text(page, lines[1], titleX + (lines[1] === 'REPORT' ? 44 : 38), 73, 24, 'F2', PDF_COLORS.plum);
  }

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
  const nextPage = newPdfPage(doc.logo, doc.brandText);
  if (doc.job) addHeader(nextPage, getDocumentDefinition(doc.job.documentType).pdfTitle, doc.job);
  const nextY = doc.job ? 154 : 44;
  return { page: nextPage, y: nextY, newPage: true };
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

/* Size rows for wrapped answers plus enough bottom padding to clear the border. */
function itemRowHeight(item, row) {
  const message = itemPdfMessage(item, row);
  return Math.max(34, 24 + wrapText(message, 98).length * 9);
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

/* Draw every typed or selected answer below its label for consistent scanning. */
function addItemRow(page, item, row, y, h) {
  const message = itemPdfMessage(item, row);
  rectFill(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.white);
  rectFill(page, MARGIN, y, 4, h, PDF_COLORS.lime);
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.lightGray);
  text(page, item.label, MARGIN + 10, y + 12, 7.5, 'F2', PDF_COLORS.plum);
  wrappedText(page, message, MARGIN + 26, y + 25, PAGE_W - MARGIN * 2 - 34, 8.5, 9, 'F1');
}

/* Prefer configured acknowledgment wording over the raw selected value. */
function itemPdfMessage(item, row) {
  const wording = selectedWording(item, row);
  if (wording.length) return wording.map(([, body]) => body).join(' ');
  return itemDisplayValue(item, row);
}

/* Add summary notes block to the PDF */
function addSummaryBlock(page, job, y) {
  const h = Math.min(110, Math.max(44, wrapText(job.summaryNotes || ' ', 106).length * 9 + 24));
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
    const page = newPdfPage(doc.logo, doc.brandText);
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
  if (page.brandText?.photoTitle) {
    imageOnPage(page, page.brandText.photoTitle, MARGIN - 4, 14, page.brandText.photoTitle.displayW, page.brandText.photoTitle.displayH);
  } else {
    text(page, 'Photo Documentation', MARGIN, 34, 16, 'F2', PDF_COLORS.plum);
  }
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

/* Measure text using the same Helvetica metrics embedded in the PDF. */
function helveticaTextWidth(value, size) {
  return Array.from(pdfCleanText(value)).reduce((width, char) => {
    const glyphWidth = char >= '0' && char <= '9' ? 556 : (HELVETICA_WIDTHS[char] || 556);
    return width + glyphWidth;
  }, 0) * size / 1000;
}

/* Right-align text to an exact shared edge using Helvetica font metrics. */
function textRight(page, value, rightX, yTop, size = 10, font = 'F1', color = null) {
  text(page, value, rightX - helveticaTextWidth(value, size), yTop, size, font, color);
}

/* Wrap text to a fixed width and append one PDF command per line. */
function wrappedText(page, value, x, yTop, width, size = 10, lineHeight = 12, font = 'F1', maxLines = Infinity) {
  const chars = Math.max(12, Math.floor(width / (size * 0.52)));
  const lines = wrapText(value, chars).slice(0, maxLines);
  lines.forEach((lineText, index) => text(page, lineText, x, yTop + index * lineHeight, size, font));
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
  let nextObj = 5;
  images.forEach(img => { img.obj = nextObj++; });
  doc.pages.forEach(page => { page.contentObj = nextObj++; page.pageObj = nextObj++; });

  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${doc.pages.map(p => `${p.pageObj} 0 R`).join(' ')}] /Count ${doc.pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  images.forEach(img => { objects[img.obj] = imageObject(img); });

  doc.pages.forEach(page => {
    const content = ['0 g', '0.7 w', ...page.commands].join('\n');
    objects[page.contentObj] = streamObject(asciiBytes(content));
    const xObjects = page.images.length ? `/XObject << ${page.images.map(img => `/${img.name} ${img.obj} 0 R`).join(' ')} >>` : '';
    objects[page.pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects} >> /Contents ${page.contentObj} 0 R >>`;
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
