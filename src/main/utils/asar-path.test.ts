import test from 'node:test'
import assert from 'node:assert/strict'
import { preferAsarUnpackedPath, toAsarUnpackedPath } from './asar-path'

test('toAsarUnpackedPath rewrites app.asar segment', () => {
  assert.equal(
    toAsarUnpackedPath(
      '/Applications/Circle.app/Contents/Resources/app.asar/node_modules/sqlite-vec-darwin-arm64/vec0.dylib'
    ),
    '/Applications/Circle.app/Contents/Resources/app.asar.unpacked/node_modules/sqlite-vec-darwin-arm64/vec0.dylib'
  )
})

test('toAsarUnpackedPath leaves normal paths unchanged', () => {
  assert.equal(
    toAsarUnpackedPath('/Users/example/project/node_modules/@vscode/ripgrep/bin/rg'),
    '/Users/example/project/node_modules/@vscode/ripgrep/bin/rg'
  )
})

test('preferAsarUnpackedPath returns original path when no unpacked sibling exists', () => {
  const target = '/tmp/circle-no-asar/file.txt'
  assert.equal(preferAsarUnpackedPath(target), target)
})
