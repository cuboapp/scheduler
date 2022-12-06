import { stat } from 'fs/promises'
import cron from 'node-cron'

import { log, readFiles } from './utils.js'

class Scheduler {
  #debug = false
  #commandsDirectory = '.'

  #ping = false
  #watcher = false

  #commands = {}

  #locks = {}
  #jobs = {}
  #timeouts = {}

  #defaultTimeout = 10000

  constructor(commandsPath, debug = false) {
    this.#debug = debug
    this.#commandsDirectory = commandsPath
  }

  async init(specificCommand = undefined) {
    await this.#parseCommands(specificCommand)

    if (!specificCommand) {
      this.watch()
    }
  }

  commandExists(command) {
    return this.#commands[command]?.handler ? true : false
  }

  watch() {
    this.unwatch()

    this.#ping = false
    this.#watcher = setInterval(() => {
      this.#ping = this.#ping === false ? true : false
      this.#parseCommands()
    }, 5000)
  }

  unwatch() {
    if (this.#watcher !== false) {
      clearInterval(this.#watcher)
    }
    this.#watcher = false
  }

  /**
   * Execute command
   * @param { number } timeout
   * @param { string } command
   * @param { any } command
   */
  exec(command, timeout, props = {}) {
    return new Promise((resolve, reject) => {
      const ts = new Date()
      const jobId = +ts

      if (!this.#commands[command]) {
        log('error', `Command "${command}" is not defined`)
        return
      }

      if (!this.#locks[command]) {
        this.#debug && log('info', `Command "${command}" #${jobId} started`)

        this.#jobs[command] = jobId
        this.#locks[command] = true

        if (timeout !== undefined && timeout > 0) {
          this.#timeouts[command] = setTimeout(() => {
            this.#locks[command] = false
            reject(`Command "${command}" rejected by timeout`)
          }, timeout)
        }

        this.#commands[command].handler(props).finally(() => {
          if (this.#jobs[command] === jobId) {
            this.#debug && log('info', `Command "${command}" #${jobId} completed`)

            if (this.#timeouts[command] !== undefined) {
              clearTimeout(this.#timeouts[command])
            }
            this.#locks[command] = false
          } else {
            log('error', `Command "${command}" #${jobId} completed with overcome`)
          }

          resolve(true)
        })
      } else {
        // this.#debug && log('warn', `Command "${command}" #${jobId} locked `)
        reject(`Command "${command}" locked`)
      }
    })
  }

  async #parseCommands(specificCommand) {
    const files = await readFiles(this.#commandsDirectory)
    const dirs = files.filter(file => file.info.isDirectory())

    const updated = []

    for (const dir of dirs) {
      const commandName = dir.name
      const commandFile = dir.filepath + '/index.js'

      try {
        const info = await stat(commandFile)

        const baseResolved = !this.#commands[commandName]
        const versionResolved = !baseResolved && this.#commands[commandName].version !== info.mtimeMs
        const specificResolved = specificCommand === undefined || commandName === specificCommand

        if ((baseResolved || versionResolved) && specificResolved) {
          const command = await import(commandFile + '?_=' + +new Date()).then(res => ({
            handler: res.handler,
            schedule: res.schedule,
            timeout: res.timeout
          }))

          // timeout
          let timeout = this.#defaultTimeout
          if (command.timeout !== undefined && !isNaN(parseInt(command.timeout))) {
            timeout = parseInt(command.timeout)
          }

          // handler
          let handler = command.handler
          if (!(handler instanceof Promise)) {
            handler = async (props) => command.handler(props)
          }

          // version
          let version = info.mtimeMs

          if (!command.handler) {
            throw new Error('handler for command ' + commandName + ' not defined')
          }

          if (!this.#commands[commandName]) {
            this.#debug && log('success', `Command added: "${commandName}"`)

            this.#commands[commandName] = {
              name: commandName,
              handler,
              timeout,
              version,
              tasks: []
            }
          } else {
            this.#debug && log('warn', `Command updated: "${commandName}"`)

            const oldTimeout = this.#commands[commandName].timeout
            this.#commands[commandName].handler = handler
            this.#commands[commandName].version = version
            this.#commands[commandName].timeout = timeout

            // clear old tasks
            if (Array.isArray(this.#commands[commandName].tasks)) {
              for (const task of this.#commands[commandName].tasks) {
                log('warn', `Remove old "${commandName}" task with schedule "${task.schedule}" and timeout "${oldTimeout}"`)

                task.job.stop()
              }
            }
            this.#commands[commandName].tasks = []
          }

          // init new schedule tasks
          if (!specificCommand && command.schedule) {
            if (!Array.isArray(command.schedule)) {
              command.schedule = [command.schedule]
            }

            for (const cronExpression of command.schedule) {
              log('warn', `Add new "${commandName}" task with schedule "${cronExpression}" and timeout "${timeout}"`)

              this.#commands[commandName].tasks.push({
                schedule: cronExpression,
                job: cron.schedule(cronExpression, () => {
                  this.exec(commandName, this.#commands[commandName].timeout).catch(e => {
                    this.#debug && log('error', e)
                  })
                })
              })
            }
          }
        }

        updated.push(commandName)
      } catch (e) {
        log('error', `Command "${commandName}" import failed: ${e.code || e.message}`)
      }
    }

    if (Array.isArray(this.#commands)) {
      for (const commandName of this.#commands) {
        if (!updated.includes(commandName)) {
          if (Array.isArray(this.#commands[commandName].tasks)) {
            for (const task of this.#commands[commandName].tasks) {
              this.#debug && log('warn', `Remove old "${commandName}" task with schedule "${task.schedule}"`)

              task.job.stop()
            }
          }

          this.#debug && log('error', `Remove "${commandName}" command`)
          delete this.#commands[commandName]
        }
      }
    }
  }
}

export { Scheduler }
export default Scheduler
