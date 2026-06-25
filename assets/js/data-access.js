// =============================================================
//  Data access layer
//  - โหลดคลังคำจาก Supabase (ตาราง words) ถ้าตั้งค่าแล้ว
//  - ไม่งั้น fallback ไปใช้ window.WORDS_DATA (assets/js/words-data.js)
//  - มี helper จัดกลุ่มแบบฝึกหัด + บันทึกผลฝึก
// =============================================================
window.DataAccess = (function () {
  let _cache = null;

  async function loadWords() {
    if (_cache) return _cache;
    // ลองดึงจาก Supabase ก่อน
    if (window.SB && SB.isConfigured && SB.client) {
      try {
        const { data, error } = await SB.client
          .from('words')
          .select('exercise_code,word,reading,letter,letter_name,age_level,emoji,order_index,id')
          .order('age_level', { ascending: true })
          .order('exercise_code', { ascending: true })
          .order('order_index', { ascending: true });
        if (!error && data && data.length) {
          _cache = data;
          return _cache;
        }
      } catch (e) {
        console.warn('โหลด words จาก Supabase ไม่สำเร็จ ใช้ข้อมูลสำรองแทน', e);
      }
    }
    // fallback
    _cache = (window.WORDS_DATA || []).slice();
    return _cache;
  }

  // คืน [{ age, exercises: [{ code, letter, letter_name, words:[...] }] }]
  async function getExercisesByAge() {
    const words = await loadWords();
    const ageMap = new Map();
    words.forEach(function (w) {
      const age = Number(w.age_level);
      if (!ageMap.has(age)) ageMap.set(age, new Map());
      const exMap = ageMap.get(age);
      if (!exMap.has(w.exercise_code)) {
        exMap.set(w.exercise_code, {
          code: w.exercise_code,
          letter: w.letter,
          letter_name: w.letter_name,
          age: age,
          words: []
        });
      }
      exMap.get(w.exercise_code).words.push(w);
    });
    const result = [];
    Array.from(ageMap.keys()).sort(function (a, b) { return a - b; }).forEach(function (age) {
      const exercises = Array.from(ageMap.get(age).values());
      exercises.forEach(function (ex) {
        ex.words.sort(function (a, b) { return (a.order_index || 0) - (b.order_index || 0); });
      });
      result.push({ age: age, exercises: exercises });
    });
    return result;
  }

  // คืนคำสุ่ม n คำ (ใช้ในเกม)
  async function getRandomWords(n) {
    const words = await loadWords();
    const copy = words.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy.slice(0, n || 10);
  }

  // บันทึกผลการฝึก: อัปโหลดไฟล์เสียง + insert ลงตาราง practice
  // คืน { ok, error, path }
  async function savePractice(wordRow, audioBlob) {
    if (!window.SB || !SB.isConfigured || !SB.client) {
      return { ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase (ดูคำแนะนำใน README)' };
    }
    const user = await SB.getUser();
    if (!user) return { ok: false, error: 'กรุณาเข้าสู่ระบบก่อนบันทึกการฝึก' };

    const cfg = window.SUPABASE_CONFIG || {};
    const bucket = cfg.RECORDINGS_BUCKET || 'recordings';
    // ใช้ key ที่ปลอดภัย (ไม่ใส่อักษรไทยใน path) — คำจริงถูกเก็บใน word_text อยู่แล้ว
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    const path = user.id + '/rec-' + stamp + '-' + rand + '.webm';

    try {
      const up = await SB.client.storage.from(bucket).upload(path, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: false
      });
      if (up.error) return { ok: false, error: 'อัปโหลดไฟล์เสียงไม่สำเร็จ: ' + up.error.message };

      const insert = {
        user_id: user.id,
        file_path: path,
        // ใส่ word_id เฉพาะเมื่อเป็น uuid จริงจาก Supabase
        word_id: wordRow.id && String(wordRow.id).length > 10 ? wordRow.id : null,
        word_text: wordRow.word,
        exercise_code: wordRow.exercise_code || null,
        score: null
      };
      const ins = await SB.client.from('practice').insert(insert);
      if (ins.error) return { ok: false, error: 'บันทึกข้อมูลไม่สำเร็จ: ' + ins.error.message };

      return { ok: true, path: path };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  return { loadWords, getExercisesByAge, getRandomWords, savePractice };
})();
