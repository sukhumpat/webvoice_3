// =============================================================
//  Supabase configuration
//  -------------------------------------------------------------
//  แทนค่าด้านล่างด้วยค่าจริงจากโปรเจกต์ Supabase ของคุณ
//  (Project Settings > API)
//
//  หมายเหตุด้านความปลอดภัย:
//  - anon key เป็น public key สำหรับฝั่ง client ได้ตามปกติ
//    ความปลอดภัยจริงอยู่ที่ Row Level Security (RLS) ในฐานข้อมูล
//  - ห้ามนำ service_role key มาใส่ในไฟล์นี้เด็ดขาด
// =============================================================
window.SUPABASE_CONFIG = {
  SUPABASE_URL: 'https://tcjodgkamteldgtgrouw.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_iwXcKbghM-MWg-ek5jqkkQ_glFcRJta',
  // ชื่อ storage bucket สำหรับเก็บไฟล์เสียงที่อัดจากผู้ฝึก
  RECORDINGS_BUCKET: 'recordings'
};
