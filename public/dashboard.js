const state = {
  items: [],
  filter: 'pending',
};

// Daily posting slots and the minimum gap enforced between any two posts on
// the same platform, so approving several items in a row doesn't clump them
// all into one moment. The scheduled function itself now also runs hourly
// (see netlify.toml) rather than once a day, so posts actually go out close
// to whichever slot they're assigned rather than in one big daily batch.
const POSTING_SLOTS = ['09:00', '13:00', '17:00'];
const MIN_GAP_MINUTES = 90;

const cardList = document.getElementById('card-list');
const emptyState = document.getElementById('empty-state');
const banner = document.getElementById('status-banner');
const tabs = document.querySelectorAll('.tab');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    state.filter = tab.dataset.filter;
    render();
  });
});

async function loadContent() {
  try {
    const res = await fetch('/api/list-content');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    state.items = await res.json();
    render();
  } catch (err) {
    showBanner(`Couldn't load content: ${err.message}`, 'is-error');
  }
}

function showBanner(message, kind) {
  banner.textContent = message;
  banner.hidden = false;
  banner.className = `status-banner ${kind}`;
  if (kind === 'is-success') {
    setTimeout(() => { banner.hidden = true; }, 2500);
  }
}

// Flattens docs into { doc, post } rows filtered by the active tab's approvalStatus/status,
// so each platform on each doc is reviewed independently.
function getVisibleRows() {
  const rows = [];
  for (const doc of state.items) {
    for (const post of doc.platformPosts) {
      const matches =
        state.filter === 'pending' ? post.approvalStatus === 'pending' :
        state.filter === 'approved' ? post.approvalStatus === 'approved' && post.status !== 'posted' :
        state.filter === 'posted' ? post.status === 'posted' :
        state.filter === 'rejected' ? post.approvalStatus === 'rejected' :
        false;
      if (matches) rows.push({ doc, post });
    }
  }
  return rows;
}

function render() {
  const rows = getVisibleRows();

  // Group rows back by document so a video with 2 due platforms shows as one card.
  const byDoc = new Map();
  for (const { doc, post } of rows) {
    if (!byDoc.has(doc._id)) byDoc.set(doc._id, { doc, posts: [] });
    byDoc.get(doc._id).posts.push(post);
  }

  const groups = Array.from(byDoc.values());

  emptyState.hidden = groups.length > 0;
  cardList.innerHTML = '';

  for (const { doc, posts } of groups) {
    cardList.appendChild(renderCard(doc, posts));
  }
}

function renderCard(doc, posts) {
  const card = document.createElement('div');
  card.className = 'card';

  const typeLabel = doc._type === 'video' ? 'Long-form' : 'Short';
  const metaBits = [doc.topicTitle, doc.weekNumber ? `Week ${doc.weekNumber}` : null].filter(Boolean);

  card.innerHTML = `
    <div class="card-head">
      <div>
        <p class="card-title">${escapeHtml(doc.title || 'Untitled')}</p>
        <div class="card-meta">
          <span class="type-badge">${typeLabel}</span>
          ${metaBits.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}
        </div>
      </div>
    </div>
    <div class="card-caption ${doc.caption ? '' : 'is-empty'}">
      ${doc.caption ? escapeHtml(doc.caption) : 'No caption written yet.'}
    </div>
    ${doc.driveFileId ? '' : '<p class="drive-warning">No Drive file linked yet — this can\'t actually post until driveFileId is set in Sanity.</p>'}
    <div class="platform-rows"></div>
  `;

  const rowsEl = card.querySelector('.platform-rows');
  for (const post of posts) {
    rowsEl.appendChild(renderPlatformRow(doc, post));
  }

  return card;
}

function renderPlatformRow(doc, post) {
  const row = document.createElement('div');
  row.className = 'platform-row';

  const pillClass = post.status === 'posted' ? 'posted'
    : post.status === 'failed' ? 'failed'
    : post.approvalStatus;

  const pillLabel = post.status === 'posted' ? 'Posted'
    : post.status === 'failed' ? 'Failed'
    : post.approvalStatus === 'approved' ? 'Approved'
    : post.approvalStatus === 'rejected' ? 'Rejected'
    : 'Pending';

  row.innerHTML = `
    <span class="platform-name">${platformLabel(post.platform)}</span>
    <span class="pill ${pillClass}">${pillLabel}</span>
    <span class="spacer"></span>
  `;

  if (state.filter === 'pending') {
    const dtInput = document.createElement('input');
    dtInput.type = 'datetime-local';
    dtInput.className = 'datetime-input';
    dtInput.value = toDatetimeLocalValue(suggestNextSlot(post.platform, doc._id, post._key));
    row.appendChild(dtInput);

    const collisionNote = document.createElement('span');
    collisionNote.className = 'collision-note';
    collisionNote.hidden = true;
    updateCollisionNote(collisionNote, dtInput.value, post.platform, doc._id, post._key);
    dtInput.addEventListener('change', () => {
      updateCollisionNote(collisionNote, dtInput.value, post.platform, doc._id, post._key);
    });

    const approveBtn = makeButton('Approve', 'btn-approve', async () => {
      await updatePost(doc._id, post._key, 'approve', new Date(dtInput.value).toISOString());
    });
    const rejectBtn = makeButton('Reject', 'btn-reject', async () => {
      await updatePost(doc._id, post._key, 'reject');
    });
    row.appendChild(approveBtn);
    row.appendChild(rejectBtn);
    row.appendChild(collisionNote);
  }

  if (state.filter === 'approved') {
    const resetBtn = makeButton('Undo', 'btn-reset', async () => {
      await updatePost(doc._id, post._key, 'reset');
    });
    row.appendChild(resetBtn);
  }

  if (state.filter === 'posted' && post.postUrl) {
    const link = document.createElement('a');
    link.href = post.postUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'post-link';
    link.textContent = 'View live post →';
    row.appendChild(link);
  }

  if (post.status === 'failed' && post.errorMessage) {
    const errNote = document.createElement('span');
    errNote.className = 'error-note';
    errNote.textContent = post.errorMessage;
    row.appendChild(errNote);
  }

  if (state.filter === 'rejected') {
    const resetBtn = makeButton('Move back to pending', 'btn-reset', async () => {
      await updatePost(doc._id, post._key, 'reset');
    });
    row.appendChild(resetBtn);
  }

  return row;
}

function makeButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn ${className}`;
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await onClick();
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

async function updatePost(docId, platformPostKey, action, scheduledAt) {
  try {
    const res = await fetch('/api/update-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, platformPostKey, action, scheduledAt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);

    showBanner(
      action === 'approve' ? 'Approved and scheduled.' :
      action === 'reject' ? 'Rejected.' :
      'Moved back to pending.',
      'is-success'
    );

    await loadContent();
  } catch (err) {
    showBanner(`Couldn't update that post: ${err.message}`, 'is-error');
  }
}

function platformLabel(platform) {
  const labels = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    youtube_shorts: 'YT Shorts',
  };
  return labels[platform] || platform;
}

// Defaults the schedule picker to tomorrow at 9am local time — a sensible
// starting point you can adjust before hitting Approve.
function defaultScheduleValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Collects every currently-approved-and-scheduled (not yet posted) time for
// a given platform, across all documents, so slot suggestions and collision
// checks are based on the real current queue rather than just this one item.
function getScheduledDatesForPlatform(platform, excludeDocId, excludeKey) {
  const dates = [];
  for (const doc of state.items) {
    for (const post of doc.platformPosts) {
      if (post.platform !== platform || post.status !== 'scheduled' || !post.scheduledAt) continue;
      if (doc._id === excludeDocId && post._key === excludeKey) continue;
      dates.push(new Date(post.scheduledAt));
    }
  }
  return dates;
}

// Walks forward day by day, trying each daily slot in order, and returns the
// first one that isn't within MIN_GAP_MINUTES of an existing scheduled post
// on the same platform. This is what spaces out approvals automatically
// instead of defaulting everything to the same time.
function suggestNextSlot(platform, excludeDocId, excludeKey) {
  const existing = getScheduledDatesForPlatform(platform, excludeDocId, excludeKey);

  const day = new Date();
  day.setDate(day.getDate() + 1);
  day.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
    for (const slot of POSTING_SLOTS) {
      const [h, m] = slot.split(':').map(Number);
      const candidate = new Date(day);
      candidate.setHours(h, m, 0, 0);

      const tooClose = existing.some((d) => Math.abs(d - candidate) < MIN_GAP_MINUTES * 60 * 1000);
      if (!tooClose) return candidate;
    }
    day.setDate(day.getDate() + 1);
  }

  // Fallback if 60 days are somehow all full - shouldn't happen in practice.
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function updateCollisionNote(el, datetimeLocalValue, platform, excludeDocId, excludeKey) {
  if (!datetimeLocalValue) { el.hidden = true; return; }

  const candidate = new Date(datetimeLocalValue);
  const existing = getScheduledDatesForPlatform(platform, excludeDocId, excludeKey);
  const collision = existing.find((d) => Math.abs(d - candidate) < MIN_GAP_MINUTES * 60 * 1000);

  if (collision) {
    el.hidden = false;
    el.textContent = `⚠ Within ${MIN_GAP_MINUTES} min of another ${platformLabel(platform)} post at ${collision.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
  } else {
    el.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Loaded lazily by plan.js's section-tab handler when "Posting Review" is
// first opened, rather than on every page load, since Content Plan is now
// the default landing view.
