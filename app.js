/* app.js - Docker/MongoDB UAS system
   Put this file together with index.html, project-details.html and styles.css
*/

const STORAGE_KEY = 'droneProjects_v1';
let projectsCache = [];

// UID
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// API / Cache
async function refreshCache() {
  try {
    const res = await fetch('/api/projects');
    projectsCache = await res.json();
  } catch (e) { console.error('API Error', e); }
}

function loadProjects() { return projectsCache; }

async function saveProjectAPI(project) {
  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  });
  await refreshCache();
}

async function deleteProjectAPI(id) {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  await refreshCache();
}

// Legacy saveProjects (for Import only, or if we want to bulk save)
async function saveProjects(arr) {
  for (const p of arr) {
    await saveProjectAPI(p);
  }
}

/* ---------- Helpers: date/time formatting ---------- */
/* Display date in MM/DD/YYYY */
function formatDateMMDD(dateStr) {
  if (!dateStr) return '';
  // input might be YYYY-MM-DD or full ISO
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/* Display datetime as MM/DD/YYYY hh:mm AM/PM */
function formatDateTime12(dateTimeStr) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  if (isNaN(d)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12; hours = hours ? hours : 12;
  const hStr = String(hours).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hStr}:${minutes} ${ampm}`;
}

/* Calculate minutes between two datetime-local strings */
function minutesBetween(t1, t2) {
  if (!t1 || !t2) return 0;
  const a = new Date(t1);
  const b = new Date(t2);
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}

/* Convert minutes to H:MM */
function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/* Inclusive days between two dates (if end missing, use today) */
function daysInclusive(startDateStr, endDateStr) {
  if (!startDateStr) return 0;
  const s = new Date(startDateStr);
  const e = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  const diff = Math.round((e - s) / 86400000) + 1;
  return diff;
}

/* Escape HTML */
function escapeHtml(s) { if (!s && s !== 0) return ''; return String(s).replace(/[&<>"'`]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[ch])); }

/* Page detection */
document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname || '';
  if (path.endsWith('project-details.html')) await initProjectDetails();
  else await initIndex();
});

/* ===================== INDEX (main) ===================== */
async function initIndex() {
  await refreshCache();
  const tbody = document.querySelector('#projects_table tbody');
  const btnSave = document.getElementById('btnSaveProject');
  const btnClear = document.getElementById('btnClearProject');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');

  const fields = {
    id: document.getElementById('proj_id'),
    name: document.getElementById('proj_name'),
    client: document.getElementById('proj_client'),
    location: document.getElementById('proj_location'),
    start: document.getElementById('proj_start'),
    end: document.getElementById('proj_end'),
    desc: document.getElementById('proj_desc')
  };

  function render() {
    const all = loadProjects();
    tbody.innerHTML = '';
    let totalMins = 0, totalMandays = 0, totalCrew = 0;
    all.forEach(project => {
      // totals per project
      let pMins = 0;
      (project.flights || []).forEach(f => pMins += Number(f.durationMins || 0));
      let pMandays = 0;
      (project.crew || []).forEach(c => pMandays += Number(c.mandays || daysInclusive(c.dateIn, c.dateOut || c.dateIn)));
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><a href="project-details.html?projectId=${project.id}">${escapeHtml(project.name)}</a></td>
        <td>${escapeHtml(project.client || '')}</td>
        <td>${escapeHtml(project.location || '')}</td>
        <td>${project.startDate ? formatDateMMDD(project.startDate) : ''}</td>
        <td>${project.endDate ? formatDateMMDD(project.endDate) : ''}</td>
        <td>${minutesToHHMM(pMins)}</td>
        <td>${pMandays}</td>
        <td>${(project.crew || []).length}</td>
        <td style="text-align:right">
          <div class="actions">
            <button class="edit-btn small" data-id="${project.id}">Edit</button>
            <button class="delete-btn small" data-id="${project.id}">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
      totalMins += pMins;
      totalMandays += pMandays;
      totalCrew += (project.crew || []).length;
    });

    // attach edit/delete events AFTER rows inserted
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const all = loadProjects();
        const p = all.find(x => x.id === id);
        if (!p) return alert('Project not found');
        fields.id.value = p.id;
        fields.name.value = p.name;
        fields.client.value = p.client || '';
        fields.location.value = p.location || '';
        fields.start.value = p.startDate || '';
        fields.end.value = p.endDate || '';
        fields.desc.value = p.description || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Delete this project and its data?')) return;
        await deleteProjectAPI(id);
        render();
      });
    });

    // summary
    document.getElementById('summary_projects').innerText = loadProjects().length;
    document.getElementById('summary_flight').innerText = minutesToHHMM(totalMins);
    document.getElementById('summary_mandays').innerText = totalMandays;
    document.getElementById('summary_crew').innerText = totalCrew;
  }

  // Save project
  btnSave.addEventListener('click', async () => {
    const all = loadProjects();
    const id = fields.id.value || uid();
    const payload = {
      id,
      name: fields.name.value.trim(),
      client: fields.client.value.trim(),
      location: fields.location.value.trim(),
      startDate: fields.start.value || '',
      endDate: fields.end.value || '',
      description: fields.desc.value || '',
      flights: all.find(p => p.id === id)?.flights || [],
      crew: all.find(p => p.id === id)?.crew || []
    };
    if (!payload.name) return alert('Project name required');

    await saveProjectAPI(payload);

    // clear form
    fields.id.value = '';
    fields.name.value = fields.client.value = fields.location.value = fields.start.value = fields.end.value = fields.desc.value = '';
    render();
  });

  btnClear.addEventListener('click', () => {
    fields.id.value = '';
    fields.name.value = fields.client.value = fields.location.value = fields.start.value = fields.end.value = fields.desc.value = '';
  });

  // Export
  btnExport.addEventListener('click', () => {
    const data = JSON.stringify(loadProjects(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'droneProjects.json'; a.click();
    URL.revokeObjectURL(url);
  });

  // Import (paste)
  btnImport.addEventListener('click', async () => {
    const txt = prompt('Paste exported JSON to import (this will overwrite local data):');
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) return alert('Invalid format - expecting an array');
      // ensure ids
      const normalized = parsed.map(p => {
        p.id = p.id || uid();
        p.flights = p.flights || [];
        p.crew = p.crew || [];
        return p;
      });
      await saveProjects(normalized);
      alert('Import successful');
      render();
    } catch (e) { alert('Import failed: ' + e.message); }
  });

  // initial render
  render();
}

/* ===================== PROJECT DETAILS ===================== */
async function initProjectDetails() {
  await refreshCache();
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('projectId');
  if (!projectId) { alert('Project ID missing'); window.location.href = 'index.html'; return; }

  // Sort state for flights (true = newest first, false = oldest first)
  let sortNewestFirst = true;

  // DOM elements
  const pd_name = document.getElementById('pd_name');
  const pd_desc = document.getElementById('pd_desc');
  const pd_start = document.getElementById('pd_start');
  const pd_end = document.getElementById('pd_end');
  const pd_client = document.getElementById('pd_client');
  const pd_location = document.getElementById('pd_location');
  const pd_total_flight = document.getElementById('pd_total_flight');
  const pd_total_mandays = document.getElementById('pd_total_mandays');

  // flight form
  const f_flightId = document.getElementById('f_flightId');
  const f_pilot = document.getElementById('f_pilot');
  const f_drone = document.getElementById('f_drone');
  const f_serial = document.getElementById('f_serial');
  const f_battery = document.getElementById('f_battery');
  const f_takeoff = document.getElementById('f_takeoff');
  const f_landing = document.getElementById('f_landing');
  const f_duration = document.getElementById('f_duration');
  const f_remarks = document.getElementById('f_remarks');
  const f_id = document.getElementById('f_id');
  const btnSaveFlight = document.getElementById('btnSaveFlight');
  const btnClearFlight = document.getElementById('btnClearFlight');
  const btnSortFlights = document.getElementById('btnSortFlights');
  const btnExportFlights = document.getElementById('btnExportFlights');
  const flight_tbody = document.querySelector('#flight_table tbody');

  // crew form
  const c_name = document.getElementById('c_name');
  const c_role = document.getElementById('c_role');
  const c_datein = document.getElementById('c_datein');
  const c_dateout = document.getElementById('c_dateout');
  const btnAddCrew = document.getElementById('btnAddCrew');
  const crew_tbody = document.querySelector('#crew_table tbody');

  // datalists
  const pilotList = document.getElementById('pilotList');
  const droneList = document.getElementById('droneList');
  const serialList = document.getElementById('serialList');

  function getProject() {
    const all = loadProjects();
    return all.find(p => p.id === projectId);
  }
  async function saveProject(project) {
    await saveProjectAPI(project);
  }

  function renderSummary() {
    const p = getProject();
    if (!p) { alert('Project not found'); window.location.href = 'index.html'; return; }
    pd_name.innerText = p.name;
    pd_desc.innerText = p.description || '';
    pd_start.innerText = p.startDate ? formatDateMMDD(p.startDate) : '';
    pd_end.innerText = p.endDate ? formatDateMMDD(p.endDate) : '';
    pd_client.innerText = p.client || '';
    pd_location.innerText = p.location || '';

    // totals
    let mins = 0;
    (p.flights || []).forEach(f => mins += Number(f.durationMins || 0));
    pd_total_flight.innerText = minutesToHHMM(mins);
    let mandays = 0;
    (p.crew || []).forEach(c => mandays += Number(c.mandays || daysInclusive(c.dateIn, c.dateOut || c.dateIn)));
    pd_total_mandays.innerText = mandays;
  }

  function refreshDatalists(project) {
    pilotList.innerHTML = ''; droneList.innerHTML = ''; serialList.innerHTML = '';
    const pilots = new Set(), drones = new Set(), serials = new Set();
    (project.flights || []).forEach(f => { if (f.pilot) pilots.add(f.pilot); if (f.drone) drones.add(f.drone); if (f.serial) serials.add(f.serial); });
    pilots.forEach(p => { const o = document.createElement('option'); o.value = p; pilotList.appendChild(o); });
    drones.forEach(d => { const o = document.createElement('option'); o.value = d; droneList.appendChild(o); });
    serials.forEach(s => { const o = document.createElement('option'); o.value = s; serialList.appendChild(o); });
  }

  // update duration live
  [f_takeoff, f_landing].forEach(el => el.addEventListener('change', () => {
    const mins = minutesBetween(f_takeoff.value, f_landing.value);
    f_duration.value = minutesToHHMM(mins);
  }));

  function renderFlights() {
    const p = getProject();
    flight_tbody.innerHTML = '';

    // Sort flights by takeoff date
    let flights = [...(p.flights || [])];
    flights.sort((a, b) => {
      const dateA = new Date(a.takeoff || 0);
      const dateB = new Date(b.takeoff || 0);
      return sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
    flights.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(f.flightId || '')}</td>
        <td>${escapeHtml(f.pilot || '')}</td>
        <td>${escapeHtml(f.drone || '')}</td>
        <td>${escapeHtml(f.serial || '')}</td>
        <td>${escapeHtml(f.battery || '')}</td>
        <td>${formatDateTime12(f.takeoff || '')}</td>
        <td>${formatDateTime12(f.landing || '')}</td>
        <td>${minutesToHHMM(Number(f.durationMins || 0))}</td>
        <td>${escapeHtml(f.remarks || '')}</td>
        <td style="text-align:right">
          <div class="actions">
            <button class="edit-btn small" data-id="${f.id}">Edit</button>
            <button class="delete-btn small" data-id="${f.id}">Delete</button>
          </div>
        </td>
      `;
      flight_tbody.appendChild(tr);
    });

    // attach edit/delete
    flight_tbody.querySelectorAll('.edit-btn').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const p = getProject();
        const item = (p.flights || []).find(x => x.id === id);
        if (!item) return alert('Not found');
        f_id.value = item.id;
        f_flightId.value = item.flightId || '';
        f_pilot.value = item.pilot || '';
        f_drone.value = item.drone || '';
        f_serial.value = item.serial || '';
        f_battery.value = item.battery || '';
        f_takeoff.value = item.takeoff || '';
        f_landing.value = item.landing || '';
        f_duration.value = minutesToHHMM(Number(item.durationMins || 0));
        f_remarks.value = item.remarks || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    flight_tbody.querySelectorAll('.delete-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (!confirm('Delete this flight?')) return;
        const p = getProject();
        p.flights = (p.flights || []).filter(x => x.id !== id);
        await saveProject(p);
        refreshDatalists(p);
        renderFlights();
        renderSummary();
      });
    });
  }

  // Save flight
  btnSaveFlight.addEventListener('click', async () => {
    const p = getProject();
    if (!p) return;
    if (!f_flightId.value.trim() || !f_pilot.value.trim() || !f_drone.value.trim() || !f_battery.value.trim() || !f_takeoff.value || !f_landing.value) {
      return alert('Required: Flight ID, Pilot, Drone, Battery ID, Takeoff & Landing');
    }
    const idVal = f_id.value || uid();
    const durationMins = minutesBetween(f_takeoff.value, f_landing.value);
    const item = {
      id: idVal,
      flightId: f_flightId.value.trim(),
      pilot: f_pilot.value.trim(),
      drone: f_drone.value.trim(),
      serial: f_serial.value.trim(),
      battery: f_battery.value.trim(),
      takeoff: f_takeoff.value,
      landing: f_landing.value,
      durationMins,
      remarks: f_remarks.value.trim()
    };
    const idx = (p.flights || []).findIndex(x => x.id === idVal);
    if (idx >= 0) p.flights[idx] = item;
    else { p.flights = p.flights || []; p.flights.unshift(item); }
    await saveProject(p);
    refreshDatalists(p);
    renderFlights();
    renderSummary();
    // clear form
    f_id.value = ''; f_flightId.value = f_pilot.value = f_drone.value = f_serial.value = f_battery.value = f_takeoff.value = f_landing.value = f_duration.value = f_remarks.value = '';
  });

  btnClearFlight.addEventListener('click', () => {
    f_id.value = ''; f_flightId.value = f_pilot.value = f_drone.value = f_serial.value = f_battery.value = f_takeoff.value = f_landing.value = f_duration.value = f_remarks.value = '';
  });

  /* Crew operations */
  function renderCrew() {
    const p = getProject();
    crew_tbody.innerHTML = '';
    (p.crew || []).forEach(c => {
      const mandays = Number(c.mandays || daysInclusive(c.dateIn, c.dateOut || c.dateIn));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.role)}</td>
        <td>${c.dateIn || ''}</td>
        <td>${c.dateOut || ''}</td>
        <td>${mandays}</td>
        <td style="text-align:right">
          <div class="actions">
            <button class="delete-btn small" data-id="${c.id}">Delete</button>
          </div>
        </td>
      `;
      crew_tbody.appendChild(tr);
    });
    crew_tbody.querySelectorAll('.delete-btn').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (!confirm('Delete crew member?')) return;
        const p = getProject();
        p.crew = (p.crew || []).filter(x => x.id !== id);
        await saveProject(p);
        renderCrew();
        renderSummary();
      });
    });
  }

  // Sort flights button
  btnSortFlights.addEventListener('click', () => {
    sortNewestFirst = !sortNewestFirst;
    btnSortFlights.textContent = sortNewestFirst ? 'Sort: Newest First ↓' : 'Sort: Oldest First ↑';
    renderFlights();
  });

  // Export flights to CSV
  btnExportFlights.addEventListener('click', () => {
    const p = getProject();
    if (!p || !p.flights || p.flights.length === 0) {
      alert('No flight logs to export');
      return;
    }

    // CSV headers
    const headers = ['Flight ID', 'Pilot', 'Drone', 'Serial', 'Battery ID', 'Takeoff', 'Landing', 'Duration (HH:MM)', 'Remarks'];

    // CSV rows
    const rows = p.flights.map(f => [
      f.flightId || '',
      f.pilot || '',
      f.drone || '',
      f.serial || '',
      f.battery || '',
      formatDateTime12(f.takeoff || ''),
      formatDateTime12(f.landing || ''),
      minutesToHHMM(Number(f.durationMins || 0)),
      f.remarks || ''
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${p.name.replace(/[^a-z0-9]/gi, '_')}_flight_logs.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  btnAddCrew.addEventListener('click', async () => {
    const p = getProject();
    if (!p) return;
    const name = c_name.value.trim();
    const role = c_role.value.trim();
    const dateIn = c_datein.value;
    const dateOut = c_dateout.value || dateIn;
    if (!name || !role || !dateIn) return alert('Fill name, role, date in');
    const mandays = daysInclusive(dateIn, dateOut);
    const item = { id: uid(), name, role, dateIn, dateOut, mandays };
    p.crew = p.crew || [];
    p.crew.push(item);
    await saveProject(p);
    renderCrew();
    renderSummary();
    c_name.value = c_role.value = c_datein.value = c_dateout.value = '';
  });

  // initial
  renderSummary();
  const project = getProject();
  if (!project) { alert('Project not found'); window.location.href = 'index.html'; return; }
  refreshDatalists(project);
  renderFlights();
  renderCrew();
}
