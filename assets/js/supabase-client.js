// =============================================================
//  Supabase client + helper functions (shared across all pages)
//  ต้องโหลดหลังจาก:
//    1) @supabase/supabase-js (UMD) จาก CDN
//    2) assets/js/config.js
// =============================================================
(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const isConfigured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes('YOUR-PROJECT') &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes('YOUR-ANON');

  // สร้าง client (ถ้ายังไม่ตั้งค่า จะยังสร้างได้แต่เรียก API ไม่สำเร็จ)
  let supabase = null;
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(
      cfg.SUPABASE_URL || 'https://placeholder.supabase.co',
      cfg.SUPABASE_ANON_KEY || 'placeholder'
    );
  }

  // ---------- Auth helpers ----------
  async function getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data ? data.session : null;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  // คืนค่า role ('user' | 'specialist' | null) ของผู้ใช้ปัจจุบัน
  async function getRole() {
    const user = await getUser();
    if (!user || !supabase) return null;
    const { data, error } = await supabase
      .from('role')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.warn('getRole error:', error.message);
      return null;
    }
    return data ? data.role : null;
  }

  async function signOut() {
    if (!supabase) return;
    await logActivity('logout');
    await supabase.auth.signOut();
  }

  // ---------- Activity logging ----------
  // activity: { type: 'login' | 'logout' | 'page', page?: '<file>' }
  async function logActivity(type, extra) {
    try {
      const user = await getUser();
      if (!user || !supabase) return;
      const payload = Object.assign({ type }, extra || {});
      await supabase.from('activity').insert({
        user_id: user.id,
        activity: payload
      });
    } catch (e) {
      console.warn('logActivity failed:', e);
    }
  }

  // บันทึก page view อัตโนมัติ (เรียกจาก layout.js)
  async function logPageView() {
    const page = location.pathname.split('/').pop() || 'index.html';
    await logActivity('page', { page });
  }

  // ---------- Expose ----------
  window.SB = {
    client: supabase,
    isConfigured,
    getSession,
    getUser,
    getRole,
    signOut,
    logActivity,
    logPageView
  };
})();
