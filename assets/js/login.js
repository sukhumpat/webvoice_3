// =============================================================
//  login.html — เข้าสู่ระบบ / สมัครสมาชิก
// =============================================================
(function () {
  let selectedRole = 'user';

  function show(el, msg, type) {
    el.className = 'alert alert-' + (type || 'info') + ' alert-config';
    el.textContent = msg;
    el.classList.remove('d-none');
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const loginMsg = document.getElementById('login-msg');
    const regMsg = document.getElementById('register-msg');

    // ถ้ายังไม่ตั้งค่า Supabase แจ้งเตือน
    if (window.SB && !SB.isConfigured) {
      show(document.getElementById('config-note'),
        'ยังไม่ได้เชื่อมต่อ Supabase — การเข้าสู่ระบบจะใช้งานได้เมื่อตั้งค่าใน assets/js/config.js แล้ว (ดู README.md)',
        'warning');
      document.getElementById('config-note').classList.remove('d-none');
    }

    // เปิดแท็บ register ถ้า url มี #register
    if (location.hash === '#register') {
      const tab = document.querySelector('#register-tab');
      if (tab) new bootstrap.Tab(tab).show();
    }

    // เลือก role
    Array.prototype.forEach.call(document.querySelectorAll('.role-choice'), function (rc) {
      rc.addEventListener('click', function () {
        document.querySelectorAll('.role-choice').forEach(function (x) { x.classList.remove('active'); });
        rc.classList.add('active');
        selectedRole = rc.getAttribute('data-role');
      });
    });

    // ----- เข้าสู่ระบบ -----
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!SB.client) { show(loginMsg, 'ระบบยังไม่พร้อม', 'danger'); return; }
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      show(loginMsg, 'กำลังเข้าสู่ระบบ...', 'info');
      const { error } = await SB.client.auth.signInWithPassword({ email: email, password: password });
      if (error) { show(loginMsg, 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message, 'danger'); return; }
      await SB.logActivity('login');
      show(loginMsg, 'สำเร็จ! กำลังพาไปหน้าจัดการ...', 'success');
      setTimeout(function () { location.href = 'management.html'; }, 600);
    });

    // ----- สมัครสมาชิก -----
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!SB.client) { show(regMsg, 'ระบบยังไม่พร้อม', 'danger'); return; }
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      if (password.length < 6) { show(regMsg, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 'warning'); return; }

      show(regMsg, 'กำลังสมัครสมาชิก...', 'info');
      const { data, error } = await SB.client.auth.signUp({ email: email, password: password });
      if (error) { show(regMsg, 'สมัครไม่สำเร็จ: ' + error.message, 'danger'); return; }

      // ต้องมี session (ปิด email confirmation ไว้) จึงจะ insert role ได้ตาม RLS
      let session = data.session;
      if (!session) {
        const s = await SB.client.auth.signInWithPassword({ email: email, password: password });
        session = s.data ? s.data.session : null;
      }
      if (session) {
        const desc = selectedRole === 'specialist' ? 'ผู้เชี่ยวชาญ/คุณหมอ ให้คะแนนการออกเสียง' : 'ผู้ฝึกออกเสียง (เด็ก/ผู้ปกครอง)';
        const { error: rErr } = await SB.client.from('role').insert({
          user_id: session.user.id, email: email, role: selectedRole, description: desc
        });
        if (rErr) console.warn('insert role error:', rErr.message);
        await SB.logActivity('login');
      }
      show(regMsg, 'สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...', 'success');
      setTimeout(function () { location.href = 'management.html'; }, 700);
    });
  });
})();
