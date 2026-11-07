import { clampTime, createReveals, JUMP_SECONDS, validateLibrary } from './practice.mjs';

const byId = id => document.getElementById(id);
const catalog = byId('catalog-list');
const catalogToggle = byId('catalog-toggle');
const welcome = byId('welcome');
const practice = byId('practice');
const title = byId('lesson-title');
const media = byId('media');
const play = byId('play');
const back = byId('back');
const forward = byId('forward');
const progress = byId('progress');
const status = byId('audio-status');
const retry = byId('audio-retry');
const audioLink = byId('audio-link');
const libraryRetry = byId('library-retry');
const paragraphs = byId('paragraphs');

let player;
let activeLesson;
let activeButton;
let failure = '';
let playNotice = '';
let waiting = false;

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
}

const number = index => String(index + 1).padStart(2, '0');

function showCatalog(open) {
  catalogToggle.setAttribute('aria-expanded', String(open));
  byId('catalog-body').hidden = !open;
}

catalogToggle.addEventListener('click', () =>
  showCatalog(catalogToggle.getAttribute('aria-expanded') === 'false'));

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function ready() {
  return player && !failure && player.readyState >= HTMLMediaElement.HAVE_METADATA &&
    Number.isFinite(player.duration) && player.duration > 0;
}

function updatePlayer() {
  const available = ready();
  const canPlay = Boolean(player && !failure);
  const playing = canPlay && !player.paused && !player.ended;
  play.disabled = !canPlay;
  progress.disabled = back.disabled = forward.disabled = !available;
  play.setAttribute('aria-label', playing ? '暂停' : '播放');
  byId('play-icon').textContent = playing ? 'Ⅱ' : '▶';
  progress.max = available ? player.duration : 0;
  progress.value = available ? player.currentTime : 0;
  byId('elapsed').textContent = formatTime(available ? player.currentTime : 0);
  byId('duration').textContent = available ? formatTime(player.duration) : '—:—';
  progress.setAttribute('aria-valuetext', `已播放 ${byId('elapsed').textContent}，总长 ${byId('duration').textContent}`);
  retry.hidden = !failure;
  audioLink.hidden = !failure && !playNotice;

  let message = '点击播放后加载音频。';
  if (failure) message = failure;
  else if (playNotice) message = playNotice;
  else if (playing) message = waiting || !available ? '正在缓冲…' : '正在播放';
  else if (available) {
    if (player.ended) message = '播放结束';
    else message = player.currentTime > 0 ? '已暂停' : '准备就绪';
  }
  if (status.textContent !== message) status.textContent = message;
}

function loadAudio() {
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
  failure = '';
  playNotice = '';
  waiting = false;
  const audio = node('audio');
  player = audio;
  audio.preload = 'metadata';
  for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'seeked']) {
    audio.addEventListener(event, () => { if (player === audio) updatePlayer(); });
  }
  audio.addEventListener('waiting', () => {
    if (player !== audio) return;
    waiting = true;
    updatePlayer();
  });
  audio.addEventListener('playing', () => {
    if (player !== audio) return;
    waiting = false;
    updatePlayer();
  });
  audio.addEventListener('error', () => {
    if (player !== audio) return;
    failure = '音频加载失败。请重试，或单独打开音频。';
    updatePlayer();
  });
  media.replaceChildren(audio);
  audio.src = new URL(activeLesson.audio, document.baseURI).href;
  audioLink.href = audio.src;
  updatePlayer();
}

function seek(time) {
  if (!ready()) return;
  player.currentTime = clampTime(time, player.duration);
  updatePlayer();
}

function jump(delta) {
  if (ready()) seek(player.currentTime + delta);
}

play.addEventListener('click', async () => {
  const audio = player;
  if (!audio || failure) return;
  if (!audio.paused && !audio.ended) {
    audio.pause();
    return;
  }
  if (ready() && (audio.ended || audio.currentTime >= audio.duration)) seek(0);
  playNotice = '';
  waiting = true;
  try {
    const started = audio.play();
    updatePlayer();
    await started;
  } catch (error) {
    if (player !== audio || error.name === 'AbortError' || failure) return;
    if (error.name === 'NotAllowedError') {
      playNotice = '浏览器拦截了播放。请再点一次播放，或单独打开音频。';
    } else {
      failure = '音频暂时无法播放。请重试，或单独打开音频。';
    }
    updatePlayer();
  }
});

retry.addEventListener('click', () => {
  loadAudio();
  status.tabIndex = -1;
  status.focus();
});
back.addEventListener('click', () => jump(-JUMP_SECONDS));
forward.addEventListener('click', () => jump(JUMP_SECONDS));
progress.addEventListener('input', () => seek(progress.valueAsNumber));

function direction(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return 0;
  if (event.key === 'ArrowLeft') return -1;
  if (event.key === 'ArrowRight') return 1;
  return 0;
}

progress.addEventListener('keydown', event => {
  const sign = direction(event);
  if (sign && ready()) {
    event.preventDefault();
    jump(sign * JUMP_SECONDS);
  }
});

document.addEventListener('keydown', event => {
  const sign = direction(event);
  if (event.defaultPrevented || !sign || !ready()) return;
  if (event.target instanceof HTMLElement &&
      (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="textbox"], [role="slider"]'))) return;
  event.preventDefault();
  jump(sign * JUMP_SECONDS);
});

function renderParagraphs(lesson) {
  const toggle = createReveals();
  const blocks = lesson.paragraphs.map((segment, index) => {
    const row = node('div', undefined, 'paragraph');
    const label = node('span', number(index), 'paragraph-number');
    const content = node('div', undefined, 'paragraph-text');
    for (const [key, short, name, lang] of [['en', 'EN', '英文', 'en'], ['zh', '中', '中文', 'zh-CN']]) {
      const button = node('button', undefined, 'reveal');
      button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      const header = node('span', undefined, 'reveal-label');
      const action = node('span', `点击查看${name}`);
      const text = node('span', undefined, 'reveal-text');
      text.id = `paragraph-${index}-${key}`;
      text.lang = lang;
      text.hidden = true;
      button.setAttribute('aria-controls', text.id);
      button.setAttribute('aria-label', `第 ${index + 1} 段，查看${name}`);
      header.append(node('b', short), action);
      button.append(header);
      button.addEventListener('click', () => {
        const open = toggle(segment.id, key);
        text.textContent = open ? segment[key] : '';
        text.hidden = !open;
        action.textContent = open ? `点击遮挡${name}` : `点击查看${name}`;
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', `第 ${index + 1} 段，${open ? '遮挡' : '查看'}${name}`);
      });
      // Keep revealed prose outside the button's accessible name and semantics.
      const pair = node('div', undefined, 'reveal-pair');
      pair.append(button, text);
      content.append(pair);
    }
    row.append(label, content);
    return row;
  });
  paragraphs.replaceChildren(...blocks);
}

function selectLesson(lesson, index, button) {
  activeButton?.removeAttribute('aria-current');
  activeButton = button;
  activeButton.setAttribute('aria-current', 'true');
  activeLesson = lesson;
  title.textContent = lesson.title;
  byId('lesson-number').textContent = `第 ${number(index)} 页`;
  byId('lesson-meta').textContent = `${lesson.exam.replace('-', ' / ')} · ${lesson.type}`;
  byId('source').href = lesson.source;
  byId('translation').textContent = `中文：${lesson.translationSource}`;
  renderParagraphs(lesson);
  loadAudio();
  welcome.hidden = true;
  practice.hidden = false;
  if (matchMedia('(max-width: 800px)').matches) showCatalog(false);
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

async function loadLibrary() {
  libraryRetry.hidden = true;
  const libraryStatus = byId('library-status');
  libraryStatus.textContent = '正在打开练习册…';
  try {
    const response = await fetch('/library.json');
    if (!response.ok) throw new Error('语料文件无法读取');
    const lessons = validateLibrary(await response.json());
    catalog.replaceChildren(...lessons.map((lesson, index) => {
      const item = node('li');
      const button = node('button', undefined, 'lesson-link');
      button.type = 'button';
      const description = node('span');
      description.append(node('strong', lesson.title), node('small', `${lesson.exam} · ${lesson.type}`));
      button.append(node('span', number(index), 'index'), description);
      button.addEventListener('click', () => selectLesson(lesson, index, button));
      item.append(button);
      return item;
    }));
    libraryStatus.textContent = lessons.length ? `四级真题 · 共 ${lessons.length} 篇` : '还没有可用的语料。请按使用说明添加本地材料。';
  } catch {
    libraryStatus.textContent = '目录加载失败。请重试。';
    libraryRetry.hidden = false;
  }
}

libraryRetry.addEventListener('click', loadLibrary);
loadLibrary();
