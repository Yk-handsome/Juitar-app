import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const required = [
  'dist/index.html',
  'dist/src/app.js',
  'dist/assets/alphaTab.worker.mjs',
  'dist/assets/alphaTab.worklet.mjs',
  'dist/fflate/fflate.js',
  'release-apk/Juitar-v' + version + '-arm64.apk',
]

const missing = required.filter((path) => !existsSync(join(root, path)))
const assetNames = readdirSync(join(root, 'dist/assets'))
if (!assetNames.some((name) => /^pdf\.worker\.min-.*\.mjs$/.test(name))) missing.push('dist/assets/pdf.worker.min-*.mjs')
if (missing.length) {
  console.error('发布验收失败，缺少文件：')
  missing.forEach((path) => console.error(' - ' + path))
  process.exit(1)
}

const html = readFileSync(join(root, 'dist/index.html'), 'utf8')
for (const marker of ['./alphatab/alphaTab.min.js', './fflate/fflate.js', './src/app.js']) {
  if (!html.includes(marker)) {
    console.error('发布验收失败，入口缺少：' + marker)
    process.exit(1)
  }
}

console.log('Juitar v' + version + ' release assets verified')
required.forEach((path) => console.log('✓ ' + path))
