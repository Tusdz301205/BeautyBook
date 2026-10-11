import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadedMediaUrl } from './mediaUrl.js';
test('uploaded media resolves at API origin even when frontend runs on a different port', () => {
  assert.equal(uploadedMediaUrl('/api/v1/media/public/own-image', 'http://127.0.0.1:3014/api/v1'), 'http://127.0.0.1:3014/api/v1/media/public/own-image');
  assert.equal(uploadedMediaUrl('https://cdn.example.test/a.webp', 'http://127.0.0.1:3014/api/v1'), 'https://cdn.example.test/a.webp');
});
test('untrusted protocols and missing media never become image src', () => {
  for (const value of ['', null, 'javascript:alert(1)', 'file:///private.png']) assert.equal(uploadedMediaUrl(value, 'http://127.0.0.1:3014/api/v1'), '');
});
