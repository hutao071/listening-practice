export const JUMP_SECONDS = 3;

export function clampTime(time, duration) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return 0;
  return Math.min(duration, Math.max(0, time));
}

export function createReveals() {
  const visible = new Set();
  return (id, language) => {
    const key = JSON.stringify([id, language]);
    if (visible.delete(key)) return false;
    visible.add(key);
    return true;
  };
}

export function validateLibrary(lessons) {
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const uniqueIds = items => new Set(items.map(item => item.id)).size === items.length;
  const isSource = value => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (!Array.isArray(lessons) || !lessons.every(lesson =>
    lesson && ['id', 'title', 'type', 'translationSource'].every(key => hasText(lesson[key])) &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(lesson.exam) &&
    /^audio\/[a-z0-9-]+\.(mp3|wav)$/.test(lesson.audio) &&
    isSource(lesson.source) &&
    Array.isArray(lesson.paragraphs) && lesson.paragraphs.length > 0 &&
    lesson.paragraphs.every(segment => segment && ['id', 'en', 'zh'].every(key => hasText(segment[key]))) &&
    uniqueIds(lesson.paragraphs)
  ) || !uniqueIds(lessons)) {
    throw new Error('语料格式有误');
  }
  return lessons;
}
