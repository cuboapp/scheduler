#!/usr/bin/env node
import { stat } from 'fs/promises'
import { Scheduler } from './scheduler.js'
import { log } from './utils.js'

const [, , command, ...props] = process.argv

const commands_path = process.env.SCHEDULER_DIR || undefined
if (!commands_path) {
  log('error', 'Commands directory not defined')
  process.exit(1)
}

try {
  await stat(commands_path)
} catch (e) {
  log('error', 'Commands directory checking error: ' + e.message)
  process.exit(1)
}

const scheduler = new Scheduler(commands_path, [true, 1, '1', 'true'].includes(process.env.SCHEDULER_DEBUG))

if (command) {
  await scheduler.init(false)

  if (!scheduler.commandExists(command)) {
    log('error', `Command ${command} not defined`)
  } else {
    await scheduler.exec(command, 0, ...props)
  }
} else {
  await scheduler.init(true)
}
