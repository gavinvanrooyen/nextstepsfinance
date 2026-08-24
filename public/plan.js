const planState = {
  topics: [],
  content: [],
  ctas: [],
  view: 'list',
  selected: new Set(),
  filters: { status: 'all', type: 'all', pillar: 'all', missingDrive: false, search: '' },
  expandedId: null,
};

const STATUS_LABELS = {
  idea: 'Idea',
  scripted: 'Scripted',
  filmed: 'Filmed',
  edited: 'Edited',
  ready: 'Ready to publish',
  published: 'Published',
};

const STATUS_ORDER = ['idea', 'scripted', 'filmed', 'edited', 'ready', 'published'];

const PILLAR_LABELS = {
  foundations: 'Foundations',
  stability: 'Stability',
  growth: 'Growth',
  expansion: 'Expansion',
  legacy: 'Legacy',
  preservation: 'Preservation',
  seasonal: 'Seasonal',
  money_moves: 'Money Moves',
};

const STUDIO_URL = 'https://nextsteps-finance-ugc.sanity.studio';

document.querySelectorAll('.section-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.section-tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');

    const section = tab.dataset.section; // "plan" | "ideas" | "review"

    document.getElementById('section-plan').hidden = section !== 'plan';
    document.getElementById('section-ideas').hidden = section !== 'ideas';
    document.getElementById('section-review').hidden = section !== 'review';
    document.getElementById('plan-tabs').hidden = section !== 'plan';
    document.getElementById('review-tabs').hidden = section !== 'review';

    if (section === 'plan' && planState.topics.length === 0) loadPlan();
    if (section === 'ideas' && typeof initIdeasForm === 'function' && window.__ideasLoaded !== true) {
      window.__ideasLoaded = true;
      initIdeasForm();
    }
    if (section === 'review' && window.__reviewLoaded !== true) {
      window.__reviewLoaded = true;
      loadContent();
    }
  });
});

document.querySelectorAll('#plan-tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#plan-tabs .tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    planState.view = tab.dataset.planview;
    document.getElementById('plan-list').hidden = planState.view !== 'list';
    document.getElementById('plan-timeline').hidden = planState.view !== 'timeline';
    renderPlan();
  });
});

async function loadPlan() {
  try {
    const [planRes, ctaRes] = await Promise.all([fetch('/api/list-plan'), fetch('/api/list-ctas')]);
    if (!planRes.ok) throw new Error(`Server responded ${planRes.status}`);
    const data = await planRes.json();
    planState.topics = data.topics;
    planState.content = data.content;
    planState.ctas = ctaRes.ok ? await ctaRes.json() : [];
    renderSummary();
    renderFilterBar();
    renderPlan();
  } catch (err) {
    showPlanBanner(`Couldn't load the content plan: ${err.message}`, 'is-error');
  }
}

function showPlanBanner(message, kind) {
  const banner = document.getElementById('status-banner');
  banner.textContent = message;
  banner.hidden = false;
  banner.className = `status-banner ${kind}`;
  if (kind === 'is-success') setTimeout(() => { banner.hidden = true; }, 2200);
}

function renderSummary() {
  const el = document.getElementById('plan-summary');
  const total = planState.content.length;
  const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
  for (const item of planState.content) counts[item.productionStatus] = (counts[item.productionStatus] || 0) + 1;

  const videoCount = planState.content.filter((c) => c._type === 'video').length;
  const shortCount = planState.content.filter((c) => c._type === 'shortClip').length;

  el.innerHTML = `
    <div class="summary-stat">
      <span class="summary-num">${total}</span>
      <span class="summary-label">Total items (${videoCount} long-form, ${shortCount} shorts)</span>
    </div>
    ${STATUS_ORDER.map((s) => `
      <div class="summary-stat">
        <span class="summary-num status-${s}">${counts[s]}</span>
        <span class="summary-label">${STATUS_LABELS[s]}</span>
      </div>
    `).join('')}
  `;
}

function renderFilterBar() {
  let bar = document.getElementById('plan-filter-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'plan-filter-bar';
    bar.className = 'filter-bar';
    document.getElementById('plan-summary').insertAdjacentElement('afterend', bar);
  }

  const pillarsInUse = [...new Set(planState.topics.map((t) => t.pillar))];

  bar.innerHTML = `
    <input type="text" id="filter-search" class="filter-search" placeholder="Search titles &amp; hooks..." value="${escapeHtmlPlan(planState.filters.search)}" />
    <select id="filter-status" class="filter-select">
      <option value="all">All statuses</option>
      ${STATUS_ORDER.map((s) => `<option value="${s}" ${planState.filters.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
    </select>
    <select id="filter-type" class="filter-select">
      <option value="all">All types</option>
      <option value="video" ${planState.filters.type === 'video' ? 'selected' : ''}>Long-form</option>
      <option value="shortClip" ${planState.filters.type === 'shortClip' ? 'selected' : ''}>Shorts</option>
    </select>
    <select id="filter-pillar" class="filter-select">
      <option value="all">All pillars</option>
      ${pillarsInUse.map((p) => `<option value="${p}" ${planState.filters.pillar === p ? 'selected' : ''}>${PILLAR_LABELS[p] || p}</option>`).join('')}
    </select>
    <button id="filter-missing-drive" class="chip-toggle ${planState.filters.missingDrive ? 'is-active' : ''}">No Drive file</button>
    <button id="filter-clear" class="chip-toggle chip-toggle-ghost">Clear</button>
  `;

  document.getElementById('filter-search').addEventListener('input', (e) => {
    planState.filters.search = e.target.value;
    renderPlan();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    planState.filters.status = e.target.value;
    renderPlan();
  });
  document.getElementById('filter-type').addEventListener('change', (e) => {
    planState.filters.type = e.target.value;
    renderPlan();
  });
  document.getElementById('filter-pillar').addEventListener('change', (e) => {
    planState.filters.pillar = e.target.value;
    renderPlan();
  });
  document.getElementById('filter-missing-drive').addEventListener('click', () => {
    planState.filters.missingDrive = !planState.filters.missingDrive;
    renderFilterBar();
    renderPlan();
  });
  document.getElementById('filter-clear').addEventListener('click', () => {
    planState.filters = { status: 'all', type: 'all', pillar: 'all', missingDrive: false, search: '' };
    renderFilterBar();
    renderPlan();
  });
}

function getFilteredContent() {
  const f = planState.filters;
  const search = f.search.trim().toLowerCase();

  return planState.content.filter((item) => {
    if (f.status !== 'all' && item.productionStatus !== f.status) return false;
    if (f.type !== 'all' && item._type !== f.type) return false;
    if (f.pillar !== 'all' && item.pillar !== f.pillar) return false;
    if (f.missingDrive && item.driveFileId) return false;
    if (search) {
      const haystack = `${item.title || ''} ${item.hook || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderPlan() {
  if (planState.view === 'list') renderPlanList();
  else renderPlanTimeline();
  renderBulkBar();
}

function getWeekStatus(topic) {
  if (!topic?.plannedWeekStart) return null;
  const start = new Date(topic.plannedWeekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today >= start && today <= end) return 'current';

  const nextWeekStart = new Date(start);
  nextWeekStart.setDate(nextWeekStart.getDate() - 7);
  if (today >= nextWeekStart && today < start) return 'next';

  return null;
}

function renderPlanList() {
  const el = document.getElementById('plan-list');
  el.innerHTML = '';

  const filtered = getFilteredContent();
  const weekTopics = planState.topics.filter((t) => t.plannedWeek);
  const weekNumbers = [...new Set(filtered.map((c) => c.weekNumber))].sort((a, b) => a - b);

  if (weekNumbers.length === 0) {
    el.innerHTML = `<div class="empty-state"><p class="empty-title">No items match these filters</p><p class="empty-sub">Try clearing a filter or search term.</p></div>`;
    return;
  }

  for (const weekNum of weekNumbers) {
    const topic = weekTopics.find((t) => t.plannedWeek === weekNum);
    const items = filtered.filter((c) => c.weekNumber === weekNum);
    el.appendChild(renderWeekBlock(weekNum, topic, items));
  }
}

function renderWeekBlock(weekNum, topic, items) {
  const block = document.createElement('div');
  const weekStatus = getWeekStatus(topic);
  block.className = `week-block ${weekStatus ? `week-${weekStatus}` : ''}`;

  const dateLabel = topic?.plannedWeekStart ? formatWeekDate(topic.plannedWeekStart) : '';
  const tieIn = topic?.calendarTieIn && topic.calendarTieIn !== 'None' ? topic.calendarTieIn : null;
  const blockedCount = items.filter((i) => !i.driveFileId).length;

  const videos = items.filter((i) => i._type === 'video').sort((a, b) => (a.longFormSlot || '').localeCompare(b.longFormSlot || ''));
  const shorts = items.filter((i) => i._type === 'shortClip');

  block.innerHTML = `
    <div class="week-header">
      <span class="week-num">Week ${weekNum}</span>
      ${weekStatus === 'current' ? '<span class="now-badge now-current">This week</span>' : ''}
      ${weekStatus === 'next' ? '<span class="now-badge now-next">Next week</span>' : ''}
      <span class="week-title">${escapeHtmlPlan(topic?.title || 'Mixed')}</span>
      ${topic ? `<span class="pillar-badge pillar-${topic.pillar}">${PILLAR_LABELS[topic.pillar] || topic.pillar}</span>` : ''}
      ${dateLabel ? `<span class="week-date">${dateLabel}</span>` : ''}
      ${tieIn ? `<span class="week-tiein">${escapeHtmlPlan(tieIn)}</span>` : ''}
      ${blockedCount > 0 ? `<span class="blocked-badge">${blockedCount} blocked (no file)</span>` : ''}
    </div>
    <div class="week-items"></div>
  `;

  const itemsEl = block.querySelector('.week-items');
  for (const v of videos) itemsEl.appendChild(renderItemRow(v));
  for (const s of shorts) itemsEl.appendChild(renderItemRow(s));

  return block;
}

function renderItemRow(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'item-wrapper';

  const row = document.createElement('div');
  row.className = 'item-row';

  const typeTag = item._type === 'video' ? (item.longFormSlot === 'lf2' ? 'LF2' : 'LF1') : 'Short';
  const label = item._type === 'video' ? item.title : (item.hook || item.title);
  const ctaFlag = item.hasCta ? '<span class="cta-flag">CTA</span>' : '';
  const driveFlag = item.driveFileId ? '' : '<span class="no-drive-flag" title="No file linked yet">O</span>';
  const moneyMoves = item.pillar === 'money_moves' ? '<span class="mm-flag">Money Moves</span>' : '';
  const isSelected = planState.selected.has(item._id);

  row.innerHTML = `
    <input type="checkbox" class="row-check" ${isSelected ? 'checked' : ''} />
    <span class="item-type type-${item._type}">${typeTag}</span>
    <span class="item-label" title="${escapeHtmlPlan(label)}">${escapeHtmlPlan(label)}</span>
    <span class="spacer"></span>
    ${moneyMoves}
    ${ctaFlag}
    ${driveFlag}
    <span class="status-chip status-${item.productionStatus}">${STATUS_LABELS[item.productionStatus] || item.productionStatus}</span>
  `;

  row.querySelector('.row-check').addEventListener('change', (e) => {
    if (e.target.checked) planState.selected.add(item._id);
    else planState.selected.delete(item._id);
    renderBulkBar();
  });

  row.addEventListener('click', (e) => {
    if (e.target.closest('.row-check')) return;
    planState.expandedId = planState.expandedId === item._id ? null : item._id;
    renderPlan();
  });

  wrapper.appendChild(row);

  if (planState.expandedId === item._id) {
    const editSlot = document.createElement('div');
    editSlot.className = 'edit-slot';
    editSlot.appendChild(buildEditPanel(item));
    wrapper.appendChild(editSlot);
  }

  return wrapper;
}

const PLATFORM_OPTIONS = [
  { value: 'youtube', label: 'YouTube', defaultFor: ['video'] },
  { value: 'youtube_shorts', label: 'YT Shorts', defaultFor: ['shortClip'] },
  { value: 'instagram', label: 'Instagram', defaultFor: ['shortClip'] },
  { value: 'tiktok', label: 'TikTok', defaultFor: ['shortClip'] },
  { value: 'facebook', label: 'Facebook', defaultFor: [] },
  { value: 'linkedin', label: 'LinkedIn', defaultFor: [] },
];

function buildEditPanel(item) {
  const panel = document.createElement('div');
  panel.className = 'edit-panel';

  const studioLink = `${STUDIO_URL}/structure/${item._type};${item._id}`;

  panel.innerHTML = `
    <div class="edit-row">
      <label>Status</label>
      <select class="edit-status">
        ${STATUS_ORDER.map((s) => `<option value="${s}" ${item.productionStatus === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
      </select>
    </div>
    <div class="edit-row">
      <label>Drive file ID</label>
      <input type="text" class="edit-drive" value="${escapeHtmlPlan(item.driveFileId || '')}" placeholder="Paste the Drive file ID once exported" />
    </div>
    <div class="edit-row">
      <label>Caption</label>
      <textarea class="edit-caption" rows="3" placeholder="Post caption...">${escapeHtmlPlan(item.caption || '')}</textarea>
    </div>
    <div class="edit-row">
      <label>Hashtags</label>
      <input type="text" class="edit-hashtags" value="${escapeHtmlPlan((item.hashtags || []).join(', '))}" placeholder="comma, separated, tags" />
    </div>
    ${item._type === 'video' ? `
    <div class="edit-row">
      <label>YouTube URL</label>
      <input type="text" class="edit-youtube" value="${escapeHtmlPlan(item.youtubeUrl || '')}" placeholder="https://youtube.com/watch?v=..." />
    </div>` : ''}
    <div class="edit-row">
      <label>CTA</label>
      <select class="edit-cta">
        <option value="">No CTA</option>
        ${planState.ctas.map((c) => `<option value="${c._id}" ${item.cta?._id === c._id ? 'selected' : ''}>${escapeHtmlPlan(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="edit-row">
      <label>Queue for posting</label>
      <div class="platform-queue">
        ${PLATFORM_OPTIONS.map((p) => {
          const existing = (item.platformPosts || []).find((pp) => pp.platform === p.value);
          if (existing) {
            const label = existing.status === 'posted' ? 'Posted'
              : existing.status === 'failed' ? 'Failed'
              : existing.approvalStatus === 'approved' ? 'Approved'
              : existing.approvalStatus === 'rejected' ? 'Rejected'
              : 'Pending review';
            const pillClass = existing.status === 'posted' ? 'posted' : existing.status === 'failed' ? 'failed' : existing.approvalStatus;
            return `<span class="platform-queue-existing">${p.label}: <span class="pill ${pillClass}">${label}</span></span>`;
          }
          const checked = p.defaultFor.includes(item._type) ? 'checked' : '';
          return `<label class="platform-check"><input type="checkbox" class="queue-platform-check" value="${p.value}" ${checked} /> ${p.label}</label>`;
        }).join('')}
      </div>
      <button class="btn btn-approve queue-platforms-btn">Queue selected platforms</button>
    </div>
    <div class="edit-actions">
      <button class="btn btn-approve edit-save">Save changes</button>
      <button class="btn btn-reset edit-claude">Draft script in Claude</button>
      <a href="${studioLink}" target="_blank" rel="noopener" class="btn btn-reset">Open in Sanity Studio</a>
    </div>
  `;

  const queueBtn = panel.querySelector('.queue-platforms-btn');
  if (queueBtn) {
    queueBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const checked = [...panel.querySelectorAll('.queue-platform-check:checked')].map((c) => c.value);
      if (checked.length === 0) return showPlanBanner('Tick at least one platform first.', 'is-error');

      queueBtn.disabled = true;
      queueBtn.textContent = 'Queuing...';
      try {
        const res = await fetch('/api/queue-platforms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: item._id, platforms: checked }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
        showPlanBanner(
          data.added > 0
            ? `Queued ${data.added} platform(s). Approve them in Posting Review.`
            : (data.message || 'Nothing new to queue.'),
          'is-success'
        );
        await loadPlan();
      } catch (err) {
        showPlanBanner(`Couldn't queue platforms: ${err.message}`, 'is-error');
        queueBtn.disabled = false;
        queueBtn.textContent = 'Queue selected platforms';
      }
    });
  }

  panel.querySelector('.edit-claude').addEventListener('click', (e) => {
    e.stopPropagation();
    openClaudePromptModal(buildClaudePrompt(item));
  });

  panel.querySelector('.edit-save').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const hashtagsRaw = panel.querySelector('.edit-hashtags').value;
    const patch = {
      productionStatus: panel.querySelector('.edit-status').value,
      driveFileId: panel.querySelector('.edit-drive').value.trim(),
      caption: panel.querySelector('.edit-caption').value,
      hashtags: hashtagsRaw ? hashtagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    const ytInput = panel.querySelector('.edit-youtube');
    if (ytInput) patch.youtubeUrl = ytInput.value.trim();

    const ctaVal = panel.querySelector('.edit-cta').value;
    patch.cta = ctaVal ? { _type: 'reference', _ref: ctaVal } : null;

    try {
      const res = await fetch('/api/update-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: item._id, patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
      showPlanBanner('Saved.', 'is-success');
      planState.expandedId = null;
      await loadPlan();
    } catch (err) {
      showPlanBanner(`Couldn't save: ${err.message}`, 'is-error');
      btn.disabled = false;
      btn.textContent = 'Save changes';
    }
  });

  panel.addEventListener('click', (e) => e.stopPropagation());

  return panel;
}

function buildClaudePrompt(item) {
  const isVideo = item._type === 'video';
  const formatLine = isVideo
    ? 'This is a long-form YouTube video (roughly 8-15 minutes).'
    : 'This is a short-form video for TikTok/Instagram Reels/YouTube Shorts (30-60 seconds).';

  const titleLine = isVideo ? `Title: ${item.title}` : `Hook (first 3 seconds): ${item.hook || item.title}`;
  const topicLine = item.topicTitle ? `Topic: ${item.topicTitle}` : '';
  const pillarLine = item.pillar ? `Content pillar: ${PILLAR_LABELS[item.pillar] || item.pillar}` : '';
  const ctaLine = item.cta?.name ? `Include a call to action for: ${item.cta.name}` : 'No CTA needed for this one - keep it purely educational.';
  const notesLine = item.notes ? `Notes / angle from the content plan: ${item.notes}` : '';

  return [
    `I'm writing a script/transcript for a UK personal finance education video for nextsteps.finance.`,
    formatLine,
    titleLine,
    topicLine,
    pillarLine,
    `Audience: UK adults in their 20s-40s who want plain-English, practical personal finance guidance - no jargon, no assumed background knowledge.`,
    `Tone: warm, direct, and credible - like a knowledgeable friend, not a lecture. Avoid hype and avoid anything that could read as regulated financial advice; frame things as general education.`,
    ctaLine,
    notesLine,
    ``,
    `Please write:`,
    `1. A full spoken script/transcript for this video, written to be read aloud naturally.`,
    `2. A suggested on-screen hook/opening line if different from the title.`,
    `3. A short post caption (2-3 sentences) suitable for the video's description.`,
    `4. 5-8 relevant hashtags.`,
  ].filter(Boolean).join('\n');
}

function openClaudePromptModal(promptText) {
  // Remove any existing modal first.
  document.getElementById('claude-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'claude-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-box">
      <p class="modal-title">Script prompt for Claude</p>
      <p class="modal-sub">Copy this, then open Claude and paste it in. Claude no longer supports auto-filling a chat via link, so this manual step is unavoidable.</p>
      <textarea id="claude-prompt-text" class="modal-textarea" readonly></textarea>
      <div class="modal-actions">
        <button id="modal-copy" class="btn btn-approve">Copy prompt</button>
        <a id="modal-open" href="https://claude.ai/new" target="_blank" rel="noopener" class="btn btn-reset">Open Claude.ai</a>
        <button id="modal-close" class="btn btn-reset">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const textarea = document.getElementById('claude-prompt-text');
  textarea.value = promptText;

  // Auto-select the text so a manual Ctrl/Cmd+C also works even if the
  // Copy button's clipboard call is blocked by the browser.
  textarea.focus();
  textarea.select();

  document.getElementById('modal-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      showPlanBanner('Copied to clipboard.', 'is-success');
    } catch {
      textarea.focus();
      textarea.select();
      showPlanBanner('Auto-copy was blocked — the text is selected, press Ctrl/Cmd+C.', 'is-error');
    }
  });

  document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderBulkBar() {
  let bar = document.getElementById('bulk-bar');
  const count = planState.selected.size;

  if (count === 0) {
    if (bar) bar.remove();
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulk-bar';
    bar.className = 'bulk-bar';
    document.body.appendChild(bar);
  }

  bar.innerHTML = `
    <span class="bulk-count">${count} selected</span>
    <select id="bulk-status" class="filter-select">
      <option value="">Set status...</option>
      ${STATUS_ORDER.map((s) => `<option value="${s}">${STATUS_LABELS[s]}</option>`).join('')}
    </select>
    <button id="bulk-apply-status" class="btn btn-approve">Apply status</button>
    <select id="bulk-cta" class="filter-select">
      <option value="">Assign CTA...</option>
      <option value="__none__">No CTA</option>
      ${planState.ctas.map((c) => `<option value="${c._id}">${escapeHtmlPlan(c.name)}</option>`).join('')}
    </select>
    <button id="bulk-apply-cta" class="btn btn-approve">Apply CTA</button>
    <button id="bulk-clear" class="btn btn-reset">Clear selection</button>
  `;

  document.getElementById('bulk-apply-status').addEventListener('click', async () => {
    const status = document.getElementById('bulk-status').value;
    if (!status) return showPlanBanner('Pick a status first.', 'is-error');
    await applyBulkPatch({ productionStatus: status });
  });

  document.getElementById('bulk-apply-cta').addEventListener('click', async () => {
    const ctaVal = document.getElementById('bulk-cta').value;
    if (!ctaVal) return showPlanBanner('Pick a CTA first.', 'is-error');
    const cta = ctaVal === '__none__' ? null : { _type: 'reference', _ref: ctaVal };
    await applyBulkPatch({ cta });
  });

  document.getElementById('bulk-clear').addEventListener('click', () => {
    planState.selected.clear();
    renderPlan();
  });
}

async function applyBulkPatch(patch) {
  const docIds = [...planState.selected];
  try {
    const res = await fetch('/api/bulk-update-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds, patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
    showPlanBanner(`Updated ${docIds.length} item(s).`, 'is-success');
    planState.selected.clear();
    await loadPlan();
  } catch (err) {
    showPlanBanner(`Bulk update failed: ${err.message}`, 'is-error');
  }
}

function renderPlanTimeline() {
  const el = document.getElementById('plan-timeline');
  el.innerHTML = '';

  const filtered = getFilteredContent();
  const weekTopics = planState.topics.filter((t) => t.plannedWeek);
  const weekNumbers = [...new Set(filtered.map((c) => c.weekNumber))].sort((a, b) => a - b);

  let currentMonth = null;
  let monthGroup = null;

  for (const weekNum of weekNumbers) {
    const topic = weekTopics.find((t) => t.plannedWeek === weekNum);
    const items = filtered.filter((c) => c.weekNumber === weekNum);
    const monthLabel = topic?.plannedWeekStart ? formatMonth(topic.plannedWeekStart) : 'Unscheduled';
    const weekStatus = getWeekStatus(topic);

    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;
      monthGroup = document.createElement('div');
      monthGroup.className = 'timeline-month';
      monthGroup.innerHTML = `<div class="timeline-month-label">${monthLabel}</div>`;
      el.appendChild(monthGroup);
    }

    const weekRow = document.createElement('div');
    weekRow.className = `timeline-week ${weekStatus ? `week-${weekStatus}` : ''}`;

    const doneCount = items.filter((i) => i.productionStatus === 'published').length;
    const readyCount = items.filter((i) => i.productionStatus === 'ready').length;

    weekRow.innerHTML = `
      <div class="timeline-week-label">
        <span class="week-num">Wk ${weekNum} ${weekStatus === 'current' ? '<span class="now-badge now-current">Now</span>' : ''}${weekStatus === 'next' ? '<span class="now-badge now-next">Next</span>' : ''}</span>
        <span class="timeline-topic">${escapeHtmlPlan(topic?.title || 'Mixed')}</span>
      </div>
      <div class="timeline-chips"></div>
      <div class="timeline-progress">${doneCount}/${items.length} published${readyCount ? `, ${readyCount} ready` : ''}</div>
    `;

    const chipsEl = weekRow.querySelector('.timeline-chips');
    for (const item of items) {
      const chip = document.createElement('span');
      chip.className = `chip status-${item.productionStatus}`;
      chip.title = item._type === 'video' ? item.title : (item.hook || item.title);
      chip.textContent = item._type === 'video' ? (item.longFormSlot === 'lf2' ? 'LF2' : 'LF1') : 'S';
      chipsEl.appendChild(chip);
    }

    monthGroup.appendChild(weekRow);
  }

  if (weekNumbers.length === 0) {
    el.innerHTML = `<div class="empty-state"><p class="empty-title">No items match these filters</p><p class="empty-sub">Try clearing a filter or search term.</p></div>`;
  }
}

function formatWeekDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonth(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function escapeHtmlPlan(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

loadPlan();
