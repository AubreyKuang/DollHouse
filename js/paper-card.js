// 把一期月报画成像素风纪念卡，保存成 PNG。
function drawHousePaperCard(text) {
  const W = 360, H = 540, S = 2;
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const ctx = c.getContext('2d'); ctx.scale(S, S);
  ctx.fillStyle = '#5a3b4c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff4e4'; ctx.fillRect(12, 12, W - 24, H - 24);
  ctx.fillStyle = '#e98aa6';
  for (let x = 12; x < W - 12; x += 8) { ctx.fillRect(x, 12, 4, 4); ctx.fillRect(x + 4, H - 16, 4, 4); }
  for (let y = 12; y < H - 12; y += 8) { ctx.fillRect(12, y + 4, 4, 4); ctx.fillRect(W - 16, y, 4, 4); }
  const sans = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  const [title, ...rest] = text.split('\n');
  ctx.fillStyle = '#5a3b4c'; ctx.textAlign = 'center';
  ctx.font = `700 28px ${sans}`; ctx.fillText('小屋月报', W / 2, 58);
  ctx.font = `13px ${sans}`; ctx.fillStyle = '#8a6a72'; ctx.fillText(title, W / 2, 80);
  ctx.fillStyle = '#5a3b4c'; ctx.fillRect(32, 90, W - 64, 3);
  ctx.textAlign = 'left';
  let y = 116;
  const wrap = (line, x, width, height, max) => {
    let row = '', rows = 0;
    for (const ch of line) {
      const hang = '，。、”）！？：；'.includes(ch);
      if (!hang && ctx.measureText(row + ch).width > width) { ctx.fillText(row, x, y); y += height; row = ch; if (++rows >= max) return; }
      else row += ch;
    }
    if (row) { ctx.fillText(row, x, y); y += height; }
  };
  for (const line of rest) {
    if (y > H - 60) break;
    const [label, body] = line.includes('　') ? line.split('　') : [null, line];
    if (label?.startsWith('【')) { ctx.fillStyle = '#c4455f'; ctx.font = `700 14px ${sans}`; wrap(label, 32, W - 64, 20, 1); continue; }
    if (label === '头条') { ctx.fillStyle = '#3d2733'; ctx.font = `700 17px ${sans}`; wrap(body, 32, W - 64, 24, 3); y += 4; continue; }
    if (label) { ctx.fillStyle = '#e98aa6'; ctx.fillRect(32, y - 9, 5, 5); ctx.fillStyle = '#8a4a5e'; ctx.font = `700 12px ${sans}`; ctx.fillText(label, 42, y - 3); y += 14; }
    ctx.fillStyle = '#4a3a40'; ctx.font = `12px ${sans}`; wrap(body, 32, W - 64, 17, 3); y += 4;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#a08890'; ctx.font = `11px ${sans}`;
  ctx.fillText('🏠 像素小屋', W / 2, H - 30);
  return c;
}
function saveHousePaperCard(text, name) {
  drawHousePaperCard(text).toBlob(blob => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}
