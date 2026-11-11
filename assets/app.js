/* Kaisa FortiGate — interactive report controller
 * Vanilla JS, no dependencies, no network calls.
 * Implements: policy explorer, packet simulator, interaction matrix,
 * profile tabs, testing checklist, implementation steps, evidence
 * lightbox and the policy detail drawer.
 */
(function () {
  'use strict';

  var D = window.KAISA;
  if (!D) return;

  var byId = function (id) { return document.getElementById(id); };
  var deptMap = {};
  D.departments.forEach(function (d) { deptMap[d.id] = d; });

  var NET = {
    id: 'NET',
    name: 'Internet / external client',
    short: 'Internet',
    ip: '0.0.0.0/0',
    segment: 'port2',
    subnet: '0.0.0.0/0'
  };

  var TIME_SCHEDULE = {
    'work-am': 'WORK_HOUR_AM',
    'work-pm': 'WORK_HOUR_PM',
    break: 'BREAK',
    after: null
  };

  var TIME_LABEL = {
    'work-am': 'Work hours · AM (08:00–12:00)',
    'work-pm': 'Work hours · PM (13:00–17:00)',
    break: 'Lunch break (12:00–13:00)',
    after: 'After hours / weekend'
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sortedPolicies() {
    return D.policies.slice().sort(function (a, b) { return a.id - b.id; });
  }

  function deptOf(id) {
    if (id === 'NET') return NET;
    if (id === 'SRV') return D.server;
    return deptMap[id];
  }

  function nodeFor(id) {
    var d = deptOf(id);
    return (d && (d.short || d.name)) || id;
  }

  /* ------------------------------------------------------------------ *
   * Policy evaluation model
   * ------------------------------------------------------------------ */

  function evaluate(srcId, dstId, timeKey) {
    var src = deptOf(srcId);
    var dst = deptOf(dstId);
    var trace = [];
    var notes = [];
    var schedule = TIME_SCHEDULE[timeKey];

    if (!src || !dst) {
      return { verdict: 'implicit', trace: trace, notes: ['Unknown endpoint.'], summary: 'Unknown endpoint.' };
    }

    /* Same broadcast domain: the frame is switched, never routed. */
    if (srcId !== dstId && srcId !== 'NET' && dstId !== 'NET' && src.subnet === dst.subnet) {
      notes.push('Both endpoints are in ' + src.subnet + ' on ' + src.segment + ', so the frame is switched at layer 2 and never reaches a firewall policy.');
      return {
        verdict: 'l2',
        trace: [{ state: 'warn', text: 'L2 forwarding on ' + src.segment + ' — no policy lookup performed' }],
        notes: notes,
        summary: 'Same-segment traffic: switched locally, not inspected by the Local-FortiGate.'
      };
    }

    var matched = null;
    var policies = sortedPolicies();

    for (var i = 0; i < policies.length; i += 1) {
      var p = policies[i];
      var srcIn = p.src.indexOf(srcId) !== -1;
      var dstIn = p.dst.indexOf(dstId) !== -1;

      if (!srcIn || !dstIn) continue;

      if (p.srcintf !== src.segment) {
        trace.push({
          state: 'warn',
          text: '#' + p.id + ' ' + p.name + ' — ingress ' + p.srcintf + ' does not match ' + src.segment + ', skipped'
        });
        continue;
      }

      var schedOk = p.schedule === 'always' || (schedule !== null && p.schedule === schedule);
      if (!schedOk) {
        trace.push({
          state: 'no',
          text: '#' + p.id + ' ' + p.name + ' — outside schedule ' + p.schedule
        });
        continue;
      }

      trace.push({
        state: 'ok',
        text: '#' + p.id + ' ' + p.name + ' — matched (' + p.action + ')'
      });
      matched = p;
      break;
    }

    if (!matched) {
      if (dstId === 'NET' && src.segment !== 'port3' && timeKey !== 'after') {
        notes.push('The internet policies take port3 as their incoming interface. ' + src.short + ' is on ' + src.segment + ', so no policy matches in this pod.');
      }
      if (timeKey === 'after' && dstId === 'NET') {
        notes.push('All internet policies are schedule-bound. Outside the configured windows the implicit deny applies.');
      }
      trace.push({ state: 'no', text: 'No matching policy — implicit deny (policy 0)' });
      return {
        verdict: 'implicit',
        trace: trace,
        notes: notes,
        summary: 'Traffic is dropped by the implicit deny. Nothing in the rule set permits this path.'
      };
    }

    var verify = false;
    if (matched.dstintf !== dst.segment) {
      verify = true;
      notes.push('Export check: ' + matched.name + ' stores dstintf ' + matched.dstintf + ', while this destination sits on ' + dst.segment + '. The displayed verdict follows the rule, but the egress path should be verified.');
    }

    var verdict = matched.action === 'deny' ? 'deny' : (verify ? 'verify' : 'allow');

    var summary;
    if (matched.action === 'deny') {
      summary = 'Dropped by ' + matched.name + '. ' + matched.justification;
    } else {
      summary = 'Permitted by ' + matched.name + '. ' + matched.justification;
    }

    if (matched.snat) {
      notes.push('Source NAT uses pool ' + matched.snat + ' (10.200.2.100–10.200.2.120).');
    }
    if (matched.vip) {
      notes.push('Destination NAT uses ' + matched.vip + ': external 10.200.2.1:8080 maps to 10.0.1.20:80.');
    }
    if (matched.profiles && matched.profiles.length) {
      notes.push('Attached profiles: ' + matched.profiles.join(', ') + '.');
    }

    return {
      verdict: verdict,
      policy: matched,
      verify: verify,
      trace: trace,
      notes: notes,
      summary: summary
    };
  }

  function verdictLabel(result) {
    switch (result.verdict) {
      case 'allow': return 'ACCEPT';
      case 'deny': return 'DENY';
      case 'verify': return 'ACCEPT · VERIFY';
      case 'l2': return 'L2 · NOT INSPECTED';
      default: return 'IMPLICIT DENY';
    }
  }

  function verdictClass(result) {
    if (result.verdict === 'verify') return 'verify';
    return result.verdict;
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */

  var root = document.documentElement;
  var themeToggle = byId('themeToggle');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var icon = themeToggle ? themeToggle.querySelector('[data-theme-icon]') : null;
    if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
    try { localStorage.setItem('kaisa-theme', theme); } catch (e) { /* ignore */ }
  }

  var storedTheme = null;
  try { storedTheme = localStorage.getItem('kaisa-theme'); } catch (e) { /* ignore */ }
  applyTheme(storedTheme === 'light' ? 'light' : 'dark');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------------ *
   * Policy explorer
   * ------------------------------------------------------------------ */

  var policyBody = document.querySelector('#policyTable tbody');
  var policyEmpty = byId('policyEmpty');
  var policyCount = byId('policyCount');
  var searchInput = byId('policySearch');
  var actionFilter = byId('actionFilter');
  var categoryFilter = byId('categoryFilter');

  var state = { q: '', action: 'all', category: 'all' };

  var categories = [];
  D.policies.forEach(function (p) {
    if (categories.indexOf(p.category) === -1) categories.push(p.category);
  });

  if (categoryFilter) {
    categories.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  }

  function policyHaystack(p) {
    return [
      p.id, p.name, p.srcLabel, p.dstLabel, p.category, p.justification,
      p.schedule, p.action, (p.profiles || []).join(' '), p.snat || '', p.vip || ''
    ].join(' ').toLowerCase();
  }

  function natCell(p) {
    var out = [];
    if (p.snat) {
      out.push('<span class="mini-tag">SNAT ' + esc(p.snat) + '</span>');
    } else if (p.vip) {
      out.push('<span class="mini-tag">VIP ' + esc(p.vip) + '</span>');
    } else if (p.nat) {
      out.push('<span class="mini-tag">NAT on</span>');
    }
    (p.profiles || []).forEach(function (profile) {
      out.push('<span class="mini-tag">' + esc(profile) + '</span>');
    });
    if (!out.length) out.push('<span class="mini-tag">NAT off</span>');
    return out.join('');
  }

  function renderPolicies() {
    if (!policyBody) return;
    var q = state.q.toLowerCase().trim();
    var rows = sortedPolicies().filter(function (p) {
      if (state.action !== 'all' && p.action !== state.action) return false;
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (q && policyHaystack(p).indexOf(q) === -1) return false;
      return true;
    });

    policyBody.innerHTML = rows.map(function (p) {
      var schedule = D.schedules[p.schedule] || { label: p.schedule };
      var actionBadge = p.action === 'deny'
        ? '<span class="badge deny">Deny</span>'
        : '<span class="badge accept">Accept</span>';
      var verify = p.audit
        ? ' <span class="badge verify" title="Interface mismatch in the export">verify</span>'
        : '';
      return '' +
        '<tr data-id="' + p.id + '">' +
          '<td class="num">' + p.id + '</td>' +
          '<td><span class="policy-name">' + esc(p.name) + '</span><br /><span class="mini-tag">' + esc(p.category) + '</span>' + verify + '</td>' +
          '<td>' + esc(p.srcLabel) + '</td>' +
          '<td class="policy-dest">' + esc(p.dstLabel) + '</td>' +
          '<td>' + esc(schedule.label) + '</td>' +
          '<td>' + actionBadge + '</td>' +
          '<td>' + natCell(p) + '</td>' +
          '<td class="chev"><button type="button" class="row-open" aria-label="Open details for ' + esc(p.name) + '">›</button></td>' +
        '</tr>';
    }).join('');

    if (policyCount) {
      policyCount.textContent = rows.length + (rows.length === 1 ? ' policy' : ' policies');
    }
    if (policyEmpty) policyEmpty.hidden = rows.length !== 0;
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      renderPolicies();
    });
  }

  if (actionFilter) {
    actionFilter.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-action]');
      if (!btn) return;
      state.action = btn.getAttribute('data-action');
      Array.prototype.forEach.call(actionFilter.querySelectorAll('button'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      renderPolicies();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', function () {
      state.category = categoryFilter.value;
      renderPolicies();
    });
  }

  renderPolicies();

  /* ------------------------------------------------------------------ *
   * Detail drawer
   * ------------------------------------------------------------------ */

  var drawer = byId('drawer');
  var scrim = byId('scrim');
  var drawerClose = byId('drawerClose');
  var drawerTitle = byId('drawerTitle');
  var drawerKicker = byId('drawerKicker');
  var drawerBody = byId('drawerBody');
  var lastFocus = null;

  function cliFor(p) {
    var service = p.service === 'ALL' ? 'ALL' : p.service;
    var lines = [
      'config firewall policy',
      '    edit ' + p.id,
      '        set name "' + p.name + '"',
      '        set srcintf "' + p.srcintf + '"',
      '        set dstintf "' + p.dstintf + '"',
      '        set srcaddr "' + p.srcLabel + '"',
      '        set dstaddr "' + p.dstLabel + '"',
      '        set schedule "' + p.schedule + '"',
      '        set service ' + (service === 'ALL' ? '"ALL"' : '"' + service + '"'),
      p.action === 'accept' ? '        set action accept' : '',
      p.nat ? '        set nat enable' : '',
      p.snat ? '        set poolname "' + p.snat + '"' : '',
      '    next',
      'end'
    ];
    return lines.filter(Boolean).join('\n');
  }

  function openDrawer(p) {
    if (!drawer || !p) return;
    lastFocus = document.activeElement;

    drawerKicker.textContent = 'Policy · sequence ' + p.id;
    drawerTitle.textContent = p.name;

    var schedule = D.schedules[p.schedule] || { label: p.schedule };
    var audit = D.audit.filter(function (a) {
      return (a.objects || []).indexOf(p.name) !== -1;
    });

    var html = '' +
      '<div>' +
        '<span class="badge ' + (p.action === 'deny' ? 'deny' : 'accept') + '">' + (p.action === 'deny' ? 'Deny' : 'Accept') + '</span> ' +
        '<span class="mini-tag">' + esc(p.category) + '</span>' +
        (p.audit ? ' <span class="badge verify">verify</span>' : '') +
      '</div>' +
      '<p class="justification">' + esc(p.justification) + '</p>' +
      '<div class="detail-grid">' +
        '<div><span>Source</span><strong>' + esc(p.srcLabel) + '</strong></div>' +
        '<div><span>Destination</span><strong>' + esc(p.dstLabel) + '</strong></div>' +
        '<div><span>Ingress</span><strong>' + esc(p.srcintf) + '</strong></div>' +
        '<div><span>Egress</span><strong>' + esc(p.dstintf) + '</strong></div>' +
        '<div><span>Schedule</span><strong>' + esc(schedule.label) + '</strong></div>' +
        '<div><span>Service</span><strong>' + esc(p.service) + '</strong></div>' +
        '<div><span>NAT</span><strong>' + (p.snat ? 'SNAT · ' + esc(p.snat) : (p.vip ? 'DNAT · ' + esc(p.vip) : (p.nat ? 'Enabled' : 'Disabled'))) + '</strong></div>' +
        '<div><span>Profiles</span><strong>' + (p.profiles && p.profiles.length ? esc(p.profiles.join(', ')) : 'None') + '</strong></div>' +
      '</div>';

    if (audit.length) {
      html += '<h4>Verification notes</h4>';
      audit.forEach(function (a) {
        html += '<div class="audit-card" style="margin-bottom:8px"><span class="level ' + esc(a.level) + '">' + esc(a.level) + '</span>' +
          '<h3>' + esc(a.title) + '</h3><p>' + esc(a.detail) + '</p></div>';
      });
    }

    html += '<h4>Equivalent CLI</h4>' +
      '<div class="code-card"><div class="code-head"><span>FortiOS 7.4</span>' +
      '<button class="copy" type="button">Copy</button></div>' +
      '<pre><code>' + esc(cliFor(p)) + '</code></pre></div>';

    drawerBody.innerHTML = html;
    drawer.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('open'); });
    if (drawerClose) drawerClose.focus();
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('open');
    scrim.hidden = true;
    window.setTimeout(function () { drawer.hidden = true; }, 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (scrim) scrim.addEventListener('click', function () { closeDrawer(); closeLightbox(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeDrawer(); closeLightbox(); }
  });

  if (policyBody) {
    policyBody.addEventListener('click', function (event) {
      var row = event.target.closest('tr[data-id]');
      if (!row) return;
      var id = Number(row.getAttribute('data-id'));
      var policy = D.policies.filter(function (p) { return p.id === id; })[0];
      openDrawer(policy);
    });
  }

  /* ------------------------------------------------------------------ *
   * Simulator
   * ------------------------------------------------------------------ */

  var simForm = byId('simForm');
  var simSource = byId('simSource');
  var simDest = byId('simDest');
  var simTime = byId('simTime');
  var simExample = byId('simExample');
  var simVerdict = byId('simVerdict');
  var simSummary = byId('simSummary');
  var simPath = byId('simPath');
  var simMeta = byId('simMeta');
  var simTrace = byId('simTrace');

  function fillSelect(select, items) {
    if (!select) return;
    select.innerHTML = items.map(function (item) {
      return '<option value="' + esc(item.value) + '">' + esc(item.label) + '</option>';
    }).join('');
  }

  fillSelect(simSource, D.departments.map(function (d) {
    return { value: d.id, label: d.name + ' · ' + d.ip };
  }).concat([{ value: 'NET', label: 'Internet / external client' }]));

  fillSelect(simDest, D.departments.map(function (d) {
    return { value: d.id, label: d.name + ' · ' + d.ip };
  }).concat([
    { value: 'SRV', label: D.server.name + ' · ' + D.server.ip },
    { value: 'NET', label: 'Internet · 0.0.0.0/0' }
  ]));

  if (simSource) simSource.value = 'TI';
  if (simDest) simDest.value = 'CS';
  if (simTime) simTime.value = 'work-am';

  function renderSimulation(srcId, dstId, timeKey) {
    var result = evaluate(srcId, dstId, timeKey);
    var src = deptOf(srcId);
    var dst = deptOf(dstId);

    if (simVerdict) {
      simVerdict.className = 'sim-verdict ' + verdictClass(result);
      simVerdict.textContent = verdictLabel(result);
    }

    if (simSummary) {
      simSummary.innerHTML = '<strong>' + esc(nodeFor(srcId)) + ' → ' + esc(nodeFor(dstId)) + '</strong> · ' + esc(result.summary);
    }

    if (simPath) {
      var chain = [
        '<span class="path-node">' + esc(nodeFor(srcId)) + '<br /><small>' + esc(src ? src.ip : '') + '</small></span>',
        '<span class="path-arrow">→</span>',
        '<span class="path-node firewall">Local-FortiGate<br /><small>' + (result.policy ? 'policy ' + result.policy.id : 'implicit deny') + '</small></span>',
        '<span class="path-arrow">→</span>',
        '<span class="path-node">' + esc(nodeFor(dstId)) + '<br /><small>' + esc(dst ? dst.ip : '') + '</small></span>'
      ];
      simPath.innerHTML = chain.join('');
    }

    if (simMeta) {
      var schedule = TIME_SCHEDULE[timeKey];
      var meta = [
        ['Time window', TIME_LABEL[timeKey] || timeKey],
        ['Matched policy', result.policy ? '#' + result.policy.id + ' · ' + result.policy.name : 'Implicit deny'],
        ['Schedule object', schedule || 'none — outside configured windows'],
        ['Action', result.policy ? result.policy.action.toUpperCase() : 'DENY'],
        ['Source interface', src ? src.segment : '—'],
        ['Destination interface', dst ? dst.segment : '—']
      ];
      simMeta.innerHTML = meta.map(function (pair) {
        return '<div><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1]) + '</strong></div>';
      }).join('');
    }

    if (simTrace) {
      var items = result.trace.slice();
      (result.notes || []).forEach(function (note) {
        items.push({ state: 'warn', text: note });
      });
      simTrace.innerHTML = items.map(function (item) {
        var icon = item.state === 'ok' ? '✓' : (item.state === 'warn' ? '!' : '✕');
        return '<li><span class="t-icon t-' + esc(item.state) + '">' + icon + '</span><span>' + esc(item.text) + '</span></li>';
      }).join('');
    }
  }

  function runSimulator() {
    if (!simSource || !simDest || !simTime) return;
    renderSimulation(simSource.value, simDest.value, simTime.value);
  }

  if (simForm) {
    simForm.addEventListener('submit', function (event) {
      event.preventDefault();
      runSimulator();
    });
  }

  if (simExample) {
    simExample.addEventListener('click', function () {
      if (simSource) simSource.value = 'TI';
      if (simDest) simDest.value = 'CS';
      if (simTime) simTime.value = 'work-am';
      runSimulator();
    });
  }

  if (simSource) simSource.addEventListener('change', runSimulator);
  if (simDest) simDest.addEventListener('change', runSimulator);
  if (simTime) simTime.addEventListener('change', runSimulator);

  runSimulator();

  /* ------------------------------------------------------------------ *
   * Interaction matrix
   * ------------------------------------------------------------------ */

  var matrixTable = byId('matrixTable');

  function matrixCell(srcId, dstId) {
    if (srcId === dstId) {
      return '<button class="implicit" type="button" disabled aria-label="Same endpoint">—</button>';
    }
    var result = evaluate(srcId, dstId, 'work-am');
    var cls = verdictClass(result);
    var label = {
      allow: 'ALLOW',
      deny: 'DENY',
      implicit: 'IMPLICIT',
      l2: 'L2',
      verify: 'VERIFY'
    }[result.verdict] || '—';
    var title = nodeFor(srcId) + ' → ' + nodeFor(dstId) + ': ' + verdictLabel(result) +
      (result.policy ? ' · ' + result.policy.name : '');
    return '<button class="' + cls + '" type="button" data-src="' + esc(srcId) + '" data-dst="' + esc(dstId) + '" title="' + esc(title) + '">' + label + '</button>';
  }

  function renderMatrix() {
    if (!matrixTable) return;
    var rows = D.departments.map(function (d) { return d.id; }).concat(['SRV', 'NET']);
    var head = '<thead><tr><th scope="col">From \\ To</th>' +
      rows.map(function (id) {
        var d = deptOf(id);
        return '<th scope="col" id="col-' + esc(id) + '" title="' + esc(d.name) + '">' + esc(d.short || d.name) + '</th>';
      }).join('') + '</tr></thead>';

    var body = '<tbody>' + rows.map(function (srcId) {
      var src = deptOf(srcId);
      return '<tr><th class="rowhead" scope="row" id="row-' + esc(srcId) + '">' + esc(src.short || src.name) + '</th>' +
        rows.map(function (dstId) {
          return '<td headers="row-' + esc(srcId) + ' col-' + esc(dstId) + '">' + matrixCell(srcId, dstId) + '</td>';
        }).join('') +
        '</tr>';
    }).join('') + '</tbody>';

    matrixTable.innerHTML = head + body;
  }

  if (matrixTable) {
    matrixTable.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-src]');
      if (!btn) return;
      if (simSource) simSource.value = btn.getAttribute('data-src');
      if (simDest) simDest.value = btn.getAttribute('data-dst');
      if (simTime) simTime.value = 'work-am';
      runSimulator();
      var target = byId('simulator');
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  renderMatrix();

  /* ------------------------------------------------------------------ *
   * Security profile tabs
   * ------------------------------------------------------------------ */

  var profilePanels = byId('profilePanels');
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));

  function profileRow(entry) {
    return '<li><span>' + esc(entry.label) + '</span><span class="act ' + esc(entry.action) + '">' + esc(entry.action.replace(/-/g, ' ')) + '</span></li>';
  }

  function renderProfiles() {
    if (!profilePanels) return;

    var web = D.profiles.web.map(function (profile) {
      return '<article class="profile-card">' +
        '<h3>' + esc(profile.name) + '</h3>' +
        '<p class="applies">Applied to ' + esc(profile.applies) + '</p>' +
        '<ul class="profile-list">' + profile.entries.map(profileRow).join('') + '</ul>' +
        '</article>';
    }).join('');

    var app = '<article class="profile-card">' +
      '<h3>AC_KAISA</h3>' +
      '<p class="applies">Applied to ALLOW_INTERNET_WORKHOURS_AM / PM and ALLOW_INTERNET_BREAK</p>' +
      '<ul class="profile-list">' + D.profiles.app.map(profileRow).join('') + '</ul>' +
      '</article>' +
      '<article class="profile-card">' +
      '<h3>Policy binding</h3>' +
      '<p class="applies">Where each profile is referenced</p>' +
      '<ul class="profile-list">' +
        '<li><span>ALLOW_INTERNET_WORKHOURS_AM</span><span class="act allow">WF + AC + shaper</span></li>' +
        '<li><span>ALLOW_INTERNET_WORKHOURS_PM</span><span class="act allow">WF + AC + shaper</span></li>' +
        '<li><span>ALLOW_INTERNET_BREAK</span><span class="act allow">WF break + AC + shaper</span></li>' +
        '<li><span>DENY_* and ALLOW_* internal rules</span><span class="act same-as-work">no UTM</span></li>' +
      '</ul>' +
      '</article>';

    var qos = '<div class="shaper-grid">' + D.profiles.shapers.map(function (shaper) {
      var guaranteed = Number(String(shaper.guaranteed).replace(/[^0-9]/g, ''));
      var maximum = Number(String(shaper.maximum).replace(/[^0-9]/g, ''));
      var pct = maximum ? Math.max(2, Math.round((guaranteed / maximum) * 100)) : 2;
      return '<article class="shaper">' +
        '<h3>' + esc(shaper.name) + '</h3>' +
        '<p class="applies">' + esc(shaper.type) + ' · ' + esc(shaper.applies) + '</p>' +
        '<div class="bars">' +
          '<div class="bar"><i style="width:' + (maximum ? 100 : 2) + '%"></i></div>' +
          '<div class="row"><span>Maximum ' + esc(shaper.maximum) + '</span><span>Priority ' + esc(shaper.priority) + '</span></div>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="row"><span>Guaranteed ' + esc(shaper.guaranteed) + '</span><span>' + (maximum ? 'business share' : '') + '</span></div>' +
        '</div>' +
        '</article>';
    }).join('') + '</div>';

    profilePanels.innerHTML = '' +
      '<div class="tab-panel" data-panel="web">' + web + '</div>' +
      '<div class="tab-panel" data-panel="app" hidden>' + app + '</div>' +
      '<div class="tab-panel" data-panel="qos" hidden>' + qos + '</div>';

    profilePanels.style.display = '';
  }

  function activateTab(name) {
    tabButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab-panel[data-panel]'), function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== name;
    });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.getAttribute('data-tab')); });
  });

  renderProfiles();

  /* ------------------------------------------------------------------ *
   * Testing checklist
   * ------------------------------------------------------------------ */

  var testList = byId('testList');
  var testSummary = byId('testSummary');
  var testProgress = byId('testProgress');
  var testReset = byId('testReset');
  var TEST_KEY = 'kaisa-tests-v1';

  var testState = {};
  try { testState = JSON.parse(localStorage.getItem(TEST_KEY) || '{}') || {}; } catch (e) { testState = {}; }

  function saveTests() {
    try { localStorage.setItem(TEST_KEY, JSON.stringify(testState)); } catch (e) { /* ignore */ }
  }

  function updateTestProgress() {
    var passed = 0;
    var failed = 0;
    D.tests.forEach(function (t) {
      if (testState[t.id] === 'pass') passed += 1;
      if (testState[t.id] === 'fail') failed += 1;
    });
    var done = passed + failed;
    var total = D.tests.length;
    if (testSummary) {
      testSummary.textContent = passed + ' of ' + total + ' passed' + (failed ? ' · ' + failed + ' failed' : '');
    }
    if (testProgress) {
      testProgress.style.width = (total ? Math.round((passed / total) * 100) : 0) + '%';
      testProgress.parentElement.setAttribute('aria-valuemax', String(total));
      testProgress.parentElement.setAttribute('aria-valuenow', String(passed));
    }
    D.tests.forEach(function (t) {
      var row = testList ? testList.querySelector('[data-test="' + t.id + '"]') : null;
      if (!row) return;
      row.classList.toggle('pass', testState[t.id] === 'pass');
      row.classList.toggle('fail', testState[t.id] === 'fail');
    });
    return { done: done, passed: passed, failed: failed, total: total };
  }

  function renderTests() {
    if (!testList) return;
    testList.innerHTML = D.tests.map(function (t) {
      var value = testState[t.id] || '';
      return '<div class="test-row" data-test="' + t.id + '">' +
        '<div class="n">' + String(t.id).padStart(2, '0') + '</div>' +
        '<div><h3>' + esc(t.title) + '</h3><p>' + esc(t.detail) + '</p><code>' + esc(t.action) + '</code></div>' +
        '<div><span class="mini-tag">Expected</span> <span style="color:var(--muted);font-size:11.5px">' + esc(t.expected) + '</span></div>' +
        '<select aria-label="Result for test ' + t.id + '">' +
          '<option value=""' + (value === '' ? ' selected' : '') + '>Not run</option>' +
          '<option value="pass"' + (value === 'pass' ? ' selected' : '') + '>Pass</option>' +
          '<option value="fail"' + (value === 'fail' ? ' selected' : '') + '>Fail</option>' +
        '</select>' +
      '</div>';
    }).join('');

    testList.addEventListener('change', function (event) {
      var select = event.target.closest('select');
      if (!select) return;
      var row = select.closest('[data-test]');
      if (!row) return;
      var id = row.getAttribute('data-test');
      if (select.value) testState[id] = select.value;
      else delete testState[id];
      saveTests();
      updateTestProgress();
    });

    updateTestProgress();
  }

  if (testReset) {
    testReset.addEventListener('click', function () {
      testState = {};
      saveTests();
      if (testList) {
        Array.prototype.forEach.call(testList.querySelectorAll('select'), function (s) { s.value = ''; });
      }
      updateTestProgress();
    });
  }

  renderTests();

  /* ------------------------------------------------------------------ *
   * Implementation steps
   * ------------------------------------------------------------------ */

  var stepsEl = byId('steps');

  function codeCard(code, label) {
    return '<div class="code-card"><div class="code-head"><span>' + esc(label || 'FortiOS 7.4') + '</span>' +
      '<button class="copy" type="button">Copy</button></div>' +
      '<pre><code>' + esc(code) + '</code></pre></div>';
  }

  function renderSteps() {
    if (!stepsEl) return;
    stepsEl.innerHTML = D.steps.map(function (step) {
      return '<article class="step">' +
        '<span class="step-num">' + String(step.n).padStart(2, '0') + '</span>' +
        '<h3>' + esc(step.title) + '</h3>' +
        '<p>' + esc(step.detail) + '</p>' +
        codeCard(step.cli) +
        '</article>';
    }).join('');
  }

  renderSteps();

  /* ------------------------------------------------------------------ *
   * Evidence gallery + lightbox
   * ------------------------------------------------------------------ */

  var evidence = [
    { file: 'policy-deny.png', title: 'Deny policy in the GUI', caption: 'An explicit deny rule with logging disabled, as built in Policy & Objects → Firewall Policy.' },
    { file: 'policy-workhours-am.png', title: 'Work-hours AM internet policy', caption: 'ALLOW_INTERNET_WORKHOURS_AM with the WORK_HOUR_AM schedule, SNAT pool and security profiles.' },
    { file: 'policy-break.png', title: 'Break policy', caption: 'ALLOW_INTERNET_BREAK uses the BREAK schedule and the break web-filter profile so social media is permitted only at lunch.' },
    { file: 'application-control.png', title: 'Application control profile', caption: 'AC_KAISA blocks P2P, anonymisers, remote-access tools and games while allowing collaboration and updates.' },
    { file: 'traffic-shaper.png', title: 'Traffic shapers', caption: 'SHAPER_BUSINESS and SHAPER_NONWORK set guaranteed and maximum bandwidth for business and non-work traffic.' },
    { file: 'safe-search.png', title: 'SafeSearch enforcement', caption: 'SafeSearch is enforced at the web-filter profile for the major search engines.' },
    { file: 'snat-pool.png', title: 'Source NAT pool', caption: 'IPPOOL_KAISA_SNAT provides the overload address range 10.200.2.100–10.200.2.120.' },
    { file: 'topology-reference.png', title: 'Reference topology', caption: 'The Part A pod diagram used to place the Local-FortiGate; Part B configures only this device.' }
  ];

  var evidenceGrid = byId('evidenceGrid');

  function renderEvidence() {
    if (!evidenceGrid) return;
    evidenceGrid.innerHTML = evidence.map(function (item, index) {
      return '<button type="button" data-evidence="' + index + '" aria-label="Open ' + esc(item.title) + '">' +
        '<img src="assets/evidence/' + esc(item.file) + '" alt="' + esc(item.title) + '" loading="lazy" />' +
        '<span>' + esc(item.title) + '</span>' +
      '</button>';
    }).join('');
  }

  renderEvidence();

  var lightbox = byId('lightbox');
  var lightboxImg = byId('lightboxImg');
  var lightboxTitle = byId('lightboxTitle');
  var lightboxCaption = byId('lightboxCaption');
  var lightboxClose = byId('lightboxClose');

  function openLightbox(index) {
    var item = evidence[index];
    if (!item || !lightbox || !lightbox.showModal) return;
    lightboxImg.src = 'assets/evidence/' + item.file;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;
    lightboxCaption.textContent = item.caption;
    lightbox.showModal();
  }

  function closeLightbox() {
    if (lightbox && lightbox.open) lightbox.close();
  }

  if (evidenceGrid) {
    evidenceGrid.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-evidence]');
      if (!btn) return;
      openLightbox(Number(btn.getAttribute('data-evidence')));
    });
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }

  /* ------------------------------------------------------------------ *
   * Deployment notes
   * ------------------------------------------------------------------ */

  var auditGrid = byId('auditGrid');

  function renderAudit() {
    if (!auditGrid) return;
    auditGrid.innerHTML = D.audit.map(function (note) {
      return '<article class="audit-card">' +
        '<span class="level ' + esc(note.level) + '">' + esc(note.level) + '</span>' +
        '<h3>' + esc(note.title) + '</h3>' +
        '<p>' + esc(note.detail) + '</p>' +
        '<div class="objects">' + (note.objects || []).map(function (obj) {
          return '<span class="mini-tag">' + esc(obj) + '</span>';
        }).join('') + '</div>' +
      '</article>';
    }).join('');
  }

  renderAudit();

  /* ------------------------------------------------------------------ *
   * Copy buttons
   * ------------------------------------------------------------------ */

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('.copy');
    if (!btn) return;
    var card = btn.closest('.code-card');
    var pre = card ? card.querySelector('pre') : document.querySelector(btn.getAttribute('data-copy') || '');
    if (!pre) return;
    var text = pre.textContent;
    var done = function () {
      var original = btn.textContent;
      btn.textContent = 'Copied';
      window.setTimeout(function () { btn.textContent = original; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(area);
      done();
    }
  });

  /* ------------------------------------------------------------------ *
   * Scroll spy + year
   * ------------------------------------------------------------------ */

  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topnav a'));
  var sections = navLinks.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (section) { observer.observe(section); });
  }

  var year = byId('year');
  if (year) year.textContent = '© ' + new Date().getFullYear() + ' Kaisa Incorporated';

  /* Keyboard access for the policy table rows is handled above. */
})();
