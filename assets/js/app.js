// =============================================================
//  app.html — แอพฝึกออกเสียง
// =============================================================
(function () {
  let dataByAge = [];
  let currentAge = 4;

  const ageColors = { 4: '#ff8a3d', 5: '#36c2a6', 6: '#5b6cff', 7: '#ff5e7e' };
  const ageEmoji = { 4: '🐤', 5: '🐰', 6: '🦊', 7: '🦉' };

  const elAgeBar = document.getElementById('age-bar');
  const elExercises = document.getElementById('exercise-list');
  const elPractice = document.getElementById('practice-area');

  function ageGroup(age) {
    return dataByAge.find(function (g) { return g.age === age; });
  }

  function renderAgeBar() {
    elAgeBar.innerHTML = [4, 5, 6, 7].map(function (age) {
      const active = age === currentAge ? ' active' : '';
      return (
        '<div class="col-6 col-md-3">' +
        '<div class="age-pill' + active + '" data-age="' + age + '">' +
        '<div class="emoji">' + ageEmoji[age] + '</div>' +
        '<div class="age">' + age + ' ปี</div>' +
        '</div></div>'
      );
    }).join('');
    Array.prototype.forEach.call(elAgeBar.querySelectorAll('.age-pill'), function (p) {
      p.addEventListener('click', function () {
        currentAge = Number(p.getAttribute('data-age'));
        renderAgeBar();
        renderExercises();
        elPractice.classList.add('d-none');
        elExercises.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderExercises() {
    const group = ageGroup(currentAge);
    if (!group) { elExercises.innerHTML = '<p class="text-muted">ไม่พบแบบฝึกหัด</p>'; return; }
    const color = ageColors[currentAge];
    elExercises.innerHTML =
      '<h3 class="mb-1">แบบฝึกหัดสำหรับน้อง ' + currentAge + ' ปี ' + ageEmoji[currentAge] + '</h3>' +
      '<p class="text-muted">มี ' + group.exercises.length + ' แบบฝึกหัด · แต่ละแบบฝึกหัดมี 20 คำ — เลือกตัวอักษรที่อยากฝึก</p>' +
      '<div class="row g-3">' +
      group.exercises.map(function (ex, i) {
        return (
          '<div class="col-md-6 col-lg-4">' +
          '<div class="exercise-card" data-code="' + ex.code + '">' +
          '<div class="exercise-letter" style="background:' + color + '">' + ex.letter + '</div>' +
          '<div><div class="fw-bold fs-5">' + ex.letter_name + '</div>' +
          '<small class="text-muted">' + ex.words.length + ' คำ · เริ่มฝึก →</small></div>' +
          '</div></div>'
        );
      }).join('') +
      '</div>';
    Array.prototype.forEach.call(elExercises.querySelectorAll('.exercise-card'), function (c) {
      c.addEventListener('click', function () {
        openExercise(c.getAttribute('data-code'));
      });
    });
  }

  function openExercise(code) {
    const group = ageGroup(currentAge);
    const ex = group.exercises.find(function (e) { return e.code === code; });
    if (!ex) return;

    elPractice.classList.remove('d-none');
    elPractice.innerHTML =
      '<div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">' +
      '<h3 class="mb-0">ฝึกออกเสียงหมวด ' + ex.letter_name + ' <span class="text-muted fs-6">(' + ex.words.length + ' คำ)</span></h3>' +
      '<button class="btn btn-outline-secondary btn-sm" id="back-to-list">← กลับไปเลือกแบบฝึกหัด</button>' +
      '</div>' +
      '<div class="row g-3" id="word-grid"></div>';

    document.getElementById('back-to-list').addEventListener('click', function () {
      elPractice.classList.add('d-none');
      elExercises.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const grid = document.getElementById('word-grid');
    ex.words.forEach(function (w, i) {
      grid.appendChild(buildWordCard(w, i));
    });

    elPractice.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildWordCard(w, i) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';
    col.innerHTML =
      '<div class="word-card">' +
      '<div class="word-emoji">' + (w.emoji || '🗣️') + '</div>' +
      '<div class="word-text">' + w.word + '</div>' +
      '<div class="word-reading mb-3">อ่านว่า: ' + (w.reading || w.word) + '</div>' +
      '<canvas class="waveform mb-2 d-none" width="320" height="70"></canvas>' +
      '<div class="d-grid gap-2">' +
      '<button class="btn btn-sun btn-listen">🔊 ฟังเสียงตัวอย่าง</button>' +
      '<button class="btn btn-brand btn-rec">🎤 ฝึกออกเสียง</button>' +
      '</div>' +
      '<audio class="w-100 mt-2 d-none" controls></audio>' +
      '<div class="small mt-2 status text-muted"></div>' +
      '</div>';

    const canvas = col.querySelector('canvas');
    const btnListen = col.querySelector('.btn-listen');
    const btnRec = col.querySelector('.btn-rec');
    const audio = col.querySelector('audio');
    const status = col.querySelector('.status');

    btnListen.addEventListener('click', function () {
      AudioKit.speak(w.reading ? w.reading.replace(/-/g, '') : w.word);
    });

    let recorder = null;
    let recording = false;

    btnRec.addEventListener('click', async function () {
      if (!recording) {
        try {
          recorder = new AudioKit.Recorder();
          canvas.classList.remove('d-none');
          await recorder.start(canvas);
          recording = true;
          btnRec.classList.remove('btn-brand');
          btnRec.classList.add('btn-accent');
          btnRec.innerHTML = '<span class="rec-dot"></span> หยุด &amp; บันทึก';
          status.textContent = 'กำลังอัดเสียง... พูดคำว่า "' + w.word + '" ให้ชัด ๆ นะ';
        } catch (e) {
          status.innerHTML = '<span class="text-danger">ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้ไมค์</span>';
        }
      } else {
        recording = false;
        btnRec.disabled = true;
        btnRec.innerHTML = 'กำลังบันทึก...';
        const blob = await recorder.stop();
        canvas.classList.add('d-none');
        btnRec.classList.add('btn-brand');
        btnRec.classList.remove('btn-accent');
        btnRec.innerHTML = '🎤 ฝึกอีกครั้ง';
        btnRec.disabled = false;

        if (blob) {
          audio.src = URL.createObjectURL(blob);
          audio.classList.remove('d-none');
        }

        // บันทึกเข้า Supabase
        const user = window.SB ? await SB.getUser() : null;
        if (!user) {
          status.innerHTML = '🎧 ฟังเสียงตัวเองได้เลย! · <a href="login.html">เข้าสู่ระบบ</a> เพื่อบันทึกผลและให้คุณหมอช่วยให้คะแนน';
          return;
        }
        status.textContent = 'กำลังบันทึกผลการฝึก...';
        const res = await DataAccess.savePractice(w, blob);
        if (res.ok) {
          status.innerHTML = '<span class="text-success fw-semibold">✅ บันทึกสำเร็จ! รอคุณหมอให้คะแนน</span>';
        } else {
          status.innerHTML = '<span class="text-danger">⚠️ ' + res.error + '</span>';
        }
      }
    });

    return col;
  }

  document.addEventListener('DOMContentLoaded', async function () {
    // แจ้งเตือนถ้ายังไม่ตั้งค่า Supabase
    if (window.SB && !SB.isConfigured) {
      const note = document.getElementById('config-note');
      if (note) note.classList.remove('d-none');
    }
    dataByAge = await DataAccess.getExercisesByAge();
    renderAgeBar();
    renderExercises();
  });
})();
