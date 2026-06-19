'use strict';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 42;

const PDF_COLORS = {
  plum: [0.208, 0.075, 0.243],
  orange: [0.945, 0.357, 0.165],
  lime: [0.784, 0.906, 0.157],
  teal: [0, 0.557, 0.690],
  paleLime: [0.984, 1, 0.941],
  lightGray: [0.82, 0.84, 0.86],
  gray: [0.38, 0.4, 0.43],
  white: [1, 1, 1]
};
async function generatePacket() {
  try {
    setStatus('Building PDF packet...');
    currentJob = collectJobFromForm();
    await putStore('jobs', currentJob);
    await loadDraftList();

    const photos = await getCurrentPhotos();
    const bytes = await buildDocumentPacketPdf(currentJob, photos);
    const filename = packetFilename(currentJob);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    downloadBlob(blob, filename);
    setStatus(`Generated ${filename} (${formatBytes(blob.size)}).`);
  } catch (err) {
    console.error(err);
    alert(`Could not generate PDF: ${err.message}`);
    setStatus('PDF generation failed.');
  }
}

function packetFilename(job) {
  const doc = getDocumentDefinition(job.documentType);
  const jobNumberPhase = String(job.fields?.jobNumberPhase || '').trim();
  const jobNum = jobNumberPhase.match(/^\d+/)?.[0] || safeFilename(doc.defaultFilename);
  const customer = safeFilename(job.fields?.customerName || 'Customer');
  return `${customer}_${jobNum}_${doc.filenameLabel}.pdf`;
}

/* Build the PDF document structure for the selected packet */
async function buildDocumentPacketPdf(job, photos) {
  job = normalizeJob(job);
  const doc = { pages: [], logo: await loadPdfLogo() };
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
      ({ page, y } = ensurePageSpace(doc, page, job, y + 6, 48, group.continuedTitle));
      y = sectionBar(page, group.pdfTitle, y);
      ({ page, y } = addItemTable(doc, page, job, groupItems, job[group.key], y, group.continuedTitle));
    }
  }

  if (hasPdfValue(job.summaryNotes)) {
    ({ page, y } = ensurePageSpace(doc, page, job, y + 4, 78, 'Summary'));
    y = sectionBar(page, 'SUMMARY NOTES', y);
    y = addSummaryBlock(page, job, y);
  }

  ({ page, y } = ensurePageSpace(doc, page, job, y + 4, 104, 'Signature'));
  await addSignatureBlock(page, job, y + 8);
  doc.pages.push(page);
}

/* Create an empty PDF page container */
function newPdfPage(logo = null) { return { commands: [], images: [], annotations: [], logo }; }

/* Load and prepare the logo that is embedded in PDF pages */
async function loadPdfLogo() {
  try {
    return await dataUrlToJpegImage(await blobToDataUrl(await fetch('assets/absolute-aluminum-logo.png').then(response => response.blob())), 520, 0.9);
  } catch (err) {
    console.warn('Logo could not be embedded in PDF', err);
    return null;
  }
}

/* Add the document header to each PDF page */
function startPdfPage(page, job) {
  addHeader(page, getDocumentDefinition(job.documentType).pdfTitle, job, 28);
  return 150;
}

/* Draw the logo-led title used by the source PreCon and Zero Defect documents. */
function addHeader(page, title, job, yTop) {
  if (page.logo) {
    const logoFit = fitRect(page.logo.width, page.logo.height, 170, 94);
    imageOnPage(page, page.logo, MARGIN, yTop + 6, logoFit.w, logoFit.h);
  }
  const lines = title === 'ZERO DEFECT REPORT' ? ['ZERO DEFECT', 'REPORT'] : ['PRE-CONSTRUCTION', 'CHECKLIST'];
  const titleX = 344;
  text(page, lines[0], titleX, yTop + 38, 23, 'F2', PDF_COLORS.plum);
  text(page, lines[1], titleX + (lines[1] === 'REPORT' ? 40 : 42), yTop + 67, 23, 'F2', PDF_COLORS.plum);
}

function sectionBar(page, title, y) {
  const displayTitle = title.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  text(page, displayTitle, MARGIN, y + 11, 11, 'F2', PDF_COLORS.plum);
  line(page, MARGIN, y + 14, PAGE_W - MARGIN, y + 14, PDF_COLORS.gray);
  return y + 16;
}

/* Ensure enough space remains on the current PDF page or create a new page */
function ensurePageSpace(doc, page, job, y, needed, subtitle) {
  if (y + needed <= 752) return { page, y, newPage: false };
  doc.pages.push(page);
  const nextPage = newPdfPage(doc.logo);
  const nextY = 44;
  return { page: nextPage, y: nextY, newPage: true };
}

/* Match the references' unobtrusive page count in the upper-right corner. */
function addPageNumber(page, pageNumber, pageCount) {
  textRight(page, `Page ${pageNumber} of ${pageCount}`, PAGE_W - 24, 28, 8, 'F1', PDF_COLORS.gray);
}

/* Helpers for filtering fields and items that should be printed */
function filledJobFields(job, definition = getDocumentDefinition(job.documentType)) {
  return definition.fields.filter(field => hasPdfValue(job.fields?.[field.id]));
}

function filledItems(items, values) {
  return items.filter(item => itemHasPdfValue(item, values?.[item.id] || {}));
}

function hasPdfValue(value) {
  return String(value ?? '').trim().length > 0;
}

function itemHasPdfValue(item, row) {
  return item.options ? hasPdfValue(row.selection) : hasPdfValue(row.value);
}

function selectedWording(item, row) {
  const selection = row.selection || '';
  return (getDocumentDefinition(currentJob?.documentType).displayedWording?.[item.id] || []).filter(([sel]) => sel === selection);
}

/* Render compact label/value rows inside one outlined section. */
function addJobInfo(page, job, y, fields = filledJobFields(job)) {
  const rowH = 18;
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, fields.length * rowH, PDF_COLORS.gray);
  fields.forEach((field, idx) => {
    const rowY = y + idx * rowH;
    text(page, field.label, MARGIN + 6, rowY + 12, 7.5, 'F2');
    textRight(page, job.fields?.[field.id] || '', PAGE_W - MARGIN - 6, rowY + 12, 9, 'F1');
  });
  return y + fields.length * rowH + 4;
}

function labelValue(page, label, value, x, y, width) {
  rectStroke(page, x, y, width, 24, PDF_COLORS.lightGray);
  rect(page, x, y, width, 8, PDF_COLORS.paleLime);
  text(page, label, x + 5, y + 6, 6.5, 'F2', PDF_COLORS.plum);
  wrappedText(page, value || ' ', x + 5, y + 19, width - 10, 8, 9, 'F1', 1);
}

function itemDisplayValue(item, row) {
  return item.options ? row.selection || '' : row.value || '';
}

function itemRowHeight(item, row) {
  const message = itemPdfMessage(item, row);
  return message.length > 64 ? Math.max(30, 17 + wrapText(message, 98).length * 9) : 20;
}

/* Add a table of checklist items to the PDF */
function addItemTable(doc, page, job, items, values, y, continuationTitle) {
  for (const item of items) {
    const row = values?.[item.id] || {};
    const h = itemRowHeight(item, row);
    const ensured = ensurePageSpace(doc, page, job, y, h + 2, continuationTitle);
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

function addItemRow(page, item, row, y, h) {
  const message = itemPdfMessage(item, row);
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.lightGray);
  text(page, item.label, MARGIN + 6, y + 12, 7.5, 'F2');
  if (message.length > 64) {
    wrappedText(page, message, MARGIN + 24, y + 25, PAGE_W - MARGIN * 2 - 30, 8.5, 9, 'F1');
  } else {
    textRight(page, message, PAGE_W - MARGIN - 6, y + 12, 9, 'F1');
  }
}

function itemPdfMessage(item, row) {
  const wording = selectedWording(item, row);
  if (wording.length) return wording.map(([, body]) => body).join(' ');
  return itemDisplayValue(item, row);
}

/* Add summary notes block to the PDF */
function addSummaryBlock(page, job, y) {
  const h = Math.min(110, Math.max(44, wrapText(job.summaryNotes || ' ', 106).length * 9 + 24));
  rectStroke(page, MARGIN, y, PAGE_W - MARGIN * 2, h, PDF_COLORS.gray);
  text(page, 'Notes', MARGIN + 6, y + 12, 7.5, 'F2');
  wrappedText(page, job.summaryNotes || ' ', MARGIN + 24, y + 27, PAGE_W - MARGIN * 2 - 30, 8.5, 9.5, 'F1');
  return y + h + 6;
}

/* Add the signature section to the PDF */
async function addSignatureBlock(page, job, y) {
  const lineW = 310;
  line(page, MARGIN, y + 46, MARGIN + lineW, y + 46, PDF_COLORS.gray);
  text(page, '{{bsr}}', MARGIN + 6, y + 36, 12, 'F1', PDF_COLORS.white);
  text(page, job.fields?.customerName || 'Customer', MARGIN + 10, y + 58, 7.5, 'F2', PDF_COLORS.plum);
  line(page, MARGIN, y + 78, MARGIN + lineW, y + 78, PDF_COLORS.gray);
  text(page, '{{bdr}}', MARGIN + 10, y + 74, 9, 'F1', PDF_COLORS.white);
  text(page, 'Date', MARGIN + 10, y + 90, 7, 'F1', PDF_COLORS.gray);
}

/* Add photo pages in the three-up vertical layout used by the source documents. */
async function addPhotoPages(doc, job, photos) {
  if (!photos.length) return;

  const photoPrefix = job.documentType === 'qualityControl' ? 'Completion' : 'Precon';
  for (let i = 0; i < photos.length; i += 3) {
    const page = newPdfPage(doc.logo);
    const slots = [
      { x: MARGIN, y: 46, w: 380, h: 218 },
      { x: MARGIN, y: 278, w: 380, h: 218 },
      { x: MARGIN, y: 510, w: 380, h: 218 }
    ];

    for (let j = 0; j < 3 && i + j < photos.length; j++) {
      const photo = photos[i + j];
      const image = await photoToJpegImage(photo, 1700, 0.74);
      const slot = slots[j];
      text(page, photo.caption || `${photoPrefix} ${i + j + 1}`, slot.x, slot.y + 10, 9, 'F2', PDF_COLORS.gray);
      const fit = fitRect(image.width, image.height, slot.w, slot.h - 16);
      imageOnPage(page, image, slot.x, slot.y + 16, fit.w, fit.h);
    }

    doc.pages.push(page);
  }
}

/* Place an image object on a PDF page */
function imageOnPage(page, image, xTop, yTop, w, h) {
  const name = `Im${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const imageObj = { ...image, name };
  page.images.push(imageObj);
  page.commands.push(`q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(xTop)} ${fmt(PAGE_H - yTop - h)} cm /${name} Do Q`);
}

/* PDF text drawing helpers */
function text(page, value, x, yTop, size = 10, font = 'F1', color = null) {
  const command = `BT /${font} ${fmt(size)} Tf ${fmt(x)} ${fmt(PAGE_H - yTop)} Td (${escapePdfString(pdfCleanText(value))}) Tj ET`;
  page.commands.push(color ? `q ${pdfRgb(color)} rg ${command} Q` : command);
}

function textRight(page, value, rightX, yTop, size = 10, font = 'F1', color = null) {
  text(page, value, rightX - String(value).length * size * 0.52, yTop, size, font, color);
}

function wrappedText(page, value, x, yTop, width, size = 10, lineHeight = 12, font = 'F1', maxLines = Infinity) {
  const chars = Math.max(12, Math.floor(width / (size * 0.52)));
  const lines = wrapText(value, chars).slice(0, maxLines);
  lines.forEach((lineText, index) => text(page, lineText, x, yTop + index * lineHeight, size, font));
  return yTop + lines.length * lineHeight;
}

function line(page, x1, y1Top, x2, y2Top, color = null) {
  const command = `${fmt(x1)} ${fmt(PAGE_H - y1Top)} m ${fmt(x2)} ${fmt(PAGE_H - y2Top)} l S`;
  page.commands.push(color ? `q ${pdfRgb(color)} RG ${command} Q` : command);
}

function rect(page, x, yTop, w, h, fill = 0.95) {
  const fillColor = Array.isArray(fill) ? `${pdfRgb(fill)} rg` : `${fmt(fill)} g`;
  page.commands.push(`q ${fillColor} ${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re f Q`);
}

function rectStroke(page, x, yTop, w, h, color = null) {
  const command = `${fmt(x)} ${fmt(PAGE_H - yTop - h)} ${fmt(w)} ${fmt(h)} re S`;
  page.commands.push(color ? `q ${pdfRgb(color)} RG ${command} Q` : command);
}

function pdfRgb(color) { return color.map(fmt).join(' '); }

/* Convert the page and image model into a raw PDF file */
function buildPdf(doc) {
  const images = [];
  doc.pages.forEach(page => page.images.forEach(img => images.push(img)));
  let nextObj = 5;
  images.forEach(img => { img.obj = nextObj++; });
  doc.pages.forEach(page => { page.contentObj = nextObj++; page.pageObj = nextObj++; });
  const security = doc.editLocked ? createPdfEditLockSecurity() : null;
  if (security) security.obj = nextObj++;
  const annotations = [];
  doc.pages.forEach(page => {
    page.annotations.forEach(annotation => {
      annotation.obj = nextObj++;
      annotation.pageObj = page.pageObj;
      annotations.push(annotation);
    });
  });

  const objects = [];
  objects[1] = catalogObject(annotations);
  objects[2] = `<< /Type /Pages /Kids [${doc.pages.map(p => `${p.pageObj} 0 R`).join(' ')}] /Count ${doc.pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  if (security) objects[security.obj] = pdfEncryptionObject(security);
  images.forEach(img => { objects[img.obj] = imageObject(img, security, img.obj); });
  annotations.forEach(annotation => { objects[annotation.obj] = annotationObject(annotation); });

  doc.pages.forEach(page => {
    const content = ['0 g', '0.7 w', ...page.commands].join('\n');
    objects[page.contentObj] = streamObject(asciiBytes(content), security, page.contentObj);
    const xObjects = page.images.length ? `/XObject << ${page.images.map(img => `/${img.name} ${img.obj} 0 R`).join(' ')} >>` : '';
    const annots = page.annotations.length ? `/Annots [${page.annotations.map(annotation => `${annotation.obj} 0 R`).join(' ')}]` : '';
    objects[page.pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects} >> ${annots} /Contents ${page.contentObj} 0 R >>`;
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
  const encryptionTrailer = security ? ` /Encrypt ${security.obj} 0 R /ID [<${bytesToHex(security.fileId)}> <${bytesToHex(security.fileId)}>]` : '';
  pushAscii(chunks, `trailer\n<< /Size ${objects.length} /Root 1 0 R${encryptionTrailer} >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return concatBytes(chunks);
}

function catalogObject(annotations) {
  const signatureFields = annotations.filter(annotation => annotation.type === 'signature');
  if (!signatureFields.length) return '<< /Type /Catalog /Pages 2 0 R >>';
  return `<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [${signatureFields.map(field => `${field.obj} 0 R`).join(' ')}] /SigFlags 3 /NeedAppearances true /DR << /Font << /Helv 3 0 R >> >> /DA (/Helv 0 Tf 0 g) >> >>`;
}

function annotationObject(annotation) {
  if (annotation.type === 'signature') return signatureAnnotationObject(annotation);
  throw new Error(`Unsupported PDF annotation type: ${annotation.type}`);
}

function signatureAnnotationObject(annotation) {
  return `<< /Type /Annot /Subtype /Widget /FT /Sig /T (${escapePdfString(annotation.name)}) /Rect [${annotation.rect.map(fmt).join(' ')}] /F 4 /P ${annotation.pageObj} 0 R /H /I /MK << /BC [0 0.557 0.690] /BG [1 1 1] >> >>`;
}

/* Encode an image object for PDF embedding */
function imageObject(img, security = null, objNum = 0) {
  const bytes = security ? encryptPdfObjectBytes(security, objNum, img.bytes) : img.bytes;
  return concatBytes([
    asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`),
    bytes,
    asciiBytes('\nendstream')
  ]);
}

function streamObject(bytes, security = null, objNum = 0) {
  const out = security ? encryptPdfObjectBytes(security, objNum, bytes) : bytes;
  return concatBytes([asciiBytes(`<< /Length ${out.length} >>\nstream\n`), out, asciiBytes('\nendstream')]);
}

function createPdfEditLockSecurity() {
  const fileId = randomBytes(16);
  const userPassword = padPdfPassword('');
  const ownerPassword = padPdfPassword(bytesToHex(randomBytes(16)));
  const ownerKey = md5Bytes(ownerPassword).slice(0, 5);
  const ownerEntry = rc4(ownerKey, userPassword);
  const permissions = -44; // Allow open/print/copy, disallow modification and annotation/editing in Adobe.
  const keySeed = concatBytes([userPassword, ownerEntry, int32LeBytes(permissions), fileId]);
  const fileKey = md5Bytes(keySeed).slice(0, 5);
  const userEntry = rc4(fileKey, PDF_PASSWORD_PADDING);

  return { fileId, ownerEntry, userEntry, permissions, fileKey };
}

function pdfEncryptionObject(security) {
  return `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${bytesToHex(security.ownerEntry)}> /U <${bytesToHex(security.userEntry)}> /P ${security.permissions} >>`;
}

function encryptPdfObjectBytes(security, objNum, bytes, genNum = 0) {
  const objectKeySeed = concatBytes([
    security.fileKey,
    new Uint8Array([objNum & 255, (objNum >> 8) & 255, (objNum >> 16) & 255, genNum & 255, (genNum >> 8) & 255])
  ]);
  const objectKey = md5Bytes(objectKeySeed).slice(0, Math.min(security.fileKey.length + 5, 16));
  return rc4(objectKey, bytes);
}

const PDF_PASSWORD_PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

function padPdfPassword(value) {
  const bytes = asciiBytes(String(value || ''));
  const out = new Uint8Array(32);
  out.set(bytes.slice(0, 32));
  if (bytes.length < 32) out.set(PDF_PASSWORD_PADDING.slice(0, 32 - bytes.length), bytes.length);
  return out;
}

function rc4(key, data) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
  }

  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

function md5Bytes(input) {
  const bytes = input instanceof Uint8Array ? input : asciiBytes(String(input));
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 8) >> 6) + 1) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  for (let i = 0; i < 8; i++) padded[paddedLength - 8 + i] = Math.floor(bitLength / (2 ** (8 * i))) & 255;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      const offset = chunk + i * 4;
      m[i] = padded[offset] | (padded[offset + 1] << 8) | (padded[offset + 2] << 16) | (padded[offset + 3] << 24);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      b = (b + leftRotate((a + f + k[i] + m[g]) >>> 0, s[i])) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((word, index) => {
    out[index * 4] = word & 255;
    out[index * 4 + 1] = (word >> 8) & 255;
    out[index * 4 + 2] = (word >> 16) & 255;
    out[index * 4 + 3] = (word >> 24) & 255;
  });
  return out;
}

function leftRotate(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function int32LeBytes(value) {
  const n = value >>> 0;
  return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]);
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
