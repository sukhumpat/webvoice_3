// =============================================================
//  management.html — ต้อง login ก่อน, แสดงผลตาม role
//    user       : รายงานการฝึกของตนเอง
//    specialist : ให้คะแนนเสียง + CRUD คำฝึก + ดูรายงานผู้ฝึก
// =============================================================
(function () {
  const bucket = (window.SUPABASE_CONFIG || {}).RECORDINGS_BUCKET || 'recordings';
  let me = null, myRole = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }
  function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ---------- รายงานผู้ฝึก (ใช้ทั้งฝั่ง user และ specialist) ----------
  async function renderUserReport(targetId, mountEl) {
    mountEl.innerHTML = '<p class="text-muted">กำลังโหลดรายงาน...</p>';
    const { data, error } = await SB.client
      .from('practice')
      .select('id,word_text,exercise_code,score,practiced_at,created_at')
      .eq('user_id', targetId)
      .order('practiced_at', { ascending: false });

    if (error) { mountEl.innerHTML = '<div class="alert alert-danger">โหลดข้อมูลไม่สำเร็จ: ' + esc(error.message) + '</div>'; return; }
    const rows = data || [];
    if (!rows.length) {
      mountEl.innerHTML = '<div class="alert alert-info">ยังไม่มีประวัติการฝึก ลองไป <a href="app.html">ฝึกออกเสียง</a> กันเลย!</div>';
      return;
    }

    // สถิติรวม
    const days = new Set(), exercises = new Set();
    let scored = 0, scoreSum = 0;
    rows.forEach(function (r) {
      const day = (r.practiced_at || r.created_at || '').slice(0, 10);
      days.add(day);
      if (r.exercise_code) exercises.add(r.exercise_code);
      if (r.score != null) { scored++; scoreSum += Number(r.score); }
    });

    // สรุปรายวัน: วันที่ + จำนวนคำที่ฝึก + จำนวนแบบฝึกหัด
    const byDay = {};
    rows.forEach(function (r) {
      const day = (r.practiced_at || r.created_at || '').slice(0, 10);
      if (!byDay[day]) byDay[day] = { count: 0, ex: new Set() };
      byDay[day].count++;
      if (r.exercise_code) byDay[day].ex.add(r.exercise_code);
    });
    const dayRows = Object.keys(byDay).sort().reverse().map(function (day) {
      return '<tr><td>' + fmtDate(day) + '</td><td class="text-center">' + byDay[day].count +
        '</td><td class="text-center">' + byDay[day].ex.size + '</td></tr>';
    }).join('');

    mountEl.innerHTML =
      '<div class="row g-3 mb-4">' +
      statCard('🎤', rows.length, 'คำที่ฝึกทั้งหมด') +
      statCard('📚', exercises.size, 'แบบฝึกหัดที่ทำ') +
      statCard('📅', days.size, 'จำนวนวันที่ฝึก') +
      statCard('⭐', scored ? (scoreSum / scored).toFixed(1) : '-', 'คะแนนเฉลี่ย') +
      '</div>' +
      '<h5 class="mb-3">สรุปการฝึกรายวัน</h5>' +
      '<div class="table-responsive mb-4"><table class="table table-hover align-middle bg-white rounded-2xl overflow-hidden">' +
      '<thead><tr><th>วันที่</th><th class="text-center">จำนวนคำที่ฝึก</th><th class="text-center">จำนวนแบบฝึกหัด</th></tr></thead>' +
      '<tbody>' + dayRows + '</tbody></table></div>' +
      '<h5 class="mb-3">ประวัติล่าสุด</h5>' +
      '<div class="table-responsive"><table class="table align-middle bg-white rounded-2xl overflow-hidden">' +
      '<thead><tr><th>คำ</th><th>แบบฝึกหัด</th><th>วันเวลา</th><th class="text-center">คะแนน</th></tr></thead><tbody>' +
      rows.slice(0, 30).map(function (r) {
        const score = r.score != null
          ? '<span class="badge bg-success">' + r.score + '</span>'
          : '<span class="badge bg-secondary">รอให้คะแนน</span>';
        return '<tr><td class="fw-semibold">' + esc(r.word_text) + '</td><td>' + esc(r.exercise_code || '-') +
          '</td><td>' + fmtDateTime(r.practiced_at || r.created_at) + '</td><td class="text-center">' + score + '</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function statCard(emoji, num, label) {
    return '<div class="col-6 col-lg-3"><div class="stat-card text-center">' +
      '<div style="font-size:1.6rem">' + emoji + '</div><div class="stat-num">' + num + '</div>' +
      '<small class="text-muted">' + label + '</small></div></div>';
  }

  // ---------- specialist: ให้คะแนนเสียง ----------
  async function loadUserList() {
    const { data, error } = await SB.client.from('role').select('user_id,email').eq('role', 'user');
    if (error) return [];
    return data || [];
  }

  async function renderScoring(mount) {
    mount.innerHTML =
      '<div class="row g-2 align-items-end mb-3">' +
      '<div class="col-sm-6 col-md-4"><label class="form-label fw-semibold">กรองตามผู้ฝึก</label>' +
      '<select id="score-user" class="form-select"><option value="">— ทุกคน —</option></select></div>' +
      '<div class="col-auto"><button id="score-reload" class="btn btn-outline-secondary">🔄 รีเฟรช</button></div>' +
      '</div><div id="score-list">กำลังโหลด...</div>';

    const sel = el('score-user');
    const users = await loadUserList();
    users.forEach(function (u) {
      const o = document.createElement('option');
      o.value = u.user_id;
      o.textContent = u.email || u.user_id.slice(0, 8);
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { loadScoreList(sel.value); });
    el('score-reload').addEventListener('click', function () { loadScoreList(sel.value); });
    loadScoreList('');
  }

  async function loadScoreList(userId) {
    const mount = el('score-list');
    mount.innerHTML = '<p class="text-muted">กำลังโหลดไฟล์เสียง...</p>';
    let q = SB.client.from('practice')
      .select('id,user_id,word_text,exercise_code,file_path,score,practiced_at,created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) { mount.innerHTML = '<div class="alert alert-danger">' + esc(error.message) + '</div>'; return; }
    if (!data || !data.length) { mount.innerHTML = '<div class="alert alert-info">ยังไม่มีไฟล์เสียงให้คะแนน</div>'; return; }

    const container = document.createElement('div');
    container.className = 'd-grid gap-3';
    for (const r of data) {
      const card = document.createElement('div');
      card.className = 'card-soft p-3';
      let audioUrl = '';
      if (r.file_path) {
        const { data: signed } = await SB.client.storage.from(bucket).createSignedUrl(r.file_path, 3600);
        audioUrl = signed ? signed.signedUrl : '';
      }
      card.innerHTML =
        '<div class="row g-2 align-items-center">' +
        '<div class="col-md-3"><div class="fs-4 fw-bold">' + esc(r.word_text) + '</div>' +
        '<small class="text-muted">' + esc(r.exercise_code || '') + ' · ' + fmtDateTime(r.practiced_at || r.created_at) + '</small></div>' +
        '<div class="col-md-5">' + (audioUrl
          ? '<audio class="w-100" controls src="' + audioUrl + '"></audio>'
          : '<span class="text-muted">ไม่พบไฟล์เสียง</span>') + '</div>' +
        '<div class="col-md-2"><input type="number" min="0" max="100" class="form-control score-input" placeholder="0-100" value="' + (r.score != null ? r.score : '') + '"></div>' +
        '<div class="col-md-2 d-grid"><button class="btn btn-brand btn-save">บันทึกคะแนน</button>' +
        '<div class="small mt-1 save-status"></div></div>' +
        '</div>';

      const input = card.querySelector('.score-input');
      const status = card.querySelector('.save-status');
      card.querySelector('.btn-save').addEventListener('click', async function () {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 0 || val > 100) { status.innerHTML = '<span class="text-danger">0–100 เท่านั้น</span>'; return; }
        status.textContent = 'กำลังบันทึก...';
        const { error: uErr } = await SB.client.from('practice')
          .update({ score: val, scored_by: me.id, scored_at: new Date().toISOString() })
          .eq('id', r.id);
        status.innerHTML = uErr ? '<span class="text-danger">ผิดพลาด</span>' : '<span class="text-success">✅ บันทึกแล้ว</span>';
      });
      container.appendChild(card);
    }
    mount.innerHTML = '';
    mount.appendChild(container);
  }

  // ---------- specialist: CRUD คำฝึก ----------
  const LETTERS = ['ก','ข','ค','จ','ด','ต','ท','น','บ','ป','ผ','พ','ม','ย','ร','ล','ว','ส','ห','อ'];

  async function renderWordsCrud(mount) {
    mount.innerHTML =
      '<div class="alert alert-light border">เลือกช่วงอายุและตัวอักษรเพื่อจัดการคำในแบบฝึกหัดนั้น</div>' +
      '<div class="row g-2 align-items-end mb-3">' +
      '<div class="col-auto"><label class="form-label fw-semibold">อายุ</label>' +
      '<select id="crud-age" class="form-select">' + [4,5,6,7].map(function (a){return '<option>'+a+'</option>';}).join('') + '</select></div>' +
      '<div class="col-auto"><label class="form-label fw-semibold">ตัวอักษร</label>' +
      '<select id="crud-letter" class="form-select">' + LETTERS.map(function (l){return '<option>'+l+'</option>';}).join('') + '</select></div>' +
      '<div class="col-auto"><button id="crud-load" class="btn btn-brand">แสดงคำ</button></div>' +
      '</div>' +
      '<div id="crud-add" class="card-soft p-3 mb-3"></div>' +
      '<div id="crud-list"></div>';

    el('crud-load').addEventListener('click', loadCrud);
    renderAddForm();
    loadCrud();
  }

  function curCode() {
    return 'EX-' + el('crud-age').value + '-' + el('crud-letter').value;
  }

  function renderAddForm() {
    el('crud-add').innerHTML =
      '<h6 class="fw-bold mb-2">➕ เพิ่มคำใหม่ในแบบฝึกหัด <span id="add-code" class="text-primary2"></span></h6>' +
      '<div class="row g-2">' +
      '<div class="col-md-3"><input id="add-word" class="form-control" placeholder="คำ เช่น ไก่"></div>' +
      '<div class="col-md-3"><input id="add-reading" class="form-control" placeholder="คำอ่าน เช่น ไก่"></div>' +
      '<div class="col-md-2"><input id="add-emoji" class="form-control" placeholder="อิโมจิ 🐔"></div>' +
      '<div class="col-md-2 d-grid"><button id="add-btn" class="btn btn-accent">เพิ่ม</button></div>' +
      '</div><div id="add-status" class="small mt-2"></div>';
    el('add-code').textContent = curCode();
    el('crud-age').addEventListener('change', function(){ el('add-code').textContent = curCode(); });
    el('crud-letter').addEventListener('change', function(){ el('add-code').textContent = curCode(); });
    el('add-btn').addEventListener('click', addWord);
  }

  async function addWord() {
    const status = el('add-status');
    const word = el('add-word').value.trim();
    if (!word) { status.innerHTML = '<span class="text-danger">กรุณากรอกคำ</span>'; return; }
    status.textContent = 'กำลังเพิ่ม...';
    const code = curCode();
    // หา order_index ถัดไป
    const { data: existing } = await SB.client.from('words').select('order_index').eq('exercise_code', code);
    const next = (existing || []).reduce(function (m, r){ return Math.max(m, r.order_index || 0); }, 0) + 1;
    const letter = el('crud-letter').value;
    const { error } = await SB.client.from('words').insert({
      exercise_code: code, word: word, reading: el('add-reading').value.trim() || word,
      letter: letter, letter_name: letter, age_level: Number(el('crud-age').value),
      emoji: el('add-emoji').value.trim() || '🗣️', order_index: next
    });
    if (error) { status.innerHTML = '<span class="text-danger">' + esc(error.message) + '</span>'; return; }
    status.innerHTML = '<span class="text-success">✅ เพิ่มแล้ว</span>';
    el('add-word').value = ''; el('add-reading').value = ''; el('add-emoji').value = '';
    loadCrud();
  }

  async function loadCrud() {
    const mount = el('crud-list');
    el('add-code').textContent = curCode();
    mount.innerHTML = '<p class="text-muted">กำลังโหลด...</p>';
    const { data, error } = await SB.client.from('words')
      .select('id,word,reading,emoji,order_index')
      .eq('exercise_code', curCode()).order('order_index');
    if (error) { mount.innerHTML = '<div class="alert alert-danger">' + esc(error.message) + '</div>'; return; }
    if (!data || !data.length) { mount.innerHTML = '<div class="alert alert-info">ยังไม่มีคำในแบบฝึกหัดนี้</div>'; return; }

    mount.innerHTML = '<div class="table-responsive"><table class="table align-middle bg-white">' +
      '<thead><tr><th>#</th><th>คำ</th><th>คำอ่าน</th><th>อิโมจิ</th><th></th></tr></thead><tbody></tbody></table></div>';
    const tbody = mount.querySelector('tbody');
    data.forEach(function (r) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (r.order_index || '') + '</td>' +
        '<td><input class="form-control form-control-sm e-word" value="' + esc(r.word) + '"></td>' +
        '<td><input class="form-control form-control-sm e-reading" value="' + esc(r.reading || '') + '"></td>' +
        '<td><input class="form-control form-control-sm e-emoji" style="width:80px" value="' + esc(r.emoji || '') + '"></td>' +
        '<td class="text-nowrap"><button class="btn btn-sm btn-outline-primary me-1 b-save">💾</button>' +
        '<button class="btn btn-sm btn-outline-danger b-del">🗑️</button>' +
        '<span class="small ms-2 st"></span></td>';
      const st = tr.querySelector('.st');
      tr.querySelector('.b-save').addEventListener('click', async function () {
        st.textContent = '...';
        const { error: e } = await SB.client.from('words').update({
          word: tr.querySelector('.e-word').value.trim(),
          reading: tr.querySelector('.e-reading').value.trim(),
          emoji: tr.querySelector('.e-emoji').value.trim()
        }).eq('id', r.id);
        st.innerHTML = e ? '<span class="text-danger">x</span>' : '<span class="text-success">✓</span>';
      });
      tr.querySelector('.b-del').addEventListener('click', async function () {
        if (!confirm('ลบคำ "' + r.word + '" ?')) return;
        const { error: e } = await SB.client.from('words').delete().eq('id', r.id);
        if (!e) tr.remove(); else st.innerHTML = '<span class="text-danger">ลบไม่ได้</span>';
      });
      tbody.appendChild(tr);
    });
  }

  // ---------- specialist: ดูรายงานผู้ฝึก ----------
  async function renderUsersReport(mount) {
    mount.innerHTML =
      '<div class="row g-2 align-items-end mb-3"><div class="col-sm-6 col-md-4">' +
      '<label class="form-label fw-semibold">เลือกผู้ฝึก</label>' +
      '<select id="rep-user" class="form-select"><option value="">— เลือก —</option></select></div></div>' +
      '<div id="rep-body" class="text-muted">เลือกผู้ฝึกเพื่อดูรายงาน</div>';
    const sel = el('rep-user');
    const users = await loadUserList();
    users.forEach(function (u) {
      const o = document.createElement('option');
      o.value = u.user_id; o.textContent = u.email || u.user_id.slice(0, 8);
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      if (sel.value) renderUserReport(sel.value, el('rep-body'));
      else el('rep-body').innerHTML = '<span class="text-muted">เลือกผู้ฝึกเพื่อดูรายงาน</span>';
    });
  }

  // ---------- bootstrap หน้า ----------
  document.addEventListener('DOMContentLoaded', async function () {
    const gate = el('auth-gate');
    const content = el('mgmt-content');

    if (!window.SB || !SB.isConfigured) {
      gate.classList.remove('d-none');
      gate.innerHTML = '<div class="alert alert-warning alert-config">⚙️ ยังไม่ได้เชื่อมต่อ Supabase — หน้านี้ต้องตั้งค่า Supabase ก่อน (ดู README.md)</div>';
      return;
    }
    me = await SB.getUser();
    if (!me) {
      gate.classList.remove('d-none');
      gate.innerHTML =
        '<div class="card-soft p-5 text-center"><div style="font-size:3rem">🔒</div>' +
        '<h3>กรุณาเข้าสู่ระบบ</h3><p class="text-muted">หน้านี้สำหรับผู้ที่เข้าสู่ระบบแล้วเท่านั้น</p>' +
        '<a href="login.html" class="btn btn-brand btn-lg">ไปหน้าเข้าสู่ระบบ</a></div>';
      return;
    }
    myRole = await SB.getRole();
    content.classList.remove('d-none');

    if (myRole === 'specialist') {
      el('role-title').textContent = 'แดชบอร์ดผู้เชี่ยวชาญ';
      el('role-sub').textContent = 'ให้คะแนนเสียง · จัดการคำฝึก · ดูรายงานผู้ฝึก';
      el('specialist-view').classList.remove('d-none');
      renderScoring(el('tab-scoring'));
      renderWordsCrud(el('tab-words'));
      renderUsersReport(el('tab-reports'));
    } else {
      el('role-title').textContent = 'รายงานการฝึกของฉัน';
      el('role-sub').textContent = 'ดูพัฒนาการและประวัติการฝึกออกเสียง';
      el('user-view').classList.remove('d-none');
      renderUserReport(me.id, el('user-report'));
    }
  });
})();
