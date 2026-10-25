import test from 'node:test';
import assert from 'node:assert/strict';
import { fileUriToPath, isAbsolutePath, extractDroppedPaths, findSkillRoots } from '../codex-ui/src/lib/skills-drop.mjs';

test('file:// URI 转本地路径（Windows / POSIX / 中文与空格）', () => {
  assert.equal(fileUriToPath('file:///D:/skills/my-skill'), 'D:\\skills\\my-skill');
  assert.equal(fileUriToPath('file:///C:/%E6%8A%80%E8%83%BD/my%20skill'), 'C:\\技能\\my skill');
  assert.equal(fileUriToPath('file:///home/u/skills/x'), '/home/u/skills/x');
  assert.equal(fileUriToPath('file://localhost/home/u/x'), '/home/u/x');
  assert.equal(fileUriToPath('https://github.com/a/b'), null);
});

test('isAbsolutePath 识别盘符、UNC、POSIX', () => {
  assert.ok(isAbsolutePath('D:\\a\\b')); assert.ok(isAbsolutePath('d:/a'));
  assert.ok(isAbsolutePath('\\\\server\\share\\x')); assert.ok(isAbsolutePath('/usr/x'));
  assert.ok(!isAbsolutePath('skills/my-skill')); assert.ok(!isAbsolutePath('my-skill'));
});

function dt({ files = [], data = {} } = {}) {
  return { files, types: Object.keys(data), getData: t => data[t] || '' };
}

test('extractDroppedPaths：Electron file.path 优先，uri-list 与纯文本兜底，去重', () => {
  const a = extractDroppedPaths(dt({ files: [{ path: 'D:\\skills\\a' }], data: { 'text/uri-list': 'file:///D:/skills/a\r\nfile:///D:/skills/b', 'text/plain': 'D:\\skills\\c' } }));
  assert.deepEqual(a, ['D:\\skills\\a', 'D:\\skills\\b', 'D:\\skills\\c']);
});

test('extractDroppedPaths：contextIsolation 下通过 preload resolver 获取真实路径', () => {
  const fake = { name: 'my-skill' };
  const paths = extractDroppedPaths(dt({ files: [fake], data: {} }), () => 'D:\\skills\\my-skill');
  assert.deepEqual(paths, ['D:\\skills\\my-skill']);
});
test('extractDroppedPaths：浏览器拖文件夹（无 path、无 uri）返回空 → 走上传路径', () => {
  assert.deepEqual(extractDroppedPaths(dt({ files: [{ name: 'SKILL.md' }], data: {} })), []);
  assert.deepEqual(extractDroppedPaths(dt({ data: { 'text/plain': '随便一段\n多行文本' } })), []);
  assert.deepEqual(extractDroppedPaths(dt({ data: { 'text/plain': 'skills/my-skill' } })), []);
});

test('findSkillRoots：定位 SKILL.md 所在目录', () => {
  assert.deepEqual(findSkillRoots(['my-skill/SKILL.md', 'my-skill/scripts/run.py']), ['my-skill']);
  assert.deepEqual(findSkillRoots(['repo/skills/a/SKILL.md', 'repo/skills/b/SKILL.md']), ['repo/skills/a', 'repo/skills/b']);
  assert.deepEqual(findSkillRoots(['SKILL.md']), ['']);
  assert.deepEqual(findSkillRoots(['x/readme.md']), []);
});
