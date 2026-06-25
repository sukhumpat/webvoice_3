// =============================================================
//  Audio utilities (ฝั่ง client ทั้งหมด)
//  - speak(text): อ่านออกเสียงคำตัวอย่างด้วย Web Speech API (ภาษาไทย)
//  - Recorder: อัดเสียงจากไมโครโฟน + วาดกราฟิกคลื่นเสียงเรียลไทม์
// =============================================================
window.AudioKit = (function () {

  // ---------- เสียงตัวอย่าง (Text-to-Speech) ----------
  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = 0.8;   // ช้าลงเล็กน้อยให้เด็กฟังชัด
    u.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const th = voices.find(function (v) { return /th(-|_)?TH/i.test(v.lang) || /thai/i.test(v.name); });
    if (th) u.voice = th;
    window.speechSynthesis.speak(u);
  }

  // โหลด voices ล่วงหน้า (บางเบราว์เซอร์โหลดแบบ async)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function () { window.speechSynthesis.getVoices(); };
  }

  // ---------- อัดเสียง + คลื่นเสียง ----------
  function Recorder() {
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.audioCtx = null;
    this.analyser = null;
    this.rafId = null;
  }

  Recorder.prototype.start = async function (canvas) {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // เลือก mime ที่รองรับ
    let mime = '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    for (let i = 0; i < candidates.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) { mime = candidates[i]; break; }
    }
    this.mediaRecorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);

    const self = this;
    this.mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) self.chunks.push(e.data);
    };
    this.mediaRecorder.start();

    // ตั้งค่า waveform
    if (canvas) this._drawWave(canvas);
  };

  Recorder.prototype._drawWave = function (canvas) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AC();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    const ctx = canvas.getContext('2d');
    const buffer = new Uint8Array(this.analyser.fftSize);
    const self = this;

    function render() {
      self.rafId = requestAnimationFrame(render);
      self.analyser.getByteTimeDomainData(buffer);
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f3f2fb';
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5b6cff';
      ctx.beginPath();
      const slice = w / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }
    render();
  };

  // หยุดอัด -> คืน Promise<Blob>
  Recorder.prototype.stop = function () {
    const self = this;
    return new Promise(function (resolve) {
      if (!self.mediaRecorder) { resolve(null); return; }
      self.mediaRecorder.onstop = function () {
        const blob = new Blob(self.chunks, { type: self.chunks[0] ? self.chunks[0].type : 'audio/webm' });
        self._cleanup();
        resolve(blob);
      };
      self.mediaRecorder.stop();
    });
  };

  Recorder.prototype._cleanup = function () {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
    if (this.audioCtx && this.audioCtx.state !== 'closed') { try { this.audioCtx.close(); } catch (e) {} }
  };

  return { speak: speak, Recorder: Recorder };
})();
