import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { clampTime, createReveals, JUMP_SECONDS, validateLibrary } from '../public/practice.mjs';

test('three-second seek clamps at both edges and requires a finite duration', () => {
  assert.equal(JUMP_SECONDS, 3);
  assert.equal(clampTime(7 + JUMP_SECONDS, 30), 10);
  assert.equal(clampTime(2 - JUMP_SECONDS, 30), 0);
  assert.equal(clampTime(29 + JUMP_SECONDS, 30.5), 30.5);
  assert.equal(clampTime(3, NaN), 0);
});

test('paragraphs and languages toggle independently and a fresh lesson starts hidden', () => {
  const toggle = createReveals();
  assert.equal(toggle('01', 'en'), true);
  assert.equal(toggle('01', 'zh'), true);
  assert.equal(toggle('02', 'en'), true);
  assert.equal(toggle('01', 'en'), false);
  assert.equal(toggle('01', 'zh'), false);
  assert.equal(createReveals()('02', 'en'), true);
});

const lesson = {
  id: 'example', title: '测试', exam: '2024-06', type: '短篇新闻',
  source: 'https://example.com/', translationSource: '自行补译',
  audio: 'audio/example.mp3',
  paragraphs: [{ id: '01', en: 'Example.', zh: '示例。' }],
};

test('library rejects duplicate IDs, incomplete paragraphs and paths outside the audio folder', () => {
  assert.deepEqual(validateLibrary([lesson]), [lesson]);
  assert.throws(() => validateLibrary([lesson, lesson]));
  assert.throws(() => validateLibrary([{ ...lesson, audio: '../example.mp3' }]));
  assert.throws(() => validateLibrary([{ ...lesson, paragraphs: [{ id: '01', en: 'Example.' }] }]));
  assert.throws(() => validateLibrary([{ ...lesson, source: 'javascript:alert(1)' }]));
});

test('the delivered library is valid and every listed recording exists', async () => {
  const directory = new URL('../public/', import.meta.url);
  const data = JSON.parse(await readFile(new URL('library.json', directory), 'utf8'));
  validateLibrary(data);
  for (const id of ['jetblue', 'zoo-snake', 'electric-bikes']) {
    assert.ok(data.some(item => item.id === id), `Missing starter lesson: ${id}`);
  }
  for (const item of data) {
    assert.ok((await stat(new URL(item.audio, directory))).size > 0, item.audio);
  }
});
