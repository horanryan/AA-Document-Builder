'use strict';

/*
  App constants and store definitions
*/

/* Standard selections used in multiple checklist items */

const REQUIRED_ELEMENT_IDS = [
  'installBtn', 'newJobBtn', 'saveBtn', 'headerSignedPdfBtn', 'appLayout', 'savedDraftsPanel', 'jobList', 'currentJobTitle', 'dirtyPill',
  'documentTypeTabs', 'jobInfoFields', 'inspectionSectionTitle', 'inspectionItems', 'inHouseSectionTitle', 'inHouseItems',
  'extraDocumentSections', 'summaryNotes', 'addPhotosBtn', 'photoInput', 'photoGrid',
  'refreshPhotosBtn', 'clearPhotosBtn',
  'bottomSaveBtn', 'bottomSignedPdfBtn', 'bottomOutputStatus',
  'checklistForm'
];

const SESSION_JOB_KEY = 'absolute-aluminum-current-job';
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
  els.jobInfoFields.innerHTML = doc.fields.map(field => `
    <label class="field ${field.fullWidth ? 'full-field' : ''} ${field.additionalInstallCrew ? 'hidden' : ''}"${field.additionalInstallCrew ? ' data-additional-install-crew="true"' : ''}>
      <span>${escapeHtml(field.label)}</span>
      ${renderJobFieldControl(field)}
    </label>
  `).join('');
  els.inspectionItems.innerHTML = (doc.groups[0]?.items || []).map(item => renderChecklistItem(item, doc.groups[0].key)).join('');
  els.inHouseItems.innerHTML = (doc.groups[1]?.items || []).map(item => renderChecklistItem(item, doc.groups[1].key)).join('');
  els.extraDocumentSections.innerHTML = doc.groups.slice(2).map(group => `
    <section class="card">
      <h2>${escapeHtml(group.title)}</h2>
      <div>${group.items.map(item => renderChecklistItem(item, group.key)).join('')}</div>
    </section>
  `).join('');
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeCurrentJobSnapshot();
      flushAutoSave();
    }
  });

  bindAsyncClick(els.saveBtn, saveCurrentDraft, 'Save failed');
  els.checklistForm.addEventListener('input', markDraftChanged);
  els.checklistForm.addEventListener('change', event => {
    if (event.target?.matches('[data-kind="job-field"]')) updateAdditionalInstallCrewFields();
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

/* Change packet types while retaining shared customer and job details. */
async function switchDocumentType(nextType) {
  nextType = getDocumentDefinition(nextType).id;
  if (nextType === currentJob.documentType) return true;
  if (isDirty() && !confirm('Switch document type? Unsaved changes in this draft will be lost.')) return false;

  const previous = collectJobFromForm(currentJob.documentType);
  const nextJob = blankJob();
  nextJob.documentType = nextType;
  ['customerName', 'streetAddress', 'city', 'state', 'zip', 'address', 'email', 'phone', 'jobNumberPhase', 'gateCode'].forEach(id => {
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
    sessionStorage.setItem(SESSION_JOB_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('Could not snapshot current job', err);
  }
}

/* Read the same-tab form snapshot created before Safari/iOS leaves for PDF preview. */
function readCurrentJobSnapshot() {
  try {
    const raw = sessionStorage.getItem(SESSION_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Could not restore current job snapshot', err);
    return null;
  }
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
  currentJob = collectJobFromForm();
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
    btn.innerHTML = `<strong>${escapeHtml(title)}</strong><small>${escapeHtml(doc.label)}</small><small>${escapeHtml(formatAddress(job.fields))}</small><small>Updated ${new Date(job.updatedAt).toLocaleString()}</small>`;

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
  const doc = getDocumentDefinition(job?.documentType);
  const parts = [job?.fields?.jobNumberPhase, job?.fields?.customerName].filter(Boolean);
  return parts.length ? `${parts.join(' - ')} (${doc.shortLabel})` : `${fallback} (${doc.shortLabel})`;
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
