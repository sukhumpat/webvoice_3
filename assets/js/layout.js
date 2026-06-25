// =============================================================
//  Shared layout: header / nav / footer injected on every page
//  - ใส่ <div id="site-header"></div> และ <div id="site-footer"></div>
//    ในแต่ละหน้า แล้วไฟล์นี้จะเติม markup ให้
//  - ปรับเมนูตามสถานะ login + role
//  - <body data-page="app"> ใช้ระบุเมนูที่ active
// =============================================================
(function () {
  const NAV = [
    { page: 'index', href: 'index.html', label: 'หน้าแรก', icon: '🏠' },
    { page: 'about', href: 'about.html', label: 'เกี่ยวกับ', icon: 'ℹ️' },
    { page: 'app', href: 'app.html', label: 'ฝึกออกเสียง', icon: '🎤' },
    { page: 'game', href: 'game.html', label: 'เกม', icon: '🎮' },
    { page: 'contact', href: 'contact.html', label: 'ติดต่อ', icon: '✉️' }
  ];

  const current = document.body.getAttribute('data-page') || '';

  function headerHTML() {
    const links = NAV.map(function (n) {
      const active = n.page === current ? ' active' : '';
      return (
        '<li class="nav-item">' +
        '<a class="nav-link fw-semibold' + active + '" href="' + n.href + '">' +
        '<span aria-hidden="true">' + n.icon + '</span> ' + n.label +
        '</a></li>'
      );
    }).join('');

    return (
      '<nav class="navbar navbar-expand-lg navbar-light app-navbar sticky-top">' +
      '  <div class="container">' +
      '    <a class="navbar-brand d-flex align-items-center gap-2" href="index.html">' +
      '      <img src="favicon.svg" width="38" height="38" alt="โลโก้">' +
      '      <span class="brand-text">พูดเก่ง<span class="brand-accent">AI</span></span>' +
      '    </a>' +
      '    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="เมนู">' +
      '      <span class="navbar-toggler-icon"></span>' +
      '    </button>' +
      '    <div class="collapse navbar-collapse" id="mainNav">' +
      '      <ul class="navbar-nav mx-auto mb-2 mb-lg-0 gap-lg-1">' + links + '</ul>' +
      '      <div id="auth-area" class="d-flex align-items-center gap-2"></div>' +
      '    </div>' +
      '  </div>' +
      '</nav>'
    );
  }

  function footerHTML() {
    const year = new Date().getFullYear();
    return (
      '<footer class="app-footer mt-auto">' +
      '  <div class="container py-4">' +
      '    <div class="row gy-3 align-items-center">' +
      '      <div class="col-md-6 d-flex align-items-center gap-2">' +
      '        <img src="favicon.svg" width="34" height="34" alt="">' +
      '        <div>' +
      '          <div class="fw-bold">ระบบเรียนรู้การออกเสียงด้วย AI</div>' +
      '          <small class="text-white-50">ฝึกออกเสียงภาษาไทยสำหรับเด็ก 4–7 ปี</small>' +
      '        </div>' +
      '      </div>' +
      '      <div class="col-md-6 text-md-end">' +
      '        <a class="footer-link" href="about.html">เกี่ยวกับเรา</a>' +
      '        <a class="footer-link" href="contact.html">ติดต่อ</a>' +
      '        <a class="footer-link" href="management.html">จัดการ</a>' +
      '        <div class="text-white-50 mt-2"><small>© ' + year + ' AI Pronunciation Learning System</small></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</footer>'
    );
  }

  async function renderAuthArea() {
    const el = document.getElementById('auth-area');
    if (!el) return;
    let user = null,
      role = null;
    try {
      if (window.SB) {
        user = await SB.getUser();
        if (user) role = await SB.getRole();
      }
    } catch (e) {
      /* ignore */
    }

    if (user) {
      const name = (user.email || 'ผู้ใช้').split('@')[0];
      const roleLabel = role === 'specialist' ? 'ผู้เชี่ยวชาญ' : 'ผู้ฝึกออกเสียง';
      el.innerHTML =
        '<span class="navbar-user d-none d-lg-inline">' +
        '<span class="user-name">' + name + '</span>' +
        '<span class="badge rounded-pill role-badge ms-1">' + roleLabel + '</span></span>' +
        '<a href="management.html" class="btn btn-brand btn-sm fw-semibold rounded-pill px-3">' +
        '<span aria-hidden="true">📊</span> จัดการ</a>' +
        '<button id="logout-btn" class="btn btn-outline-danger btn-sm fw-semibold rounded-pill px-3">' +
        '<span aria-hidden="true">🚪</span> ออกจากระบบ</button>';
      const lo = document.getElementById('logout-btn');
      if (lo)
        lo.addEventListener('click', async function () {
          await SB.signOut();
          location.href = 'index.html';
        });
    } else {
      el.innerHTML =
        '<a href="login.html" class="btn btn-light btn-sm fw-bold rounded-pill px-3">เข้าสู่ระบบ</a>' +
        '<a href="login.html#register" class="btn btn-warning btn-sm fw-bold rounded-pill px-3 d-none d-sm-inline">สมัครสมาชิก</a>';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const h = document.getElementById('site-header');
    const f = document.getElementById('site-footer');
    if (h) h.innerHTML = headerHTML();
    if (f) f.innerHTML = footerHTML();
    renderAuthArea();
    // log page view (เฉพาะผู้ที่ login แล้ว)
    if (window.SB) SB.logPageView();
  });
})();
