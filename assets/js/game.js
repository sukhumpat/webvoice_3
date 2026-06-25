// =============================================================
//  game.html — เกมฝึกออกเสียง (Phaser 3, 2D top-down)
//  ตัวละครเดินสำรวจชนบท เก็บไอเทม -> popup ฝึกอ่านออกเสียงคำสุ่ม
//  ประมวลผลฝั่ง client ทั้งหมด
// =============================================================
(function () {
  let wordPool = [];
  let scene = null;
  let player, cursors, wasd, itemsGroup;
  let activePopup = false;
  let collected = 0;
  const totalItems = 6;

  // ---------- ฉาก ----------
  class WorldScene extends Phaser.Scene {
    constructor() { super('world'); }

    create() {
      scene = this;
      const W = this.scale.width, H = this.scale.height;

      // สร้าง texture ด้วย graphics (ไม่ต้องโหลดไฟล์ภายนอก)
      makeCircleTexture(this, 'player', 18, 0x5b6cff);
      makeCircleTexture(this, 'item', 22, 0xffffff);

      // ----- วาดฉากชนบท -----
      const g = this.add.graphics();
      // ท้องทุ่งหญ้า
      g.fillStyle(0x8fd14f, 1); g.fillRect(0, 0, W, H);
      // แปลงนาเป็นช่อง ๆ
      g.fillStyle(0x7cc23f, 1);
      for (let y = 0; y < H; y += 80) for (let x = 0; x < W; x += 80)
        if ((x / 80 + y / 80) % 2 === 0) g.fillRect(x, y, 80, 80);
      // แม่น้ำ (แนวนอนกลางจอ)
      g.fillStyle(0x49a7e8, 1); g.fillRect(0, H * 0.45, W, 90);
      g.fillStyle(0x6fbcf0, 1); g.fillRect(0, H * 0.45, W, 12);
      // ถนน (แนวตั้ง)
      g.fillStyle(0xb8a98f, 1); g.fillRect(W * 0.5 - 36, 0, 72, H);
      g.lineStyle(4, 0xffffff, 0.8);
      for (let y = 10; y < H; y += 50) { g.beginPath(); g.moveTo(W * 0.5, y); g.lineTo(W * 0.5, y + 24); g.strokePath(); }
      // สะพานข้ามแม่น้ำ (ตรงถนน)
      g.fillStyle(0x9c6b3f, 1); g.fillRect(W * 0.5 - 46, H * 0.45 - 8, 92, 106);
      g.lineStyle(3, 0x6e4a2b, 1);
      for (let i = 0; i < 8; i++) { const yy = H * 0.45 - 6 + i * 13; g.beginPath(); g.moveTo(W*0.5-46, yy); g.lineTo(W*0.5+46, yy); g.strokePath(); }

      // บ้านเรือน (วาดด้วย graphics เป็นรูปประกอบ)
      drawHouse(this, 70, 70, 0xff8a3d);
      drawHouse(this, W - 150, 90, 0xff5e7e);
      drawHouse(this, 90, H - 130, 0x9b6bff);
      drawHouse(this, W - 160, H - 140, 0x36c2a6);

      // ต้นไม้ประดับ
      [[200,150],[W-260,200],[150,H-220],[W-300,H-180],[W*0.5+120,90],[W*0.5-160,H-120]]
        .forEach(function (p) { drawTree(scene, p[0], p[1]); });

      // ----- ผู้เล่น -----
      player = this.physics.add.sprite(W * 0.5, H * 0.72, 'player');
      player.setCollideWorldBounds(true);
      player.setCircle(18);
      // หน้ายิ้มบนตัวละคร
      this.playerFace = this.add.text(player.x, player.y, '🙂', { fontSize: '26px' }).setOrigin(0.5);

      // ----- ไอเทมกระจายตามฉาก -----
      itemsGroup = this.physics.add.group();
      const spots = [
        [120, 130], [W - 120, 150], [W * 0.5, 70],
        [150, H - 110], [W - 140, H - 120], [W * 0.5, H - 80]
      ];
      spots.slice(0, totalItems).forEach(function (s, i) {
        spawnItem(scene, s[0], s[1], i);
      });

      this.physics.add.overlap(player, itemsGroup, onCollect, null, this);

      // ----- ปุ่มควบคุม -----
      cursors = this.input.keyboard.createCursorKeys();
      wasd = this.input.keyboard.addKeys('W,A,S,D');

      // ปุ่มทิศบนจอ (มือถือ)
      bindTouchButtons();

      // HUD
      updateHud();
    }

    update() {
      if (!player) return;
      const speed = 220;
      let vx = 0, vy = 0;
      if (activePopup) { player.setVelocity(0, 0); return; }
      if (cursors.left.isDown || wasd.A.isDown) vx = -speed;
      else if (cursors.right.isDown || wasd.D.isDown) vx = speed;
      if (cursors.up.isDown || wasd.W.isDown) vy = -speed;
      else if (cursors.down.isDown || wasd.S.isDown) vy = speed;
      // ทิศจากปุ่มสัมผัส
      if (window._touchDir) { vx += window._touchDir.x * speed; vy += window._touchDir.y * speed; }
      player.setVelocity(vx, vy);
      if (this.playerFace) this.playerFace.setPosition(player.x, player.y);
    }
  }

  // ---------- helper วาด ----------
  function makeCircleTexture(s, key, r, color) {
    if (s.textures.exists(key)) return;
    const g = s.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1); g.fillCircle(r, r, r);
    g.lineStyle(4, 0xffffff, 1); g.strokeCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }
  function drawHouse(s, x, y, color) {
    const g = s.add.graphics();
    g.fillStyle(0x7a4b2b, 1); g.fillRect(x, y + 30, 80, 50);      // ตัวบ้าน
    g.fillStyle(color, 1); g.fillTriangle(x - 8, y + 30, x + 88, y + 30, x + 40, y - 6); // หลังคา
    g.fillStyle(0xffe08a, 1); g.fillRect(x + 30, y + 50, 22, 30); // ประตู
  }
  function drawTree(s, x, y) {
    const g = s.add.graphics();
    g.fillStyle(0x6e4a2b, 1); g.fillRect(x - 5, y, 10, 26);
    g.fillStyle(0x3fa34d, 1); g.fillCircle(x, y - 6, 20);
    g.fillStyle(0x55c167, 1); g.fillCircle(x - 10, y, 14); g.fillCircle(x + 10, y, 14);
  }

  function spawnItem(s, x, y, idx) {
    const sprite = s.physics.add.sprite(x, y, 'item');
    sprite.setCircle(22);
    sprite.itemIndex = idx;
    const word = wordPool[idx % wordPool.length] || { emoji: '⭐' };
    sprite.emojiText = s.add.text(x, y, word.emoji || '⭐', { fontSize: '28px' }).setOrigin(0.5);
    s.tweens.add({ targets: [sprite, sprite.emojiText], y: y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    itemsGroup.add(sprite);
    return sprite;
  }

  function onCollect(playerObj, item) {
    if (activePopup || item.collecting) return;
    item.collecting = true;
    const word = wordPool[item.itemIndex % wordPool.length];
    showPopup(word, function () {
      // เก็บไอเทมหลังปิด popup
      if (item.emojiText) item.emojiText.destroy();
      item.destroy();
      collected++;
      updateHud();
      if (collected >= totalItems) winGame();
    });
  }

  function updateHud() {
    const hud = document.getElementById('game-hud');
    if (hud) hud.innerHTML = '⭐ เก็บแล้ว ' + collected + ' / ' + totalItems + ' คำ';
  }

  function winGame() {
    const ov = document.getElementById('game-popup');
    ov.querySelector('.popup-inner').innerHTML =
      '<div style="font-size:3rem">🏆</div><h3>เก่งมาก!</h3>' +
      '<p class="text-muted">น้องเก็บครบทุกคำแล้ว ลองเล่นอีกรอบไหม?</p>' +
      '<button class="btn btn-brand btn-lg" onclick="location.reload()">เล่นอีกครั้ง</button>';
    ov.classList.add('show');
    activePopup = true;
  }

  // ---------- popup ฝึกออกเสียง (DOM overlay) ----------
  let recorder = null, recording = false;
  function showPopup(word, onDone) {
    activePopup = true;
    const ov = document.getElementById('game-popup');
    const inner = ov.querySelector('.popup-inner');
    inner.innerHTML =
      '<div class="word-emoji">' + (word.emoji || '⭐') + '</div>' +
      '<div class="word-text">' + word.word + '</div>' +
      '<div class="word-reading mb-2">อ่านว่า: ' + (word.reading || word.word) + '</div>' +
      '<canvas class="waveform mb-2 d-none" width="300" height="64"></canvas>' +
      '<div class="d-grid gap-2">' +
      '<button class="btn btn-sun btn-lg g-listen">🔊 ฟังเสียงตัวอย่าง</button>' +
      '<button class="btn btn-brand btn-lg g-rec">🎤 ฝึกออกเสียง</button>' +
      '<button class="btn btn-outline-secondary g-skip">เก็บคำนี้ / ถัดไป →</button>' +
      '</div><div class="small mt-2 g-status text-muted"></div>';

    const canvas = inner.querySelector('canvas');
    const status = inner.querySelector('.g-status');
    inner.querySelector('.g-listen').addEventListener('click', function () {
      AudioKit.speak(word.reading ? word.reading.replace(/-/g, '') : word.word);
    });
    const btnRec = inner.querySelector('.g-rec');
    btnRec.addEventListener('click', async function () {
      if (!recording) {
        try {
          recorder = new AudioKit.Recorder();
          canvas.classList.remove('d-none');
          await recorder.start(canvas);
          recording = true;
          btnRec.classList.replace('btn-brand', 'btn-accent');
          btnRec.innerHTML = '<span class="rec-dot"></span> หยุด &amp; บันทึก';
          status.textContent = 'พูดคำว่า "' + word.word + '" ดัง ๆ นะ';
        } catch (e) { status.innerHTML = '<span class="text-danger">เข้าถึงไมค์ไม่ได้</span>'; }
      } else {
        recording = false;
        const blob = await recorder.stop();
        canvas.classList.add('d-none');
        btnRec.classList.replace('btn-accent', 'btn-brand');
        btnRec.innerHTML = '🎤 ฝึกอีกครั้ง';
        const user = window.SB ? await SB.getUser() : null;
        if (!user) { status.innerHTML = 'เยี่ยม! · <a href="login.html">เข้าสู่ระบบ</a> เพื่อบันทึกผล'; return; }
        status.textContent = 'กำลังบันทึก...';
        const res = await DataAccess.savePractice(word, blob);
        status.innerHTML = res.ok ? '<span class="text-success">✅ บันทึกแล้ว!</span>'
          : '<span class="text-danger">' + res.error + '</span>';
      }
    });
    inner.querySelector('.g-skip').addEventListener('click', function () {
      if (recording && recorder) { recorder.stop(); recording = false; }
      ov.classList.remove('show');
      activePopup = false;
      onDone();
    });

    ov.classList.add('show');
  }

  // ---------- ปุ่มทิศสัมผัส ----------
  function bindTouchButtons() {
    window._touchDir = { x: 0, y: 0 };
    const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    Object.keys(map).forEach(function (dir) {
      const btn = document.querySelector('[data-dir="' + dir + '"]');
      if (!btn) return;
      const set = function (on) { window._touchDir.x = on ? map[dir][0] : 0; window._touchDir.y = on ? map[dir][1] : 0; };
      ['mousedown', 'touchstart'].forEach(function (ev) { btn.addEventListener(ev, function (e) { e.preventDefault(); set(true); }); });
      ['mouseup', 'mouseleave', 'touchend'].forEach(function (ev) { btn.addEventListener(ev, function () { set(false); }); });
    });
  }

  // ---------- เริ่มเกม ----------
  document.addEventListener('DOMContentLoaded', async function () {
    if (window.SB && !SB.isConfigured) {
      const n = document.getElementById('config-note');
      if (n) n.classList.remove('d-none');
    }
    wordPool = await DataAccess.getRandomWords(totalItems + 4);

    const holder = document.getElementById('game-container');
    const width = Math.min(holder.clientWidth || 880, 880);
    const height = Math.round(width * 0.66);

    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-container',
      width: width,
      height: height,
      backgroundColor: '#8fd14f',
      physics: { default: 'arcade', arcade: { debug: false } },
      scene: [WorldScene],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY }
    });
  });
})();
