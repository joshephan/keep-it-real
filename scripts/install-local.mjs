import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Builds the app for the current OS and installs it on this machine.
 *
 *   node scripts/install-local.mjs               빌드 후 설치 (이미 있으면 제자리 갱신)
 *   node scripts/install-local.mjs --full        설치 프로그램으로 새로 설치
 *   node scripts/install-local.mjs --skip-build  이미 만든 결과물로 설치만
 *   node scripts/install-local.mjs --uninstall   설치된 앱 제거
 *   node scripts/install-local.mjs --dry-run     무엇을 할지 출력만 하고 끝
 *
 * Windows  NSIS 설치 파일을 무인 모드로 실행 (사용자 단위, 관리자 권한 불필요)
 * macOS    빌드된 .app 을 /Applications (권한이 없으면 ~/Applications) 로 복사
 * Linux    AppImage 를 ~/.local/bin 에 두고 .desktop 항목과 아이콘을 등록
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_NAME = 'Keep It Real'
const SLUG = 'keep-it-real'
const RELEASE_DIR = path.join(ROOT, 'release')

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const uninstall = args.has('--uninstall')
const dryRun = args.has('--dry-run')
const forceFull = args.has('--full')

const log = (msg) => console.log(msg)
const fail = (msg) => {
  console.error(`\n[install-local] ${msg}`)
  process.exit(1)
}

function run(command, commandArgs) {
  if (dryRun) {
    log(`  [dry-run] 실행: ${command} ${commandArgs.join(' ')}`)
    return
  }
  // On Windows npm is a .cmd shim, and since Node 20.12 spawning one without a
  // shell fails with EINVAL. Passing the whole line as one string (rather than
  // args + shell:true) also keeps Node from warning about unescaped arguments.
  // Everything here is a fixed literal, never user input.
  const result =
    process.platform === 'win32'
      ? spawnSync(`${command} ${commandArgs.join(' ')}`, { stdio: 'inherit', cwd: ROOT, shell: true })
      : spawnSync(command, commandArgs, { stdio: 'inherit', cwd: ROOT })
  if (result.error) fail(`${command} 실행 실패: ${result.error.message}`)
  if (result.status !== 0) fail(`${command} ${commandArgs.join(' ')} 가 ${result.status} 로 종료했습니다.`)
}

/** Every filesystem change goes through here so --dry-run can describe it. */
function act(description, effect) {
  if (dryRun) {
    log(`  [dry-run] ${description}`)
    return
  }
  log(`  ${description}`)
  effect()
}

function findArtifact(pattern) {
  if (!fs.existsSync(RELEASE_DIR)) return null
  const match = fs
    .readdirSync(RELEASE_DIR)
    .filter((name) => pattern.test(name))
    .sort()
    .pop()
  return match ? path.join(RELEASE_DIR, match) : null
}

const dataDir = () => {
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? '', APP_NAME)
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support', APP_NAME)
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME)
}

/* ---------------------------------- Windows --------------------------------- */

const windowsInstallDir = () => path.join(process.env.LOCALAPPDATA ?? '', 'Programs', APP_NAME)

/** Blocking sleep, so the whole script can stay synchronous. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function isRunning() {
  const result = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${APP_NAME}.exe`, '/NH'], {
    encoding: 'utf8',
  })
  return (result.stdout ?? '').includes(`${APP_NAME}.exe`)
}

function closeRunningApp() {
  if (!isRunning()) return
  act('실행 중인 앱 종료 (파일을 덮어써야 합니다)', () => {
    spawnSync('taskkill', ['/IM', `${APP_NAME}.exe`], { stdio: 'ignore' })
    for (let i = 0; i < 10 && isRunning(); i++) sleep(300)
    if (isRunning()) spawnSync('taskkill', ['/IM', `${APP_NAME}.exe`, '/F', '/T'], { stdio: 'ignore' })
  })
}

/**
 * Re-running the NSIS installer removes the old installation before laying down
 * the new one, and that drops the taskbar pin along with it. When the app is
 * already installed, copy the freshly built files over it instead: the exe path
 * and every shortcut stay exactly where they were, so pins survive.
 */
function updateWindowsInPlace(dir) {
  if (!skipBuild) run('npm', ['run', 'dist:dir'])
  const source = path.join(RELEASE_DIR, 'win-unpacked')
  if (!fs.existsSync(source) && !dryRun) fail('release/win-unpacked 을 찾지 못했습니다.')

  log(`\n[install-local] 기존 설치를 제자리에서 갱신합니다: ${dir}`)
  closeRunningApp()
  act('새 파일 덮어쓰기', () => fs.cpSync(source, dir, { recursive: true, force: true }))

  log(dryRun ? '\n갱신 계획 (실제로 바뀐 것은 없습니다)' : '\n갱신 완료')
  log(`  앱          ${path.join(dir, `${APP_NAME}.exe`)}`)
  log('  바로가기    그대로 유지 (작업 표시줄 고정 포함)')
  log('  새로 설치   npm run install:local -- --full')
  log(`  데이터      ${dataDir()}`)
}

function installWindows() {
  const dir = windowsInstallDir()
  if (!forceFull && fs.existsSync(path.join(dir, `${APP_NAME}.exe`))) {
    updateWindowsInPlace(dir)
    return
  }

  if (!skipBuild) run('npm', ['run', 'dist:win'])
  const installer = findArtifact(/-win-.*\.exe$/i)
  if (!installer) fail('release 폴더에서 Windows 설치 파일을 찾지 못했습니다.')

  log(`\n[install-local] 설치 파일: ${path.basename(installer)}`)
  log('[install-local] 앱이 실행 중이면 설치 프로그램이 먼저 종료시킵니다.')
  act(`무인 설치 실행 (/S)`, () => {
    const result = spawnSync(installer, ['/S'], { stdio: 'inherit' })
    if (result.status !== 0) fail(`설치 프로그램이 ${result.status} 로 종료했습니다.`)
  })

  log(dryRun ? '\n설치 계획 (실제로 바뀐 것은 없습니다)' : '\n설치 완료')
  log(`  앱          ${path.join(dir, `${APP_NAME}.exe`)}`)
  log(`  바로가기    시작 메뉴, 바탕화면`)
  log(`  제거        npm run uninstall:local  또는 설정 → 앱`)
  log(`  데이터      ${dataDir()}`)
}

function uninstallWindows() {
  const uninstaller = path.join(windowsInstallDir(), `Uninstall ${APP_NAME}.exe`)
  if (!fs.existsSync(uninstaller)) fail('설치된 앱을 찾지 못했습니다.')
  act(`제거 프로그램 실행: ${uninstaller}`, () => {
    const result = spawnSync(uninstaller, ['/S', '/currentuser'], { stdio: 'inherit' })
    if (result.status !== 0) fail(`제거 프로그램이 ${result.status} 로 종료했습니다.`)
  })
  log(
    dryRun
      ? '\n제거 계획 (실제로 바뀐 것은 없습니다)'
      : `\n제거 완료. 기록은 ${dataDir()} 에 그대로 남아 있습니다.`,
  )
}

/* ----------------------------------- macOS ---------------------------------- */

function macAppSource() {
  if (!fs.existsSync(RELEASE_DIR)) return null
  for (const entry of fs.readdirSync(RELEASE_DIR)) {
    const candidate = path.join(RELEASE_DIR, entry, `${APP_NAME}.app`)
    if (entry.startsWith('mac') && fs.existsSync(candidate)) return candidate
  }
  return null
}

function macTargetDir() {
  try {
    fs.accessSync('/Applications', fs.constants.W_OK)
    return '/Applications'
  } catch {
    const fallback = path.join(os.homedir(), 'Applications')
    fs.mkdirSync(fallback, { recursive: true })
    return fallback
  }
}

function installMac() {
  if (!skipBuild) run('npm', ['run', 'dist:mac'])
  const source = macAppSource()
  if (!source) fail('release 폴더에서 빌드된 .app 을 찾지 못했습니다.')

  const target = path.join(macTargetDir(), `${APP_NAME}.app`)
  act(`복사: ${source} → ${target}`, () => {
    fs.rmSync(target, { recursive: true, force: true })
    fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true })
  })

  log(dryRun ? '\n설치 계획 (실제로 바뀐 것은 없습니다)' : '\n설치 완료')
  log(`  앱          ${target}`)
  log(`  실행        Launchpad 또는 Spotlight 에서 "${APP_NAME}"`)
  log(`  제거        npm run uninstall:local`)
  log(`  데이터      ${dataDir()}`)
}

function uninstallMac() {
  let removed = false
  for (const dir of ['/Applications', path.join(os.homedir(), 'Applications')]) {
    const target = path.join(dir, `${APP_NAME}.app`)
    if (fs.existsSync(target)) {
      act(`제거: ${target}`, () => fs.rmSync(target, { recursive: true, force: true }))
      removed = true
    }
  }
  if (!removed) fail('설치된 앱을 찾지 못했습니다.')
  log(
    dryRun
      ? '\n제거 계획 (실제로 바뀐 것은 없습니다)'
      : `\n제거 완료. 기록은 ${dataDir()} 에 그대로 남아 있습니다.`,
  )
}

/* ----------------------------------- Linux ---------------------------------- */

const linuxPaths = () => {
  const home = os.homedir()
  const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local/share')
  return {
    bin: path.join(home, '.local/bin', `${SLUG}.AppImage`),
    desktop: path.join(dataHome, 'applications', `${SLUG}.desktop`),
    icon: path.join(dataHome, 'icons/hicolor/512x512/apps', `${SLUG}.png`),
    applicationsDir: path.join(dataHome, 'applications'),
  }
}

function installLinux() {
  if (!skipBuild) run('npm', ['run', 'dist:linux'])
  const appImage = findArtifact(/\.AppImage$/i)
  if (!appImage) fail('release 폴더에서 AppImage 를 찾지 못했습니다.')

  const { bin, desktop, icon, applicationsDir } = linuxPaths()
  act(`복사: ${path.basename(appImage)} → ${bin}`, () => {
    fs.mkdirSync(path.dirname(bin), { recursive: true })
    fs.copyFileSync(appImage, bin)
    fs.chmodSync(bin, 0o755)
  })

  const iconSource = path.join(ROOT, 'build/icon.png')
  if (fs.existsSync(iconSource)) {
    act(`아이콘 등록: ${icon}`, () => {
      fs.mkdirSync(path.dirname(icon), { recursive: true })
      fs.copyFileSync(iconSource, icon)
    })
  }

  act(`실행 항목 작성: ${desktop}`, () => {
    fs.mkdirSync(applicationsDir, { recursive: true })
    fs.writeFileSync(
      desktop,
      [
        '[Desktop Entry]',
        'Type=Application',
        `Name=${APP_NAME}`,
        'Comment=계획과 실제를 나란히 보는 로컬 전용 플래너',
        `Exec="${bin}"`,
        `Icon=${SLUG}`,
        'Terminal=false',
        'Categories=Office;Calendar;',
        '',
      ].join('\n'),
      'utf8',
    )
    spawnSync('update-desktop-database', [applicationsDir], { stdio: 'ignore' })
  })

  log(dryRun ? '\n설치 계획 (실제로 바뀐 것은 없습니다)' : '\n설치 완료')
  log(`  앱          ${bin}`)
  log(`  실행 항목   ${desktop}`)
  log(`  제거        npm run uninstall:local`)
  log(`  데이터      ${dataDir()}`)
  log('\n  ~/.local/bin 이 PATH 에 없으면 실행 항목으로만 실행됩니다.')
}

function uninstallLinux() {
  const { bin, desktop, icon, applicationsDir } = linuxPaths()
  let removed = false
  for (const target of [bin, desktop, icon]) {
    if (fs.existsSync(target)) {
      act(`제거: ${target}`, () => fs.rmSync(target, { force: true }))
      removed = true
    }
  }
  if (!removed) fail('설치된 앱을 찾지 못했습니다.')
  if (!dryRun) spawnSync('update-desktop-database', [applicationsDir], { stdio: 'ignore' })
  log(
    dryRun
      ? '\n제거 계획 (실제로 바뀐 것은 없습니다)'
      : `\n제거 완료. 기록은 ${dataDir()} 에 그대로 남아 있습니다.`,
  )
}

/* ------------------------------------ run ----------------------------------- */

const handlers = {
  win32: { install: installWindows, uninstall: uninstallWindows },
  darwin: { install: installMac, uninstall: uninstallMac },
  linux: { install: installLinux, uninstall: uninstallLinux },
}

const handler = handlers[process.platform]
if (!handler) fail(`지원하지 않는 플랫폼입니다: ${process.platform}`)

handler[uninstall ? 'uninstall' : 'install']()
