'use strict';

/*
  App constants and store definitions
*/

/* Standard selections used in multiple checklist items */

const REQUIRED_ELEMENT_IDS = [
  'installBtn', 'newJobBtn', 'saveBtn', 'headerSignedPdfBtn', 'appLayout', 'savedDraftsPanel', 'jobList', 'currentJobTitle', 'dirtyPill',
  'documentTypeTabs', 'jobInfoFields', 'createMaterialListBtn', 'inspectionSectionTitle', 'inspectionItems', 'inHouseSectionTitle', 'inHouseItems',
  'extraDocumentSections', 'summarySection', 'summaryNotes', 'photosSection', 'addPhotosBtn', 'photoInput', 'photoGrid',
  'refreshPhotosBtn', 'clearPhotosBtn',
  'finishSection', 'finishSectionTitle', 'bottomSaveBtn', 'bottomSignedPdfBtn', 'bottomOutputStatus',
  'checklistForm'
];

const SESSION_JOB_KEY = 'absolute-aluminum-current-job';
const LOCAL_JOB_KEY = 'absolute-aluminum-current-job-backup';
const PDF_PREVIEW_GUARD_KEY = 'absolute-aluminum-pdf-preview-guard';
const PDF_PREVIEW_GUARD_MS = 10 * 60 * 1000;
const AUTO_SAVE_DELAY_MS = 700;

let currentJob = blankJob();
let deferredInstallPrompt = null;
let autoSaveTimer = null;
let autoSaveInFlight = null;
let autoSaveQueued = false;
let draftRevision = 0;
const els = {};

/* Initialize app when DOM is ready */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    cacheEls();
    populateDocumentTypeTabs();
    renderFormShell();
    bindEvents();
    await initDb();
    hydrateForm(normalizeJob(readCurrentJobSnapshot() || currentJob));
    await loadDraftList();
    await renderPhotos();
    registerServiceWorker();
  } catch (err) {
    console.error('App initialization failed', err);
    setStatus(`App could not start: ${err.message || 'unknown error'}`);
  }
});

/* Cache references to DOM elements for faster access */
function cacheEls() {
  REQUIRED_ELEMENT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing required element #${id}`);
    els[id] = el;
  });
}

/* Create a new blank job object with standard metadata */
function blankJob() {
  return {
    id: createId('job'),
    documentType: DEFAULT_DOCUMENT_TYPE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields: {},
    items: {},
    inHouse: {},
    materialItems: [],
    summaryNotes: ''
  };
}


/* Resolve a document type, falling back to the configured default. */
function getDocumentDefinition(type) {
  return DOCUMENT_TYPES[type] || DOCUMENT_TYPES[DEFAULT_DOCUMENT_TYPE];
}

/* Return the definition associated with the current draft. */
function activeDocument() {
  return getDocumentDefinition(currentJob?.documentType);
}

/* Backfill required collections and discard obsolete local-signature fields. */
function normalizeJob(job) {
  const out = job || blankJob();
  out.documentType = getDocumentDefinition(out.documentType).id;
  out.fields = out.fields || {};
  if (!String(out.fields.firstName || '').trim()
    && !String(out.fields.lastName || '').trim()
    && String(out.fields.customerName || '').trim()) {
    const legacyName = splitCustomerName(out.fields.customerName);
    out.fields.firstName = legacyName.firstName;
    out.fields.lastName = legacyName.lastName;
  }
  if (!Object.prototype.hasOwnProperty.call(out.fields, 'streetAddress')
    && out.fields.address
    && !out.fields.city
    && !out.fields.state
    && !out.fields.zip) {
    out.fields.streetAddress = out.fields.address;
  }
  const stateOnlyAddress = (out.fields.state || '').trim().toUpperCase();
  if (stateOnlyAddress
    && (out.fields.streetAddress || '').trim().toUpperCase() === stateOnlyAddress
    && (out.fields.address || '').trim().toUpperCase() === stateOnlyAddress
    && !(out.fields.city || '').trim()
    && !(out.fields.zip || '').trim()) {
    out.fields.streetAddress = '';
  }
  out.items = out.items || {};
  out.inHouse = out.inHouse || {};
  out.gutters = out.gutters || {};
  out.pergolaPan6 = out.pergolaPan6 || {};
  out.general = out.general || {};
  out.materialItems = Array.isArray(out.materialItems) ? out.materialItems : [];
  if (out.documentType === 'materialList' && out.fields.materialCategory) {
    const legacyCategory = out.fields.materialCategory;
    if (!out.materialItems.length) out.materialItems.push({ category: legacyCategory, product: '', color: '', quantity: '' });
    else out.materialItems = out.materialItems.map(item => ({ ...item, category: item.category || legacyCategory }));
    delete out.fields.materialCategory;
  }
  out.summaryNotes = out.summaryNotes || '';
  // One Click Contractor owns the signature workflow. Remove legacy local-signature data
  // so older drafts cannot embed a captured signature in a newly generated packet.
  delete out.signatureMode;
  delete out.signatureName;
  delete out.signatureDate;
  delete out.signatureImage;
  delete out.signatureTypedName;
  return out;
}

/* Populate the document tabs from the central definitions map. */
function populateDocumentTypeTabs() {
  els.documentTypeTabs.innerHTML = Object.values(DOCUMENT_TYPES)
    .map(doc => `<button class="document-type-tab" type="button" role="tab" data-document-type="${doc.id}" aria-controls="jobInfoFields" aria-selected="false" tabindex="-1">${escapeHtml(doc.label)}</button>`)
    .join('');
}

/* Keep the selected tab synchronized with the active document draft. */
function updateDocumentTypeTabs(type) {
  const activeType = getDocumentDefinition(type).id;
  const tabs = Array.from(els.documentTypeTabs.querySelectorAll('[data-document-type]'));
  tabs.forEach(tab => {
    const selected = tab.dataset.documentType === activeType;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

/* Build the form UI from the checklist definitions */
function renderFormShell() {
  const doc = activeDocument();
  updateDocumentTypeTabs(doc.id);
  els.inspectionSectionTitle.textContent = doc.groups[0]?.title || 'Document Items';
  els.inHouseSectionTitle.textContent = doc.groups[1]?.title || 'Additional Items';
  els.summaryNotes.placeholder = doc.summaryPlaceholder || 'Enter summary notes...';
  els.createMaterialListBtn.classList.toggle('hidden', doc.id !== 'qualityControl');
  const isMaterialList = doc.id === 'materialList';
  els.summarySection.classList.toggle('hidden', isMaterialList);
  els.photosSection.classList.toggle('hidden', isMaterialList);
  els.finishSectionTitle.textContent = isMaterialList ? 'Finish Document' : 'Finish Checklist';
  els.jobInfoFields.innerHTML = doc.fields.map(field => `
    <label class="field ${field.fullWidth ? 'full-field' : ''} ${field.additionalInstallCrew ? 'hidden' : ''}"${field.additionalInstallCrew ? ' data-additional-install-crew="true"' : ''}>
      <span>${escapeHtml(field.label)}</span>
      ${renderJobFieldControl(field)}
    </label>
  `).join('');
  els.inspectionSectionTitle.closest('.card')?.classList.toggle('hidden', !doc.groups[0]);
  els.inHouseSectionTitle.closest('.card')?.classList.toggle('hidden', !doc.groups[1]);
  els.inspectionItems.innerHTML = (doc.groups[0]?.items || []).map(item => renderChecklistItem(item, doc.groups[0].key)).join('');
  els.inHouseItems.innerHTML = (doc.groups[1]?.items || []).map(item => renderChecklistItem(item, doc.groups[1].key)).join('');
  els.extraDocumentSections.innerHTML = doc.groups.slice(2).map(group => `
    <section class="card">
      <h2>${escapeHtml(group.title)}</h2>
      <div>${group.items.map(item => renderChecklistItem(item, group.key)).join('')}</div>
    </section>
  `).join('') + (doc.id === 'materialList' ? renderMaterialListSection() : '');
  updateMaterialProductOptions();
}

/* Render a job-information text field or configured dropdown. */
function renderJobFieldControl(field) {
  if (field.options) {
    return `<select id="field_${field.id}" data-kind="job-field" data-id="${field.id}">
      ${clearableOptions(field.options).map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option || 'Select...')}</option>`).join('')}
    </select>`;
  }
  return `<input id="field_${field.id}" data-kind="job-field" data-id="${field.id}" type="${field.type || 'text'}"${field.autocomplete ? ` autocomplete="${field.autocomplete}"` : ''}${field.inputMode ? ` inputmode="${field.inputMode}"` : ''}${field.maxLength ? ` maxlength="${field.maxLength}"` : ''}${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}>`;
}

/* Render the repeatable product, color, and quantity editor for Material List. */
function renderMaterialListSection() {
  const items = [...(currentJob.materialItems || [])];
  if (!items.length || isMaterialItemComplete(items[items.length - 1])) items.push({});
  return `
    <section class="card material-list-card">
      <h2>Material Items</h2>
      <label class="field full-field material-search-field">
        <span>Search products</span>
        <input id="materialProductSearch" type="search" autocomplete="off" placeholder="Search all categories...">
      </label>
      <div id="materialProductSearchResults" class="material-search-results hidden" aria-live="polite"></div>
      <div id="materialListItems">${items.map(renderMaterialItemRow).join('')}</div>
    </section>
  `;
}

/* Show matching products across every material category. */
function renderMaterialSearchResults(query) {
  const results = document.getElementById('materialProductSearchResults');
  if (!results) return;
  const searchQuery = String(query || '').trim();
  if (!searchQuery) {
    results.innerHTML = '';
    results.classList.add('hidden');
    return;
  }

  const matches = MATERIAL_GROUPS.flatMap(group => group.items
    .filter(product => materialSearchMatches(`${group.name} ${product}`, searchQuery))
    .map(product => ({ category: group.name, product })));
  results.innerHTML = matches.length
    ? matches.map(match => `<button class="material-search-result" type="button" data-category="${escapeHtml(match.category)}" data-product="${escapeHtml(match.product)}"><strong>${escapeHtml(match.product)}</strong><span>${escapeHtml(match.category)}</span></button>`).join('')
    : '<p class="material-search-empty">No matching products.</p>';
  results.classList.remove('hidden');
}

function normalizeMaterialSearchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function materialSearchMatches(value, query) {
  const normalizedValue = normalizeMaterialSearchText(value);
  const normalizedQuery = normalizeMaterialSearchText(query);
  if (!normalizedQuery) return false;
  if (normalizedValue.includes(normalizedQuery)) return true;

  const queryWords = String(query).toLowerCase().match(/[a-z0-9]+/g) || [];
  const valueWords = String(value).toLowerCase().match(/[a-z0-9]+/g) || [];
  return queryWords.every(queryWord => {
    const normalizedWord = normalizeMaterialSearchText(queryWord);
    return valueWords.some(valueWord => {
      const normalizedValueWord = normalizeMaterialSearchText(valueWord);
      if (normalizedValueWord.includes(normalizedWord)) return true;
      return normalizedWord.length >= 4 && fuzzyMaterialWordMatch(normalizedWord, normalizedValueWord);
    });
  });
}

function fuzzyMaterialWordMatch(queryWord, valueWord) {
  const maxDistance = queryWord.length >= 8 ? 2 : 1;
  if (Math.abs(queryWord.length - valueWord.length) > maxDistance) return false;

  let previous = Array.from({ length: valueWord.length + 1 }, (_, index) => index);
  for (let queryIndex = 1; queryIndex <= queryWord.length; queryIndex++) {
    const current = [queryIndex];
    let rowMinimum = queryIndex;
    for (let valueIndex = 1; valueIndex <= valueWord.length; valueIndex++) {
      const cost = queryWord[queryIndex - 1] === valueWord[valueIndex - 1] ? 0 : 1;
      current[valueIndex] = Math.min(
        current[valueIndex - 1] + 1,
        previous[valueIndex] + 1,
        previous[valueIndex - 1] + cost
      );
      rowMinimum = Math.min(rowMinimum, current[valueIndex]);
    }
    if (rowMinimum > maxDistance) return false;
    previous = current;
  }
  return previous[valueWord.length] <= maxDistance;
}

/* Add a catalog search selection to the first row that has no product yet. */
function selectMaterialSearchResult(category, product) {
  const container = document.getElementById('materialListItems');
  if (!container) return;
  let row = Array.from(container.querySelectorAll('.material-row'))
    .find(materialRow => !materialRow.querySelector('[data-material-field="product"]')?.value);
  if (!row) {
    container.insertAdjacentHTML('beforeend', renderMaterialItemRow());
    row = container.lastElementChild;
  }

  const categorySelect = row.querySelector('[data-material-field="category"]');
  categorySelect.value = category;
  updateMaterialProductOptions(row);
  row.querySelector('[data-material-field="product"]').value = product;
  ensureTrailingMaterialRow();

  const search = document.getElementById('materialProductSearch');
  if (search) search.value = '';
  renderMaterialSearchResults('');
  markDraftChanged();
}

function isMaterialItemComplete(item) {
  return Boolean(item.category && item.product);
}

function ensureTrailingMaterialRow() {
  const container = document.getElementById('materialListItems');
  if (!container) return;
  const rows = Array.from(container.querySelectorAll('.material-row'));
  const lastRow = rows[rows.length - 1];
  if (!lastRow || !isMaterialItemComplete(readMaterialItemRow(lastRow))) return;
  container.insertAdjacentHTML('beforeend', renderMaterialItemRow());
  updateMaterialProductOptions(container.lastElementChild);
}

function readMaterialItemRow(row) {
  return {
    category: row.querySelector('[data-material-field="category"]')?.value || '',
    product: row.querySelector('[data-material-field="product"]')?.value || '',
    color: row.querySelector('[data-material-field="color"]')?.value || '',
    quantity: row.querySelector('[data-material-field="quantity"]')?.value || '',
    unit: row.querySelector('[data-material-field="unit"]')?.value || ''
  };
}

/* Render one selectable material line. */
function renderMaterialItemRow(item = {}) {
  return `
    <div class="material-row" data-material-category="${escapeHtml(item.category || '')}">
      <label class="field material-category-field">
        <span>Category</span>
        <select data-material-field="category">
          <option value="">Select category...</option>
          ${MATERIAL_GROUPS.map(group => `<option value="${escapeHtml(group.name)}"${item.category === group.name ? ' selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field material-product-field">
        <span>Product</span>
        ${renderMaterialProductControl(item.category, item.product)}
      </label>
      <label class="field">
        <span>Color</span>
        <select data-material-field="color">
          <option value="">Select color...</option>
          ${['Bronze', 'White', 'Translucent'].map(color => `<option value="${color}"${item.color === color ? ' selected' : ''}>${color}</option>`).join('')}
        </select>
      </label>
      <label class="field material-quantity-field">
        <span>Quantity</span>
        <input data-material-field="quantity" type="number" min="1" step="1" value="${escapeHtml(item.quantity || '')}">
      </label>
      <label class="field material-unit-field">
        <span>Unit</span>
        <select data-material-field="unit">
          <option value="">Select...</option>
          ${['lft', 'in.', 'ea'].map(unit => `<option value="${unit}"${item.unit === unit ? ' selected' : ''}>${unit}</option>`).join('')}
        </select>
      </label>
      <button class="danger subtle remove-material-item" type="button" aria-label="Remove material item">Remove</button>
    </div>
  `;
}

function renderMaterialProductControl(category, product = '') {
  if (category === 'Miscellaneous') {
    return `<input data-material-field="product" type="text" placeholder="Enter product..." value="${escapeHtml(product)}">`;
  }
  const products = getMaterialGroup(category)?.items || [];
  return `<select data-material-field="product"${products.length ? '' : ' disabled'}>
    <option value="">Select product...</option>
    ${products.map(option => `<option value="${escapeHtml(option)}"${product === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
  </select>`;
}

function getMaterialGroup(category) {
  return MATERIAL_GROUPS.find(group => group.name === category) || null;
}

/* Restrict one material row's product choices to its selected category. */
function updateMaterialProductOptions(row = null) {
  const rows = row ? [row] : Array.from(document.querySelectorAll('.material-row'));
  rows.forEach(materialRow => {
    const category = materialRow.querySelector('[data-material-field="category"]')?.value;
    const products = getMaterialGroup(category)?.items || [];
    const productControl = materialRow.querySelector('[data-material-field="product"]');
    if (!productControl) return;
    const previousCategory = materialRow.dataset.materialCategory || '';
    const previousProduct = productControl.value;
    const product = previousCategory === category
      ? category === 'Miscellaneous' || products.includes(previousProduct) ? previousProduct : ''
      : '';
    productControl.outerHTML = renderMaterialProductControl(category, product);
    materialRow.dataset.materialCategory = category || '';
  });
}

/* Read visible material rows into the saved job shape. */
function collectMaterialItems() {
  return Array.from(document.querySelectorAll('.material-row')).map(row => ({
    category: row.querySelector('[data-material-field="category"]')?.value || '',
    product: row.querySelector('[data-material-field="product"]')?.value || '',
    color: row.querySelector('[data-material-field="color"]')?.value.trim() || '',
    quantity: row.querySelector('[data-material-field="quantity"]')?.value || '',
    unit: row.querySelector('[data-material-field="unit"]')?.value || ''
  })).filter(item => item.category || item.product || item.color || item.quantity || item.unit);
}

/* Render a single checklist item card */
function renderChecklistItem(item, kind) {
  const control = item.options ? renderSelectControl(item, kind) : renderTextControl(item, kind);
  const wording = renderDisplayedWording(item);
  return `
    <div class="item-card" data-kind="${kind}" data-item-id="${item.id}">
      <div class="item-title">${escapeHtml(item.label)}</div>
      <div class="item-control">
        ${control}
        ${wording}
      </div>
    </div>
  `;
}

/* Render a dropdown for option-based checklist items */
function renderSelectControl(item, kind) {
  return `
    <label class="field">
      <span>Selection</span>
      <select data-kind="${kind}" data-id="${item.id}" data-prop="selection">
        ${clearableOptions(item.options).map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt || 'Select...')}</option>`).join('')}
      </select>
    </label>
  `;
}

/* Ensure every dropdown can be returned to an unselected state. */
function clearableOptions(options) {
  return options.includes('') ? options : ['', ...options];
}

/* Render a free-form text area for value-based checklist items */
function renderTextControl(item, kind) {
  if (item.type === 'date') {
    return `
      <label class="field full-field">
        <span>Value</span>
        <input type="date" data-kind="${kind}" data-id="${item.id}" data-prop="value">
      </label>
    `;
  }
  return `
    <label class="field full-field">
      <span>Value</span>
      <textarea rows="2" data-kind="${kind}" data-id="${item.id}" data-prop="value" placeholder="Enter value..."></textarea>
    </label>
  `;
}

/* Render optional wording guidance for checklist item selections */
function renderDisplayedWording(item) {
  const rows = activeDocument().displayedWording?.[item.id];
  if (!rows || !rows.length) return '';
  return `
    <div class="displayed-wording">
      <div class="displayed-wording-title">Displayed wording for selections:</div>
      ${rows.map(([selection, wording]) => `
        <div class="displayed-wording-row">
          <strong>${escapeHtml(selection)}:</strong>
          <span>${escapeHtml(wording)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* Wire UI controls for form behavior, saving, and photo handling */
function bindEvents() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });

  els.newJobBtn.addEventListener('click', async () => {
    if (isDirty() && !confirm('Start a new document? Unsaved changes will be lost.')) return;
    const documentType = activeDocument().id;
    currentJob = blankJob();
    currentJob.documentType = documentType;
    hydrateForm(currentJob);
    await renderPhotos();
    markDirty(false);
  });

  bindAsyncClick(els.createMaterialListBtn, createMaterialListFromQualityControl, 'Material List creation failed');

  els.checklistForm.addEventListener('click', event => {
    const searchResult = event.target?.closest('.material-search-result');
    if (searchResult) {
      selectMaterialSearchResult(searchResult.dataset.category, searchResult.dataset.product);
      return;
    }
    if (event.target?.closest('.remove-material-item')) {
      event.target.closest('.material-row')?.remove();
      ensureTrailingMaterialRow();
      markDraftChanged();
    }
  });

  els.documentTypeTabs.addEventListener('click', async event => {
    const tab = event.target.closest('[data-document-type]');
    if (!tab) return;
    try {
      const switched = await switchDocumentType(tab.dataset.documentType);
      if (!switched) els.documentTypeTabs.querySelector('[aria-selected="true"]')?.focus();
    } catch (err) {
      console.error('Document type switch failed', err);
      setStatus(`Could not switch document type: ${err.message || 'unknown error'}`);
    }
  });

  els.documentTypeTabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(els.documentTypeTabs.querySelectorAll('[data-document-type]'));
    const currentIndex = tabs.indexOf(event.target.closest('[data-document-type]'));
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });

  els.savedDraftsPanel.addEventListener('toggle', () => {
    els.appLayout.classList.toggle('drafts-collapsed', !els.savedDraftsPanel.open);
    els.savedDraftsPanel.querySelector('summary').title = els.savedDraftsPanel.open ? 'Hide Saved Drafts' : 'Show Saved Drafts';
    els.savedDraftsPanel.querySelector('.saved-drafts-toggle-label').textContent = els.savedDraftsPanel.open ? 'Collapse' : 'Expand';
  });
  els.appLayout.classList.toggle('drafts-collapsed', !els.savedDraftsPanel.open);
  els.savedDraftsPanel.querySelector('summary').title = els.savedDraftsPanel.open ? 'Hide Saved Drafts' : 'Show Saved Drafts';
  els.savedDraftsPanel.querySelector('.saved-drafts-toggle-label').textContent = els.savedDraftsPanel.open ? 'Collapse' : 'Expand';

  window.addEventListener('pagehide', () => {
    writeCurrentJobSnapshot();
    flushAutoSave();
  });
  window.addEventListener('pageshow', () => {
    restoreCurrentJobSnapshotIfNeeded();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeCurrentJobSnapshot();
      flushAutoSave();
    } else if (document.visibilityState === 'visible') {
      restoreCurrentJobSnapshotIfNeeded();
    }
  });

  bindAsyncClick(els.saveBtn, saveCurrentDraft, 'Save failed');
  els.checklistForm.addEventListener('input', event => {
    if (event.target?.id === 'materialProductSearch') {
      renderMaterialSearchResults(event.target.value);
      return;
    }
    if (event.target?.closest('.material-row')) ensureTrailingMaterialRow();
    markDraftChanged();
  });
  els.checklistForm.addEventListener('change', event => {
    if (event.target?.matches('[data-kind="job-field"]')) updateAdditionalInstallCrewFields();
    if (event.target?.dataset.materialField === 'category') updateMaterialProductOptions(event.target.closest('.material-row'));
    if (event.target?.closest('.material-row')) ensureTrailingMaterialRow();
    markDraftChanged();
  });

  els.addPhotosBtn.addEventListener('click', () => {
    els.photoInput.value = '';
    els.photoInput.click();
  });

  els.photoInput.addEventListener('change', async event => {
    const files = Array.from(event.target.files || []);
    try {
      setStatus(files.length ? `Selected ${files.length} photo(s). Importing...` : 'No photos selected.');
      await addPhotoFiles(files);
    } catch (err) {
      console.error('Photo selection failed', err);
      setStatus(`Photo import failed: ${err.message || 'unknown error'}`);
    } finally {
      event.target.value = '';
    }
  });

  bindAsyncClick(els.refreshPhotosBtn, renderPhotos, 'Photo refresh failed');
  els.clearPhotosBtn.addEventListener('click', async () => {
    if (!confirm('Remove every photo from this draft?')) return;
    try {
      const photos = await getCurrentPhotos();
      for (const photo of photos) await deleteStore('photos', photo.id);
      await renderPhotos();
      markDirty(true);
    } catch (err) {
      console.error('Photo clearing failed', err);
      setStatus(`Could not clear photos: ${err.message || 'unknown error'}`);
    }
  });

  els.headerSignedPdfBtn.addEventListener('click', generatePacket);
  bindAsyncClick(els.bottomSaveBtn, saveCurrentDraft, 'Save failed');
  els.bottomSignedPdfBtn.addEventListener('click', generatePacket);
}

/* Save the QC draft and create a separate Material List draft with shared job details. */
async function createMaterialListFromQualityControl() {
  if (activeDocument().id !== 'qualityControl') return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  if (autoSaveInFlight) await autoSaveInFlight;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  autoSaveQueued = false;
  const qualityControlJob = collectJobFromForm();
  await putStore('jobs', qualityControlJob);

  const materialJob = blankJob();
  materialJob.documentType = 'materialList';
  ['firstName', 'lastName', 'streetAddress', 'city', 'state', 'jobNumberPhase'].forEach(id => {
    materialJob.fields[id] = qualityControlJob.fields[id] || '';
  });
  materialJob.fields.address = formatAddress(materialJob.fields);
  currentJob = materialJob;
  await putStore('jobs', currentJob);
  await loadDraftList();
  await renderPhotos();
  hydrateForm(currentJob);
  els.currentJobTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setStatus('Created and opened a Material List draft from Quality Control.');
}

/* Change packet types while retaining shared customer and job details. */
async function switchDocumentType(nextType) {
  nextType = getDocumentDefinition(nextType).id;
  if (nextType === currentJob.documentType) return true;
  if (isDirty() && !confirm('Switch document type? Unsaved changes in this draft will be lost.')) return false;

  const previous = collectJobFromForm(currentJob.documentType);
  const nextJob = blankJob();
  nextJob.documentType = nextType;
  ['firstName', 'lastName', 'streetAddress', 'city', 'state', 'zip', 'address', 'email', 'phone', 'jobNumberPhase', 'gateCode'].forEach(id => {
    if (previous.fields?.[id]) nextJob.fields[id] = previous.fields[id];
  });
  currentJob = nextJob;
  hydrateForm(currentJob);
  await renderPhotos();
  markDirty(false);
  return true;
}

/* Run an async click action with consistent error reporting. */
function bindAsyncClick(el, action, label) {
  el.addEventListener('click', async () => {
    try {
      await action();
    } catch (err) {
      console.error(label, err);
      setStatus(`${label}: ${err.message || 'unknown error'}`);
    }
  });
}


/* Track unsaved changes and update status indicators */
function isDirty() { return els.dirtyPill && !els.dirtyPill.classList.contains('saved'); }
/* Record a form edit and schedule a quiet save. */
function markDraftChanged() {
  clearPdfPreviewGuard();
  draftRevision++;
  markDirty(true);
  queueAutoSave();
}
/* Update the draft-state badge after form or persistence changes. */
function markDirty(dirty) {
  els.dirtyPill.textContent = dirty ? 'Unsaved' : 'Saved';
  els.dirtyPill.classList.toggle('saved', !dirty);
}
/* Mirror output status text to the sidebar and bottom action area. */
function setStatus(message) {
  const text = message || '';
  if (els.bottomOutputStatus) els.bottomOutputStatus.textContent = text;
}

/* Build the job object from current form values */
function collectJobFromForm(documentTypeOverride = null) {
  const job = normalizeJob(currentJob || blankJob());
  const doc = getDocumentDefinition(documentTypeOverride || job.documentType);
  job.documentType = doc.id;
  job.updatedAt = new Date().toISOString();
  job.fields = {};
  doc.fields.forEach(field => {
    job.fields[field.id] = jobFieldValueForSave(field);
  });
  job.materialItems = doc.id === 'materialList' ? collectMaterialItems() : [];
  job.fields.state = (job.fields.state || '').toUpperCase();
  job.fields.address = formatAddress(job.fields);
  doc.groups.forEach(group => {
    job[group.key] = collectItemGroup(group.key, group.items);
  });
  job.summaryNotes = els.summaryNotes.value.trim();

  return job;
}


/* Collect item group values from the rendered checklist fields */
function collectItemGroup(kind, list) {
  const out = {};
  list.forEach(item => {
    const el = getItemControl(kind, item);
    if (item.options) {
      out[item.id] = { selection: el?.value || '' };
    } else {
      out[item.id] = { value: el?.value.trim() || '' };
    }
  });
  return out;
}

/* Store a same-tab form snapshot so iOS PDF preview back navigation can restore it. */
function writeCurrentJobSnapshot(job = null) {
  try {
    const snapshot = job || collectJobFromForm();
    const existing = readCurrentJobSnapshot();
    if (shouldKeepExistingPreviewDraft(existing, snapshot)) return;
    const raw = JSON.stringify(snapshot);
    sessionStorage.setItem(SESSION_JOB_KEY, raw);
    localStorage.setItem(LOCAL_JOB_KEY, raw);
  } catch (err) {
    console.warn('Could not snapshot current job', err);
  }
}

/* Read the same-tab form snapshot created before Safari/iOS leaves for PDF preview. */
function readCurrentJobSnapshot() {
  try {
    const sessionJob = parseStoredJob(sessionStorage.getItem(SESSION_JOB_KEY));
    const localJob = parseStoredJob(localStorage.getItem(LOCAL_JOB_KEY));
    return richestJob(sessionJob, localJob);
  } catch (err) {
    console.warn('Could not restore current job snapshot', err);
    return null;
  }
}

/* Parse a stored draft without letting storage corruption break startup. */
function parseStoredJob(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Ignoring invalid stored draft snapshot', err);
    return null;
  }
}

/* Recover the rendered form after iOS/Safari returns from an in-tab PDF preview. */
async function restoreCurrentJobSnapshotIfNeeded() {
  try {
    const guard = getPdfPreviewGuard();
    if (!guard || !isPdfPreviewGuardActive(guard.jobId)) return;

    const storedSnapshot = readCurrentJobSnapshot();
    const savedJob = guard.jobId ? await getJob(guard.jobId) : null;
    const snapshot = richestJob(storedSnapshot, savedJob);
    if (!snapshot) return;

    const liveJob = collectJobFromForm(snapshot.documentType);
    if (jobContentScore(snapshot) > jobContentScore(liveJob)) {
      hydrateForm(snapshot);
      setStatus('Restored draft after PDF preview.');
    }
  } catch (err) {
    console.warn('Could not restore PDF preview draft', err);
  }
}

/* Mark the current draft as protected while iOS may navigate to a blob preview. */
function setPdfPreviewGuard(job) {
  try {
    localStorage.setItem(PDF_PREVIEW_GUARD_KEY, JSON.stringify({
      jobId: job.id,
      createdAt: Date.now()
    }));
  } catch (err) {
    console.warn('Could not protect PDF preview draft', err);
  }
}

/* Remove preview protection after the user edits the restored form. */
function clearPdfPreviewGuard() {
  try {
    localStorage.removeItem(PDF_PREVIEW_GUARD_KEY);
  } catch (err) {
    console.warn('Could not clear PDF preview protection', err);
  }
}

/* Return whether the recent PDF preview guard still applies to a draft. */
function isPdfPreviewGuardActive(jobId = null) {
  const guard = getPdfPreviewGuard();
  if (!guard) return false;
  if (Date.now() - Number(guard.createdAt || 0) > PDF_PREVIEW_GUARD_MS) {
    clearPdfPreviewGuard();
    return false;
  }
  return !jobId || guard.jobId === jobId;
}

/* Read the active PDF preview guard, if any. */
function getPdfPreviewGuard() {
  try {
    return parseStoredJob(localStorage.getItem(PDF_PREVIEW_GUARD_KEY));
  } catch (err) {
    console.warn('Could not read PDF preview protection', err);
    return null;
  }
}

/* During PDF preview return, avoid replacing a good draft with a sparse same-draft copy. */
function shouldKeepExistingPreviewDraft(existing, next) {
  if (!existing || !next) return false;
  const existingJob = normalizeJob(existing);
  const nextJob = normalizeJob(next);
  return isPdfPreviewGuardActive(existingJob.id)
    && existingJob.id === nextJob.id
    && jobContentScore(existingJob) > jobContentScore(nextJob);
}

/* Choose the draft copy with the most visible content. */
function richestJob(...jobs) {
  return jobs
    .filter(Boolean)
    .map(normalizeJob)
    .sort((a, b) => jobContentScore(b) - jobContentScore(a))[0] || null;
}

/* Count filled draft values so a richer backup can recover a sparsely restored form. */
function jobContentScore(job) {
  if (!job) return 0;
  const doc = getDocumentDefinition(job.documentType);
  let score = 0;
  doc.fields.forEach(field => { if (hasPlainValue(job.fields?.[field.id])) score++; });
  if (hasPlainValue(job.summaryNotes)) score++;
  score += job.materialItems.filter(item => item.category || item.product || item.color || item.quantity).length;
  doc.groups.forEach(group => group.items.forEach(item => {
    const row = job[group.key]?.[item.id] || {};
    if (hasPlainValue(item.options ? row.selection : row.value)) score++;
  }));
  return score;
}

/* Check whether a draft value contains user-visible content. */
function hasPlainValue(value) {
  return String(value ?? '').trim().length > 0;
}

/* Save soon after typing without interrupting the current input focus. */
function queueAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSaveCurrentDraft, AUTO_SAVE_DELAY_MS);
}

/* Try to persist immediately when the browser is about to background the app. */
function flushAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  if (isDirty()) autoSaveCurrentDraft();
}

/* Persist the draft quietly, coalescing edits made while a save is in progress. */
async function autoSaveCurrentDraft() {
  if (autoSaveInFlight) {
    autoSaveQueued = true;
    return autoSaveInFlight;
  }

  autoSaveInFlight = persistCurrentDraft({
    rehydrate: false,
    statusMessage: `Autosaved draft at ${new Date().toLocaleTimeString()}.`
  }).catch(err => {
    console.error('Autosave failed', err);
    setStatus(`Autosave failed: ${err.message || 'unknown error'}`);
  }).finally(() => {
    autoSaveInFlight = null;
    if (autoSaveQueued) {
      autoSaveQueued = false;
      queueAutoSave();
    }
  });

  return autoSaveInFlight;
}

/* Render a saved job record back into the form */
function hydrateForm(job) {
  currentJob = normalizeJob(job);
  renderFormShell();
  const doc = activeDocument();
  updateDocumentTypeTabs(doc.id);
  doc.fields.forEach(field => {
    const el = document.getElementById(`field_${field.id}`);
    if (el) el.value = currentJob.fields?.[field.id] || field.defaultValue || '';
  });
  if (doc.id === 'materialList') {
    updateMaterialProductOptions();
    document.querySelectorAll('#materialListItems .material-row').forEach((row, index) => {
      const item = currentJob.materialItems[index] || {};
      const product = row.querySelector('[data-material-field="product"]');
      if (product) product.value = item.product || '';
    });
  }
  doc.groups.forEach(group => hydrateItemGroup(group.key, group.items, currentJob[group.key] || {}));
  els.summaryNotes.value = currentJob.summaryNotes || '';
  els.currentJobTitle.textContent = draftTitle(currentJob, 'New Document');
  updateAdditionalInstallCrewFields();
  writeCurrentJobSnapshot(currentJob);
  markDirty(false);
}

/* Reveal each additional install crew only after the previous crew is populated. */
function updateAdditionalInstallCrewFields() {
  activeDocument().fields
    .filter(field => field.additionalInstallCrew)
    .forEach(field => {
      const el = document.getElementById(`field_${field.id}`);
      const previousEl = document.getElementById(`field_${field.previousCrewField}`);
      const shouldShow = isCrewSelection(previousEl?.value);
      el?.closest('.field')?.classList.toggle('hidden', !shouldShow);
      if (!shouldShow && el) el.value = '';
    });
}

/* Treat blank and N/A as non-crews for staged additional install crew fields. */
function isCrewSelection(value) {
  const normalized = String(value || '').trim();
  return normalized && normalized !== 'N/A';
}

/* Hidden staged install crew fields should not keep stale values. */
function jobFieldValueForSave(field) {
  const el = document.getElementById(`field_${field.id}`);
  if (!el) return '';
  if (field.additionalInstallCrew && el.closest('.field')?.classList.contains('hidden')) return '';
  return el.value.trim();
}

/* Restore one saved checklist group into its rendered controls. */
function hydrateItemGroup(kind, list, data) {
  list.forEach(item => {
    const row = data[item.id] || {};
    const el = getItemControl(kind, item);
    if (!el) return;
    if (item.options) {
      el.value = item.options.includes(row.selection) ? row.selection : '';
    } else {
      el.value = row.value || '';
    }
  });
}

/* Locate the rendered input associated with a checklist definition. */
function getItemControl(kind, item) {
  const prop = item.options ? 'selection' : 'value';
  return document.querySelector(`[data-kind="${kind}"][data-id="${item.id}"][data-prop="${prop}"]`);
}

/* Save current draft to IndexedDB and refresh UI state */
async function saveCurrentDraft() {
  await persistCurrentDraft({
    rehydrate: true,
    statusMessage: `Saved draft at ${new Date().toLocaleTimeString()}.`
  });
}

/* Write the current draft and optionally refresh the rendered form. */
async function persistCurrentDraft({ rehydrate = false, statusMessage = '' } = {}) {
  const revisionAtSave = draftRevision;
  const nextJob = collectJobFromForm();
  const existingJob = nextJob.id ? await getJob(nextJob.id) : null;
  if (shouldKeepExistingPreviewDraft(existingJob, nextJob)) {
    currentJob = normalizeJob(existingJob);
    writeCurrentJobSnapshot(currentJob);
    if (rehydrate) hydrateForm(currentJob);
    if (statusMessage) setStatus('Kept restored draft after PDF preview.');
    return;
  }
  currentJob = nextJob;
  await putStore('jobs', currentJob);
  writeCurrentJobSnapshot(currentJob);
  await loadDraftList();
  if (rehydrate) {
    hydrateForm(currentJob);
  } else {
    els.currentJobTitle.textContent = draftTitle(currentJob, 'New Document');
    if (draftRevision === revisionAtSave) markDirty(false);
  }
  if (statusMessage) setStatus(statusMessage);
}

/* Initialize IndexedDB if needed and hold a promise for later use */

/* Populate the saved drafts sidebar with available jobs */
async function loadDraftList() {
  const jobs = (await getAll('jobs')).map(normalizeJob).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!jobs.length) {
    els.jobList.innerHTML = '<p class="muted small">No saved drafts yet.</p>';
    return;
  }

  els.jobList.innerHTML = '';
  jobs.forEach(job => {
    const row = document.createElement('div');
    row.className = 'draft-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'draft-button';
    const doc = getDocumentDefinition(job.documentType);
    const title = draftTitle(job, 'Untitled Document');
    const downloadedLabel = job.downloadedAt ? `Downloaded ${new Date(job.downloadedAt).toLocaleString()}` : '';
    const downloadedIcon = job.downloadedAt
      ? `<span class="draft-downloaded-icon" title="${escapeHtml(downloadedLabel)}" aria-label="${escapeHtml(downloadedLabel)}">&#10003;</span>`
      : '';
    btn.innerHTML = `<small class="draft-document-type">${escapeHtml(doc.label)}</small><span class="draft-title-line"><strong>${escapeHtml(title)}</strong>${downloadedIcon}</span><small>${escapeHtml(formatAddress(job.fields))}</small><small>Updated ${new Date(job.updatedAt).toLocaleString()}</small>`;

    btn.addEventListener('click', async () => {
      if (isDirty() && !confirm('Load this draft? Unsaved changes will be lost.')) return;
      try {
        const full = await getJob(job.id);
        if (!full) throw new Error('Saved draft could not be found.');
        hydrateForm(full);
        await renderPhotos();
      } catch (err) {
        console.error('Draft load failed', err);
        setStatus(`Could not load draft: ${err.message || 'unknown error'}`);
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger subtle draft-delete-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${title}`);
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
      try {
        const photos = (await getAll('photos')).filter(photo => photo.jobId === job.id);
        for (const photo of photos) await deleteStore('photos', photo.id);
        await deleteStore('jobs', job.id);

        if (currentJob.id === job.id) {
          const documentType = currentJob.documentType || DEFAULT_DOCUMENT_TYPE;
          currentJob = blankJob();
          currentJob.documentType = documentType;
          hydrateForm(currentJob);
          await renderPhotos();
        }

        await loadDraftList();
        setStatus(`Deleted draft: ${title}.`);
      } catch (err) {
        console.error('Draft deletion failed', err);
        setStatus(`Could not delete draft: ${err.message || 'unknown error'}`);
      }
    });

    row.append(btn, deleteBtn);
    els.jobList.appendChild(row);
  });
}

/* Build the saved-draft label from customer, job, and document metadata. */
function draftTitle(job, fallback = 'Untitled Document') {
  const parts = [job?.fields?.jobNumberPhase, formatCustomerName(job?.fields)].filter(Boolean);
  return parts.length ? parts.join(' - ') : fallback;
}

/* Combine populated address fields into one compact display string. */
function formatAddress(fields = {}) {
  const street = Object.prototype.hasOwnProperty.call(fields, 'streetAddress')
    ? fields.streetAddress || ''
    : fields.address || '';
  if (!street && !fields.city && !fields.zip) return '';
  const cityStateZip = [
    fields.city,
    [fields.state, fields.zip].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ');
  return [street, cityStateZip].filter(Boolean).join(', ');
}
