#!/usr/bin/env node
import { stat } from 'fs/promises'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { Scheduler } from './scheduler.js'
import { log } from './utils.js'

/** @type { import('./types').CommandGenerateProps } */
const argv = yargs(hideBin(process.argv)).argv

let {
  _: [command],
  $0,
  debug,
  folder,
  timeout,
  ...props
} = argv

folder = folder || undefined
if (!folder) {
  log('error', 'Commands folder not defined')
  process.exit(1)
}

debug = argv.debug !== undefined ? argv.debug : false
timeout = argv.timeout !== undefined ? argv.timeout : 0

try {
  await stat(folder)
} catch (e) {
  log('error', 'Commands directory checking error: ' + e.message)
  process.exit(1)
}

const scheduler = new Scheduler(folder, debug)

if (command) {
  await scheduler.init(command)

  if (!scheduler.commandExists(command)) {
    log('error', `Command ${command} not defined`)
  } else {
    await scheduler.exec(command, timeout, props).catch(e => {
      log('error', e)
      process.exit(1)
    })
  }
} else {
  await scheduler.init()
}
