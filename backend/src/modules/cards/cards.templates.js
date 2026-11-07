/**
 * Student card templates — CR80 format: 85.6 × 54 mm
 * At 3× quality scale: W=969px  H=612px
 * All colours, logos and assets are injected via {{school.*}} variables
 * resolved from SchoolBranding at generation time.
 */
const W = 969;
const H = 612;

// Helper to create a verso with school info
const defaultVerso = (bg = '#f7fafc', border = '{{school.primary_color}}') => `
<div style="width:${W}px;height:${H}px;background:${bg};border:3px solid ${border};border-radius:24px;font-family:{{school.font}};padding:36px 40px;position:relative;overflow:hidden;">
  ${border !== 'none' ? '' : ''}
  <!-- Watermark -->
  <img src="{{school.watermark}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.05;pointer-events:none;" onerror="this.style.display='none'">
  <div style="position:relative;z-index:1;">
    <div style="font-size:20px;font-weight:700;color:{{school.primary_color}};margin-bottom:18px;">Informations & Règlement</div>
    <div style="font-size:14px;color:#4a5568;line-height:1.9;">
      <div>✦ Cette carte est strictement personnelle et non cessible.</div>
      <div>✦ Elle doit être présentée sur demande dans l'enceinte universitaire.</div>
      <div>✦ En cas de perte, signaler immédiatement au secrétariat.</div>
      <div>✦ Validité : Année universitaire {{academicYear}} uniquement.</div>
    </div>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #cbd5e0;font-size:13px;color:#718096;">
      <div><b>{{school.name}}</b> — {{school.address}}</div>
      <div>{{school.phone}} · {{school.email}}</div>
    </div>
  </div>
  <div style="position:absolute;bottom:28px;right:36px;display:flex;flex-direction:column;align-items:center;gap:6px;">
    <img src="{{school.stamp}}" style="height:64px;width:64px;object-fit:contain;" onerror="this.style.display='none'">
    <img src="{{school.signature}}" style="height:40px;" onerror="this.style.display='none'">
  </div>
</div>`;

export const CARD_TEMPLATES = [

  // ── 1. Classic University ──────────────────────────────────────────────────
  {
    id: 'classic-university',
    name: 'Classic University',
    thumbnail: '#1a365d',
    style: 'classic',
    recto: `
<div style="width:${W}px;height:${H}px;background:#fff;border:3px solid {{school.primary_color}};border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;" onerror="this.style.display='none'">
  <div style="position:relative;z-index:1;">
    <div style="background:{{school.primary_color}};height:160px;display:flex;align-items:center;padding:0 36px;gap:24px;">
      <img src="{{school.logo}}" style="height:100px;width:100px;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
      <div style="color:#fff;">
        <div style="font-size:26px;font-weight:700;letter-spacing:1px;">{{school.name}}</div>
        <div style="font-size:14px;opacity:.8;margin-top:4px;">Direction des Affaires Académiques</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:28px;padding:22px 36px;">
      <img src="{{student.photo}}" style="width:130px;height:160px;object-fit:cover;border:3px solid {{school.primary_color}};border-radius:8px;" onerror="this.style.background:#e2e8f0;this.style.display='block'">
      <div>
        <div style="font-size:12px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Carte d'étudiant</div>
        <div style="font-size:26px;font-weight:700;color:{{school.primary_color}};margin-top:6px;line-height:1.2;">{{student.fullName}}</div>
        <div style="font-size:16px;color:#2d3748;margin-top:6px;">{{student.mention}} — {{student.level}}</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:3px;">
          <div style="font-size:14px;color:#4a5568;"><b>Matricule :</b> <span style="color:{{school.primary_color}};font-weight:700;font-family:monospace;">{{student.matricule}}</span></div>
          <div style="font-size:14px;color:#4a5568;"><b>Année :</b> {{academicYear}}</div>
        </div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:18px;right:24px;z-index:2;">
    <img src="{{student.qrCode}}" style="width:88px;height:88px;" onerror="this.style.display='none'">
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:10px;background:{{school.primary_color}};z-index:2;"></div>
</div>`,
    verso: defaultVerso('#f7fafc', '{{school.primary_color}}'),
  },

  // ── 2. Modern University ───────────────────────────────────────────────────
  {
    id: 'modern-university',
    name: 'Modern University',
    thumbnail: 'linear-gradient(135deg,#0ea5e9,#2563eb)',
    style: 'modern',
    recto: `
<div style="width:${W}px;height:${H}px;background:linear-gradient(135deg,{{school.primary_color}} 0%,{{school.secondary_color}} 100%);border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.1;" onerror="this.style.display='none'">
  <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:rgba(255,255,255,.1);border-radius:50%;"></div>
  <div style="position:absolute;bottom:-60px;left:-30px;width:220px;height:220px;background:rgba(255,255,255,.07);border-radius:50%;"></div>
  <div style="position:relative;z-index:1;padding:30px 36px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
      <img src="{{school.logo}}" style="height:50px;width:50px;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
      <div style="color:rgba(255,255,255,.9);font-size:15px;font-weight:700;letter-spacing:.5px;">{{school.name}}</div>
    </div>
    <div style="display:flex;gap:24px;align-items:flex-start;">
      <img src="{{student.photo}}" style="width:120px;height:150px;object-fit:cover;border-radius:12px;border:3px solid rgba(255,255,255,.4);" onerror="this.style.background:rgba(255,255,255,.2);this.style.display='block'">
      <div style="color:#fff;flex:1;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;opacity:.7;margin-bottom:6px;">ÉTUDIANT(E)</div>
        <div style="font-size:24px;font-weight:800;line-height:1.2;margin-bottom:8px;">{{student.fullName}}</div>
        <div style="font-size:14px;opacity:.85;margin-bottom:14px;">{{student.mention}} · {{student.level}}</div>
        <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;backdrop-filter:blur(4px);">
          <div style="font-size:11px;opacity:.7;margin-bottom:2px;">MATRICULE</div>
          <div style="font-size:18px;font-weight:700;font-family:monospace;letter-spacing:1px;">{{student.matricule}}</div>
        </div>
        <div style="font-size:12px;opacity:.6;margin-top:8px;">{{academicYear}}</div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:18px;right:24px;z-index:2;background:white;padding:4px;border-radius:6px;">
    <img src="{{student.qrCode}}" style="width:72px;height:72px;" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('{{school.primary_color}}', 'none'),
  },

  // ── 3. Glass Premium ──────────────────────────────────────────────────────
  {
    id: 'glass-premium',
    name: 'Glass Premium',
    thumbnail: 'linear-gradient(135deg,#667eea,#764ba2)',
    style: 'glass',
    recto: `
<div style="width:${W}px;height:${H}px;background:linear-gradient(135deg,{{school.primary_color}} 0%,{{school.accent_color}} 100%);border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.15;" onerror="this.style.display='none'">
  <div style="position:absolute;inset:0;background:rgba(255,255,255,.05);backdrop-filter:blur(1px);"></div>
  <div style="position:absolute;top:-50px;right:-50px;width:250px;height:250px;border-radius:50%;background:rgba(255,255,255,.12);"></div>
  <div style="position:absolute;bottom:-80px;left:-40px;width:280px;height:280px;border-radius:50%;background:rgba(0,0,0,.08);"></div>
  <div style="position:relative;z-index:2;padding:28px 32px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <img src="{{school.logo}}" style="height:44px;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
        <div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:4px;">{{school.name}}</div>
      </div>
      <div style="background:rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;backdrop-filter:blur(4px);">
        <div style="color:rgba(255,255,255,.7);font-size:9px;text-transform:uppercase;letter-spacing:1px;">Carte Étudiant</div>
      </div>
    </div>
    <div style="display:flex;gap:22px;align-items:center;">
      <img src="{{student.photo}}" style="width:110px;height:140px;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.5);flex-shrink:0;" onerror="this.style.background:rgba(255,255,255,.2);this.style.display='block'">
      <div style="color:#fff;">
        <div style="font-size:22px;font-weight:800;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,.2);">{{student.fullName}}</div>
        <div style="font-size:13px;opacity:.8;margin-top:6px;">{{student.mention}} — {{student.level}}</div>
        <div style="margin-top:14px;background:rgba(255,255,255,.18);border-radius:10px;padding:10px 14px;backdrop-filter:blur(8px);">
          <div style="font-size:9px;opacity:.7;letter-spacing:1.5px;text-transform:uppercase;">Matricule</div>
          <div style="font-size:17px;font-weight:700;font-family:monospace;margin-top:2px;">{{student.matricule}}</div>
        </div>
        <div style="font-size:11px;opacity:.6;margin-top:8px;">{{academicYear}}</div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:16px;right:22px;z-index:3;background:white;padding:3px;border-radius:6px;">
    <img src="{{student.qrCode}}" style="width:68px;height:68px;" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('rgba(255,255,255,.05)', 'rgba(255,255,255,.3)'),
  },

  // ── 4. Corporate ──────────────────────────────────────────────────────────
  {
    id: 'corporate',
    name: 'Corporate',
    thumbnail: '#0f172a',
    style: 'corporate',
    recto: `
<div style="width:${W}px;height:${H}px;background:#fff;border-radius:24px;font-family:{{school.font}};display:flex;overflow:hidden;position:relative;">
  <!-- Left panel -->
  <div style="width:220px;background:{{school.primary_color}};display:flex;flex-direction:column;align-items:center;padding:28px 16px;flex-shrink:0;">
    <img src="{{school.logo}}" style="width:72px;height:72px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:16px;" onerror="this.style.display='none'">
    <div style="color:rgba(255,255,255,.8);font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:1px;line-height:1.5;">{{school.name}}</div>
    <div style="width:40px;height:2px;background:{{school.accent_color}};margin:16px 0;"></div>
    <img src="{{student.photo}}" style="width:100px;height:120px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,.3);" onerror="this.style.background:rgba(255,255,255,.2);this.style.display='block'">
    <div style="margin-top:14px;background:rgba(255,255,255,.12);border-radius:6px;padding:8px 12px;width:100%;text-align:center;">
      <div style="color:rgba(255,255,255,.6);font-size:9px;text-transform:uppercase;letter-spacing:1px;">Matricule</div>
      <div style="color:#fff;font-size:14px;font-weight:700;font-family:monospace;margin-top:2px;">{{student.matricule}}</div>
    </div>
  </div>
  <!-- Right content -->
  <div style="flex:1;padding:32px 28px;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
    <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.04;" onerror="this.style.display='none'">
    <div style="position:relative;z-index:1;">
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Carte d'Identité Étudiante</div>
      <div style="font-size:24px;font-weight:800;color:{{school.primary_color}};line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
      <div style="font-size:14px;color:#475569;margin-bottom:4px;">{{student.mention}}</div>
      <div style="display:inline-block;background:{{school.primary_color}};color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;margin-bottom:16px;">{{student.level}}</div>
      <div style="font-size:13px;color:#64748b;"><b>Année :</b> {{academicYear}}</div>
    </div>
    <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="width:40px;height:4px;background:{{school.accent_color}};border-radius:2px;"></div>
      <img src="{{student.qrCode}}" style="width:72px;height:72px;background:#fff;padding:2px;border-radius:4px;" onerror="this.style.display='none'">
    </div>
  </div>
</div>`,
    verso: defaultVerso('#f8fafc', '{{school.primary_color}}'),
  },

  // ── 5. Elegant ────────────────────────────────────────────────────────────
  {
    id: 'elegant',
    name: 'Elegant',
    thumbnail: '#f8f5f0',
    style: 'elegant',
    recto: `
<div style="width:${W}px;height:${H}px;background:#fdfcf9;border:2px solid {{school.accent_color}};border-radius:24px;font-family:'Georgia',serif;position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.05;" onerror="this.style.display='none'">
  <!-- Gold corner decoration -->
  <div style="position:absolute;top:0;left:0;right:0;height:8px;background:{{school.accent_color}};"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:{{school.accent_color}};"></div>
  <div style="position:relative;z-index:1;display:flex;height:100%;padding:24px 36px;gap:28px;align-items:center;">
    <!-- Left: photo + logo -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <img src="{{student.photo}}" style="width:120px;height:150px;object-fit:cover;border-radius:8px;border:2px solid {{school.accent_color}};" onerror="this.style.background:#e8e0d0;this.style.display='block'">
      <img src="{{school.logo}}" style="height:36px;object-fit:contain;" onerror="this.style.display='none'">
    </div>
    <!-- Right: info -->
    <div style="flex:1;">
      <div style="font-size:11px;color:{{school.accent_color}};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Carte d'Étudiant</div>
      <div style="font-size:11px;color:#8a7a6a;margin-bottom:12px;">{{school.name}}</div>
      <div style="font-size:26px;font-weight:700;color:{{school.primary_color}};line-height:1.2;margin-bottom:8px;">{{student.fullName}}</div>
      <div style="width:60px;height:2px;background:{{school.accent_color}};margin-bottom:12px;"></div>
      <div style="font-size:14px;color:#5a4a3a;margin-bottom:4px;font-style:italic;">{{student.mention}} — {{student.level}}</div>
      <div style="display:flex;gap:20px;margin-top:14px;">
        <div>
          <div style="font-size:9px;color:#8a7a6a;text-transform:uppercase;letter-spacing:1px;">Matricule</div>
          <div style="font-size:16px;font-weight:700;color:{{school.primary_color}};font-family:monospace;">{{student.matricule}}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#8a7a6a;text-transform:uppercase;letter-spacing:1px;">Année</div>
          <div style="font-size:13px;color:#5a4a3a;">{{academicYear}}</div>
        </div>
      </div>
    </div>
    <!-- QR -->
    <img src="{{student.qrCode}}" style="width:76px;height:76px;align-self:flex-end;" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('#fdfcf9', '{{school.accent_color}}'),
  },

  // ── 6. Dark Premium ───────────────────────────────────────────────────────
  {
    id: 'dark-premium',
    name: 'Dark Premium',
    thumbnail: '#0a0f1e',
    style: 'dark',
    recto: `
<div style="width:${W}px;height:${H}px;background:#0a0f1e;border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.08;" onerror="this.style.display='none'">
  <!-- Glow -->
  <div style="position:absolute;top:-80px;left:-80px;width:300px;height:300px;background:{{school.primary_color}};border-radius:50%;opacity:.2;filter:blur(60px);"></div>
  <div style="position:absolute;bottom:-60px;right:-60px;width:240px;height:240px;background:{{school.accent_color}};border-radius:50%;opacity:.15;filter:blur(50px);"></div>
  <div style="position:relative;z-index:2;padding:28px 32px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="{{school.logo}}" style="height:40px;object-fit:contain;" onerror="this.style.display:'none'">
        <div>
          <div style="color:rgba(255,255,255,.9);font-size:13px;font-weight:700;">{{school.name}}</div>
          <div style="color:rgba(255,255,255,.4);font-size:10px;">Carte d'Étudiant</div>
        </div>
      </div>
      <div style="background:{{school.accent_color}};border-radius:999px;padding:4px 12px;font-size:10px;font-weight:700;color:#0a0f1e;">{{student.level}}</div>
    </div>
    <div style="display:flex;gap:24px;align-items:flex-start;">
      <img src="{{student.photo}}" style="width:110px;height:140px;object-fit:cover;border-radius:12px;border:1px solid rgba(255,255,255,.15);flex-shrink:0;" onerror="this.style.background:rgba(255,255,255,.1);this.style.display='block'">
      <div>
        <div style="font-size:24px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:16px;">{{student.mention}}</div>
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 16px;">
          <div style="font-size:9px;color:{{school.accent_color}};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Matricule</div>
          <div style="font-size:18px;font-weight:700;font-family:monospace;color:#fff;">{{student.matricule}}</div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:10px;">{{academicYear}}</div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:18px;right:24px;z-index:3;background:rgba(255,255,255,.08);padding:4px;border-radius:8px;border:1px solid rgba(255,255,255,.12);">
    <img src="{{student.qrCode}}" style="width:68px;height:68px;filter:invert(1);" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('#111827', '#333'),
  },

  // ── 7. Luxury Gold ────────────────────────────────────────────────────────
  {
    id: 'luxury-gold',
    name: 'Luxury Gold',
    thumbnail: 'linear-gradient(135deg,#1a0a00,#4a2800)',
    style: 'luxury',
    recto: `
<div style="width:${W}px;height:${H}px;background:linear-gradient(135deg,#1a0a00 0%,#3d1f00 50%,#1a0a00 100%);border-radius:24px;border:1px solid {{school.accent_color}};font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;" onerror="this.style.display='none'">
  <!-- Gold trim lines -->
  <div style="position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:1px solid rgba(212,175,55,.3);border-radius:16px;pointer-events:none;"></div>
  <!-- Corner ornaments -->
  <div style="position:absolute;top:18px;left:18px;width:28px;height:28px;border-top:2px solid {{school.accent_color}};border-left:2px solid {{school.accent_color}};border-radius:2px 0 0 0;"></div>
  <div style="position:absolute;top:18px;right:18px;width:28px;height:28px;border-top:2px solid {{school.accent_color}};border-right:2px solid {{school.accent_color}};border-radius:0 2px 0 0;"></div>
  <div style="position:absolute;bottom:18px;left:18px;width:28px;height:28px;border-bottom:2px solid {{school.accent_color}};border-left:2px solid {{school.accent_color}};border-radius:0 0 0 2px;"></div>
  <div style="position:absolute;bottom:18px;right:18px;width:28px;height:28px;border-bottom:2px solid {{school.accent_color}};border-right:2px solid {{school.accent_color}};border-radius:0 0 2px 0;"></div>
  <div style="position:relative;z-index:2;padding:32px 40px;display:flex;gap:28px;align-items:center;height:100%;">
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
      <img src="{{school.logo}}" style="width:64px;height:64px;object-fit:contain;filter:sepia(1) saturate(2) hue-rotate(5deg);" onerror="this.style.display:'none'">
      <img src="{{student.photo}}" style="width:100px;height:126px;object-fit:cover;border-radius:6px;border:2px solid {{school.accent_color}};" onerror="this.style.background:#3d1f00;this.style.display='block'">
    </div>
    <div style="flex:1;">
      <div style="color:{{school.accent_color}};font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Carte d'Étudiant</div>
      <div style="color:rgba(212,175,55,.7);font-size:11px;margin-bottom:4px;">{{school.name}}</div>
      <div style="font-size:24px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
      <div style="height:1px;background:linear-gradient(to right,{{school.accent_color}},transparent);margin-bottom:12px;"></div>
      <div style="font-size:13px;color:rgba(255,255,255,.65);margin-bottom:4px;font-style:italic;">{{student.mention}} · {{student.level}}</div>
      <div style="margin-top:12px;display:flex;gap:24px;">
        <div>
          <div style="font-size:9px;color:{{school.accent_color}};letter-spacing:1px;text-transform:uppercase;">Matricule</div>
          <div style="font-size:17px;font-weight:700;color:{{school.accent_color}};font-family:monospace;margin-top:2px;">{{student.matricule}}</div>
        </div>
        <div>
          <div style="font-size:9px;color:{{school.accent_color}};letter-spacing:1px;text-transform:uppercase;">Année</div>
          <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:2px;">{{academicYear}}</div>
        </div>
      </div>
    </div>
    <img src="{{student.qrCode}}" style="width:68px;height:68px;align-self:flex-end;filter:sepia(1) saturate(3);" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('#1a0a00', '{{school.accent_color}}'),
  },

  // ── 8. Vertical ───────────────────────────────────────────────────────────
  {
    id: 'vertical',
    name: 'Vertical',
    thumbnail: 'linear-gradient(180deg,#1e40af,#7c3aed)',
    style: 'vertical',
    recto: `
<div style="width:${W}px;height:${H}px;background:#fff;border-radius:24px;font-family:{{school.font}};display:flex;overflow:hidden;position:relative;">
  <!-- Vertical accent band left (40px) -->
  <div style="width:40px;background:{{school.primary_color}};flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:20px 0;gap:16px;">
    <img src="{{school.icon}}" style="width:24px;height:24px;object-fit:contain;filter:brightness(0) invert(1);" onerror="this.style.display:'none'">
    <div style="writing-mode:vertical-rl;transform:rotate(180deg);color:rgba(255,255,255,.7);font-size:8px;letter-spacing:2px;text-transform:uppercase;flex:1;">{{school.name}}</div>
  </div>
  <!-- Main content -->
  <div style="flex:1;padding:26px 24px;display:flex;flex-direction:column;justify-content:space-between;position:relative;">
    <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.04;" onerror="this.style.display='none'">
    <div style="position:relative;z-index:1;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
        <img src="{{school.logo}}" style="height:44px;object-fit:contain;" onerror="this.style.display:'none'">
        <div style="background:{{school.primary_color}};color:#fff;font-size:9px;font-weight:700;padding:3px 10px;border-radius:999px;letter-spacing:1px;text-transform:uppercase;">ÉTUDIANT</div>
      </div>
      <div style="display:flex;gap:18px;align-items:flex-start;">
        <img src="{{student.photo}}" style="width:100px;height:128px;object-fit:cover;border-radius:10px;border:2px solid {{school.primary_color}};flex-shrink:0;" onerror="this.style.background:#e2e8f0;this.style.display='block'">
        <div>
          <div style="font-size:20px;font-weight:800;color:{{school.primary_color}};line-height:1.2;margin-bottom:4px;">{{student.fullName}}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:12px;">{{student.mention}} · {{student.level}}</div>
          <div style="font-size:9px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Matricule</div>
          <div style="font-size:16px;font-weight:700;color:{{school.primary_color}};font-family:monospace;">{{student.matricule}}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:8px;">{{academicYear}}</div>
        </div>
      </div>
    </div>
    <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="height:3px;width:60px;background:linear-gradient(to right,{{school.primary_color}},{{school.accent_color}});border-radius:2px;"></div>
      <img src="{{student.qrCode}}" style="width:64px;height:64px;" onerror="this.style.display='none'">
    </div>
  </div>
</div>`,
    verso: defaultVerso('#f8fafc', '{{school.primary_color}}'),
  },

  // ── 9. Horizontal Minimal ─────────────────────────────────────────────────
  {
    id: 'horizontal',
    name: 'Horizontal',
    thumbnail: '#f1f5f9',
    style: 'horizontal',
    recto: `
<div style="width:${W}px;height:${H}px;background:#f8fafc;border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;border:1px solid #e2e8f0;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.06;" onerror="this.style.display='none'">
  <!-- Top header bar -->
  <div style="background:{{school.primary_color}};height:12px;"></div>
  <div style="position:relative;z-index:1;display:flex;gap:0;align-items:stretch;height:calc(100% - 24px);">
    <!-- Photo section -->
    <div style="width:200px;display:flex;align-items:center;justify-content:center;padding:20px;flex-shrink:0;">
      <img src="{{student.photo}}" style="width:140px;height:168px;object-fit:cover;border-radius:12px;border:3px solid {{school.primary_color}};" onerror="this.style.background:#e2e8f0;this.style.display='block'">
    </div>
    <!-- Divider -->
    <div style="width:1px;background:#e2e8f0;margin:16px 0;"></div>
    <!-- Info section -->
    <div style="flex:1;padding:24px 28px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <img src="{{school.logo}}" style="height:32px;object-fit:contain;" onerror="this.style.display:'none'">
          <div style="font-size:12px;color:#64748b;font-weight:600;">{{school.name}}</div>
        </div>
        <div style="font-size:11px;color:{{school.primary_color}};text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:6px;">Carte d'Étudiant</div>
        <div style="font-size:26px;font-weight:800;color:#0f172a;line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
        <div style="font-size:14px;color:#475569;margin-bottom:14px;">{{student.mention}} · {{student.level}}</div>
        <div style="display:flex;gap:20px;">
          <div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Matricule</div><div style="font-size:16px;font-weight:700;color:{{school.primary_color}};font-family:monospace;">{{student.matricule}}</div></div>
          <div><div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Année</div><div style="font-size:14px;color:#475569;">{{academicYear}}</div></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <img src="{{student.qrCode}}" style="width:68px;height:68px;" onerror="this.style.display='none'">
      </div>
    </div>
  </div>
  <div style="background:{{school.primary_color}};height:12px;position:absolute;bottom:0;left:0;right:0;"></div>
</div>`,
    verso: defaultVerso('#f8fafc', '{{school.primary_color}}'),
  },

  // ── 10. Smart Campus ──────────────────────────────────────────────────────
  {
    id: 'smart-campus',
    name: 'Smart Campus',
    thumbnail: 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
    style: 'smart',
    recto: `
<div style="width:${W}px;height:${H}px;background:#0c1222;border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.1;" onerror="this.style.display='none'">
  <!-- Grid lines (tech feel) -->
  <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.04;" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-width=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
  <!-- Accent stripe -->
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(to right,{{school.primary_color}},{{school.accent_color}},{{school.primary_color}});"></div>
  <div style="position:relative;z-index:2;padding:28px 32px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="{{school.logo}}" style="height:36px;object-fit:contain;" onerror="this.style.display:'none'">
        <div>
          <div style="color:rgba(255,255,255,.9);font-size:12px;font-weight:700;">{{school.name}}</div>
          <div style="color:{{school.primary_color}};font-size:9px;text-transform:uppercase;letter-spacing:1.5px;">Smart Campus ID</div>
        </div>
      </div>
      <div style="border:1px solid {{school.primary_color}};border-radius:6px;padding:4px 10px;color:{{school.primary_color}};font-size:10px;font-weight:700;">{{student.level}}</div>
    </div>
    <div style="display:flex;gap:22px;align-items:flex-start;">
      <div style="position:relative;">
        <img src="{{student.photo}}" style="width:110px;height:138px;object-fit:cover;border-radius:10px;border:2px solid {{school.primary_color}};" onerror="this.style.background:#1e293b;this.style.display='block'">
        <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:{{school.primary_color}};color:#fff;font-size:8px;padding:2px 8px;border-radius:999px;white-space:nowrap;font-weight:700;">ÉTUDIANT</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:16px;">{{student.mention}}</div>
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 16px;">
          <div style="display:flex;gap:20px;">
            <div>
              <div style="font-size:8px;color:{{school.primary_color}};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;">Matricule</div>
              <div style="font-size:17px;font-weight:700;font-family:monospace;color:#fff;">{{student.matricule}}</div>
            </div>
            <div>
              <div style="font-size:8px;color:{{school.primary_color}};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;">Année</div>
              <div style="font-size:13px;color:rgba(255,255,255,.7);">{{academicYear}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:18px;right:24px;z-index:3;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:4px;border-radius:8px;">
    <img src="{{student.qrCode}}" style="width:68px;height:68px;filter:invert(1);" onerror="this.style.display='none'">
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(to right,{{school.primary_color}},{{school.accent_color}},{{school.primary_color}});"></div>
</div>`,
    verso: defaultVerso('#0c1222', 'rgba(255,255,255,.15)'),
  },

  // ── 11. Material Design ───────────────────────────────────────────────────
  {
    id: 'material-design',
    name: 'Material Design',
    thumbnail: 'linear-gradient(135deg,#1976d2,#42a5f5)',
    style: 'material',
    recto: `
<div style="width:${W}px;height:${H}px;background:#fff;border-radius:16px;font-family:{{school.font}};position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12);">
  <!-- Top hero band -->
  <div style="background:{{school.primary_color}};height:${H * 0.55}px;position:relative;overflow:hidden;">
    <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.15;" onerror="this.style.display='none'">
    <div style="position:absolute;bottom:-30px;right:-30px;width:160px;height:160px;background:rgba(255,255,255,.1);border-radius:50%;"></div>
    <div style="position:relative;z-index:1;padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <img src="{{school.logo}}" style="height:36px;object-fit:contain;filter:brightness(0) invert(1);margin-bottom:6px;" onerror="this.style.display:'none'">
          <div style="color:rgba(255,255,255,.85);font-size:11px;font-weight:600;">{{school.name}}</div>
        </div>
        <img src="{{student.photo}}" style="width:80px;height:100px;object-fit:cover;border-radius:8px;border:3px solid rgba(255,255,255,.5);" onerror="this.style.background:rgba(255,255,255,.2);this.style.display='block'">
      </div>
      <div style="margin-top:10px;">
        <div style="color:rgba(255,255,255,.65);font-size:9px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">Étudiant(e)</div>
        <div style="color:#fff;font-size:20px;font-weight:700;line-height:1.2;">{{student.fullName}}</div>
      </div>
    </div>
  </div>
  <!-- White card bottom -->
  <div style="padding:16px 24px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:11px;color:#9e9e9e;">{{student.mention}} · {{student.level}}</div>
      <div style="margin-top:6px;display:flex;gap:16px;">
        <div><div style="font-size:8px;color:#9e9e9e;text-transform:uppercase;letter-spacing:1px;">Matricule</div><div style="font-size:16px;font-weight:700;color:{{school.primary_color}};font-family:monospace;">{{student.matricule}}</div></div>
        <div><div style="font-size:8px;color:#9e9e9e;text-transform:uppercase;letter-spacing:1px;">Année</div><div style="font-size:13px;color:#424242;margin-top:2px;">{{academicYear}}</div></div>
      </div>
    </div>
    <img src="{{student.qrCode}}" style="width:68px;height:68px;" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('#fff', '{{school.primary_color}}'),
  },

  // ── 12. Flat Design ───────────────────────────────────────────────────────
  {
    id: 'flat-design',
    name: 'Flat Design',
    thumbnail: '#2ecc71',
    style: 'flat',
    recto: `
<div style="width:${W}px;height:${H}px;background:{{school.primary_color}};border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.07;" onerror="this.style.display='none'">
  <!-- Large circle accent -->
  <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;background:rgba(255,255,255,.07);border-radius:50%;"></div>
  <div style="position:relative;z-index:1;padding:30px 36px;display:flex;gap:28px;height:100%;align-items:center;">
    <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:14px;">
      <div style="width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.15);border:3px solid rgba(255,255,255,.5);overflow:hidden;">
        <img src="{{student.photo}}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.background:rgba(255,255,255,.2)">
      </div>
      <img src="{{school.logo}}" style="height:32px;object-fit:contain;filter:brightness(0) invert(1);opacity:.85;" onerror="this.style.display:'none'">
    </div>
    <div style="flex:1;color:#fff;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-bottom:8px;">Carte d'Identité Étudiante</div>
      <div style="font-size:26px;font-weight:800;line-height:1.2;margin-bottom:6px;">{{student.fullName}}</div>
      <div style="font-size:14px;opacity:.75;margin-bottom:20px;">{{student.mention}} · {{student.level}}</div>
      <div style="background:rgba(255,255,255,.12);border-radius:12px;padding:14px 18px;display:inline-block;">
        <div style="font-size:9px;opacity:.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Matricule</div>
        <div style="font-size:20px;font-weight:700;font-family:monospace;">{{student.matricule}}</div>
        <div style="font-size:11px;opacity:.6;margin-top:6px;">{{academicYear}} · {{school.name}}</div>
      </div>
    </div>
    <img src="{{student.qrCode}}" style="width:72px;height:72px;align-self:flex-end;background:rgba(255,255,255,.9);padding:3px;border-radius:6px;" onerror="this.style.display='none'">
  </div>
</div>`,
    verso: defaultVerso('{{school.primary_color}}', 'rgba(255,255,255,.3)'),
  },

  // ── 13. Futuristic ────────────────────────────────────────────────────────
  {
    id: 'futuristic',
    name: 'Futuristic',
    thumbnail: 'linear-gradient(135deg,#000428,#004e92)',
    style: 'futuristic',
    recto: `
<div style="width:${W}px;height:${H}px;background:linear-gradient(135deg,#000428 0%,#004e92 100%);border-radius:24px;font-family:{{school.font}};position:relative;overflow:hidden;border:1px solid rgba(0,200,255,.2);">
  <img src="{{school.background}}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.08;" onerror="this.style.display='none'">
  <!-- Hexagonal pattern -->
  <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.06;" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hex" width="28" height="48" patternUnits="userSpaceOnUse"><path d="M14 0 L28 8 L28 24 L14 32 L0 24 L0 8Z" fill="none" stroke="#00c8ff" stroke-width=".5"/><path d="M14 32 L28 40 L28 56 L14 64 L0 56 L0 40Z" fill="none" stroke="#00c8ff" stroke-width=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#hex)"/></svg>
  <!-- Top accent -->
  <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(to right,transparent,#00c8ff,{{school.accent_color}},#00c8ff,transparent);"></div>
  <div style="position:relative;z-index:2;padding:24px 30px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;border:1px solid rgba(0,200,255,.4);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <img src="{{school.logo}}" style="width:26px;height:26px;object-fit:contain;filter:hue-rotate(180deg) brightness(2);" onerror="this.style.display='none'">
        </div>
        <div>
          <div style="color:rgba(255,255,255,.9);font-size:11px;font-weight:700;letter-spacing:.5px;">{{school.name}}</div>
          <div style="color:#00c8ff;font-size:8px;text-transform:uppercase;letter-spacing:2px;">Smart ID</div>
        </div>
      </div>
      <div style="border:1px solid rgba(0,200,255,.3);border-radius:4px;padding:3px 10px;color:#00c8ff;font-size:9px;font-weight:700;letter-spacing:1px;">{{student.level}}</div>
    </div>
    <div style="display:flex;gap:20px;align-items:flex-start;">
      <div style="position:relative;flex-shrink:0;">
        <div style="position:absolute;inset:-3px;background:linear-gradient(135deg,#00c8ff,{{school.accent_color}});border-radius:13px;"></div>
        <img src="{{student.photo}}" style="position:relative;width:108px;height:136px;object-fit:cover;border-radius:12px;border:2px solid #000428;display:block;" onerror="this.style.background:#0a1628;this.style.display='block'">
      </div>
      <div style="flex:1;">
        <div style="font-size:21px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:5px;text-shadow:0 0 20px rgba(0,200,255,.3);">{{student.fullName}}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:16px;">{{student.mention}}</div>
        <div style="background:rgba(0,200,255,.05);border:1px solid rgba(0,200,255,.15);border-radius:10px;padding:10px 14px;">
          <div style="font-size:8px;color:#00c8ff;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Identifiant</div>
          <div style="font-size:18px;font-weight:700;font-family:monospace;color:#fff;letter-spacing:1px;">{{student.matricule}}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:4px;">{{academicYear}}</div>
        </div>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:16px;right:20px;z-index:3;background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);padding:4px;border-radius:8px;">
    <img src="{{student.qrCode}}" style="width:66px;height:66px;filter:invert(1) hue-rotate(180deg);" onerror="this.style.display='none'">
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(to right,transparent,#00c8ff,{{school.accent_color}},#00c8ff,transparent);"></div>
</div>`,
    verso: defaultVerso('#000428', 'rgba(0,200,255,.3)'),
  },

];

export function getCardTemplate(id) {
  return CARD_TEMPLATES.find((t) => t.id === id) ?? null;
}
