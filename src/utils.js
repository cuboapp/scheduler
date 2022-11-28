import { parse, resolve } from 'path'
import { readdir, stat } from 'fs/promises'
import { Stats } from 'fs'
import { log as consoleLog } from 'console-log-colors'

/**
 * Read files from directory
 * @param {string} dir
 * @returns { Promise<{name: string; ext: string; filepath: string; info: Stats}[]> }
 */
export async function readFiles(dir) {
  const filenames = await readdir(dir, { encoding: 'utf8' })

  const ret = []

  for (const filename of filenames) {
    const name = parse(filename).name
    const ext = parse(filename).ext
    const filepath = resolve(dir, filename)

    const info = await stat(filepath)

    ret.push({
      name,
      ext,
      filepath,
      info
    })
  }

  return ret
}

/**
 * Log text to console
 * @param {'info' | 'warn' | 'error' | 'success' | 'blue'} type
 * @param  {...any} args
 */
export function log(type, ...args) {
  type = !['info', 'warn', 'error', 'success', 'blue'].includes(type) ? 'info' : type

  return {
    info: () => consoleLog.gray(...args),
    warn: () => consoleLog.yellow(...args),
    error: () => consoleLog.red(...args),
    success: () => consoleLog.green(...args),
    blue: () => consoleLog.blue(...args)
  }[type]()
}
