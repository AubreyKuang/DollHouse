// 一次只展示一期。复制与纪念卡使用同一期的内容。
let housePaperIndex = -1;
function currentHousePaper() { return paperIssue(G.paper[housePaperIndex]); }

const paperStoryTitle = (story, i) => story.label && (i === 0 ? '本月头条' : story.label);

function showHousePaper() {
  const dialog = document.getElementById('paperDialog');
  renderHousePaper(G.paper.length - 1);
  if (!dialog.open) dialog.showModal();
}

function renderHousePaper(index) {
  housePaperIndex = Math.max(-1, Math.min(index, G.paper.length - 1));
  const issue = currentHousePaper();
  const target = document.getElementById('paperText');
  document.getElementById('paperMonth').textContent = issue?.month || monthLabel(G.day);
  document.getElementById('paperOlder').disabled = housePaperIndex <= 0;
  document.getElementById('paperNewer').disabled = housePaperIndex >= G.paper.length - 1;
  document.getElementById('paperCopy').disabled = !issue;
  document.getElementById('paperCopy').textContent = '复制本期';
  document.getElementById('paperCard').disabled = !issue;
  if (!issue) { target.textContent = '本期月报会在下月 00:00 出炉。'; return; }

  target.replaceChildren(...issue.stories.map((story, index) => {
    const article = document.createElement('article');
    article.className = index === 0 ? 'paper-story paper-lead' : 'paper-story';
    const people = document.createElement('div');
    people.className = 'paper-cast';
    if (story.people?.length) {
      for (const person of story.people) {
        const portrait = document.createElement('canvas');
        portrait.width = 20; portrait.height = 24;
        portrait.setAttribute('role', 'img');
        portrait.setAttribute('aria-label', person.name);
        portrait.title = person.name;
        dollPortrait(portrait, person.look);
        people.append(portrait);
      }
    } else {
      people.textContent = story.icon;
      people.setAttribute('aria-hidden', 'true');
    }
    const body = document.createElement('div');
    const title = document.createElement('small');
    title.textContent = paperStoryTitle(story, index);
    const text = document.createElement(index === 0 ? 'h3' : 'p');
    text.textContent = story.text;
    if (title.textContent) body.append(title);
    body.append(text);
    article.append(people, body);
    return article;
  }));
}

function housePaperText(issue) {
  return [issue.month, ...issue.stories.map((story, i) =>
    [paperStoryTitle(story, i), story.text].filter(Boolean).join(' · '))].join('\n');
}

function drawHousePaperCard(issue) {
  const W = 360, H = 140 + issue.stories.length * 98, S = 2;
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const ctx = c.getContext('2d'); ctx.scale(S, S); ctx.imageSmoothingEnabled = false;
  const sans = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  ctx.fillStyle = '#583c4b'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff4e4'; ctx.fillRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#ce718e';
  for (let x = 12; x < W - 12; x += 8) { ctx.fillRect(x, 10, 4, 3); ctx.fillRect(x, H - 13, 4, 3); }
  ctx.fillStyle = '#583c4b'; ctx.textAlign = 'center';
  ctx.font = `700 28px ${sans}`; ctx.fillText('小屋月报', W / 2, 53);
  ctx.font = `14px ${sans}`; ctx.fillText(issue.month, W / 2, 76);
  ctx.textAlign = 'left';
  issue.stories.forEach((story, i) => {
    const y = 94 + i * 98;
    ctx.fillStyle = i ? '#f5e4d6' : '#f6dbe3'; ctx.fillRect(24, y, W - 48, 86);
    const people = story.people || [];
    if (people.length) {
      const size = people.length === 3 ? 23 : 30;
      for (const [index, person] of people.entries()) {
        const portrait = document.createElement('canvas');
        portrait.width = 20; portrait.height = 24;
        dollPortrait(portrait, person.look);
        ctx.drawImage(portrait, 30 + index * (size - 2), y + 28, size, size * 1.2);
      }
    } else {
      ctx.font = `27px ${sans}`; ctx.fillText(story.icon, 48, y + 51);
    }
    const left = 104;
    ctx.fillStyle = '#8a3d59'; ctx.font = `700 12px ${sans}`;
    ctx.fillText(paperStoryTitle(story, i), left, y + 19);
    ctx.fillStyle = '#3d2733'; ctx.font = `${i === 0 ? '700 16px' : '14px'} ${sans}`;
    let row = '', line = 0;
    for (const char of story.text) {
      if (ctx.measureText(row + char).width > 214) {
        if (line === 2) { ctx.fillText(row.slice(0, -1) + '…', left, y + 39 + line * 18); return; }
        ctx.fillText(row, left, y + 39 + line++ * 18); row = '';
      }
      row += char;
    }
    ctx.fillText(row, left, y + 39 + line * 18);
  });
  return c;
}

function saveHousePaperCard(issue) {
  drawHousePaperCard(issue).toBlob(blob => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `小屋月报-${issue.month}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}
