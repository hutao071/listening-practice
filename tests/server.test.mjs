import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createStaticServer } from '../server.mjs';

test('local server delivers the app and all three PCM WAV recordings', async t => {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /听一页/);

  const library = await (await fetch(base + '/library.json')).json();
  for (const id of ['jetblue', 'zoo-snake', 'electric-bikes']) {
    const audio = '/' + library.find(lesson => lesson.id === id).audio;
    const bytes = await readFile(new URL('../public' + audio, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt16LE(20), 1, 'Uncompressed PCM');

    const info = await fetch(base + audio, { method: 'HEAD' });
    assert.equal(info.headers.get('content-type'), 'audio/wav');
    assert.equal(info.headers.get('content-length'), String(bytes.length));
    assert.equal(info.headers.get('accept-ranges'), 'bytes');

    const partial = await fetch(base + audio, { headers: { Range: 'bytes=0-47' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), `bytes 0-47/${bytes.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 48));

    const invalid = await fetch(base + audio, { headers: { Range: `bytes=${bytes.length}-` } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), `bytes */${bytes.length}`);
  }
  const missing = await fetch(base + '/audio/missing.wav');
  assert.equal(missing.status, 404);
  const outside = await fetch(base + '/%2e%2e%2fserver.mjs');
  assert.equal(outside.status, 404);
});
