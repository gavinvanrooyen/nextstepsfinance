let ideaTopics = [];
let ideaRowCount = 0;

async function initIdeasForm() {
  try {
    const res = await fetch('/api/list-plan');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    ideaTopics = data.topics;
  } catch (err) {
    showIdeasBanner(`Couldn't load topics: ${err.message}`, 'is-error');
    ideaTopics = [];
  }

  addIdeaRow(); // start with one row
}

document.getElementById('add-idea-row')?.addEventListener('click', () => addIdeaRow());

document.getElementById('submit-ideas')?.addEventListener('click', submitAllIdeas);

function addIdeaRow() {
  ideaRowCount += 1;
  const rowId = `idea-row-${ideaRowCount}`;

  const row = document.createElement('div');
  row.className = 'idea-row';
  row.id = rowId;

  const sortedTopics = [...ideaTopics].sort((a, b) => {
    if (a._id === 'topic-unassigned-ideas') return -1;
    if (b._id === 'topic-unassigned-ideas') return 1;
    return (a.plannedWeek || 999) - (b.plannedWeek || 999);
  });

  row.innerHTML = `
    <div class="idea-row-head">
      <select class="idea-type">
        <option value="video">Long-form (LF)</option>
        <option value="shortClip">Short (SF)</option>
      </select>
      <select class="idea-slot">
        <option value="lf1">LF1</option>
        <option value="lf2">LF2</option>
      </select>
      <button class="idea-remove" title="Remove this idea">&times;</button>
    </div>
    <input type="text" class="idea-title" placeholder="Title (long-form) or hook (short)..." />
    <select class="idea-topic">
      ${sortedTopics.map((t) => `<option value="${t._id}">${t._id === 'topic-unassigned-ideas' ? 'Unassigned Ideas' : `Wk${t.plannedWeek ?? ''} — ${escapeHtmlIdeas(t.title)}`}</option>`).join('')}
    </select>
    <textarea class="idea-notes" rows="2" placeholder="Notes / angle (optional)"></textarea>
  `;

  row.querySelector('.idea-type').addEventListener('change', (e) => {
    row.querySelector('.idea-slot').hidden = e.target.value !== 'video';
  });

  row.querySelector('.idea-remove').addEventListener('click', () => {
    row.remove();
  });

  document.getElementById('idea-rows').appendChild(row);
}

async function submitAllIdeas() {
  const rows = [...document.querySelectorAll('.idea-row')];
  if (rows.length === 0) return showIdeasBanner('Add at least one idea first.', 'is-error');

  const ideas = [];
  for (const row of rows) {
    const title = row.querySelector('.idea-title').value.trim();
    if (!title) continue; // skip empty rows silently rather than blocking submission
    ideas.push({
      type: row.querySelector('.idea-type').value,
      longFormSlot: row.querySelector('.idea-slot').value,
      title,
      topicId: row.querySelector('.idea-topic').value,
      notes: row.querySelector('.idea-notes').value.trim(),
    });
  }

  if (ideas.length === 0) return showIdeasBanner('Fill in at least one title/hook before submitting.', 'is-error');

  const btn = document.getElementById('submit-ideas');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/submit-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);

    showIdeasBanner(`Added ${data.created} idea(s) to the CMS.`, 'is-success');
    document.getElementById('idea-rows').innerHTML = '';
    addIdeaRow();

    // If the Content Plan has already loaded, refresh it so the new ideas show up.
    if (typeof loadPlan === 'function' && planState.topics.length > 0) await loadPlan();
  } catch (err) {
    showIdeasBanner(`Couldn't submit: ${err.message}`, 'is-error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit all ideas';
  }
}

function showIdeasBanner(message, kind) {
  const banner = document.getElementById('status-banner');
  banner.textContent = message;
  banner.hidden = false;
  banner.className = `status-banner ${kind}`;
  if (kind === 'is-success') setTimeout(() => { banner.hidden = true; }, 2500);
}

function escapeHtmlIdeas(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
