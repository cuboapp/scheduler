export const timeout = 2000

export const schedule = '* * * * * *'

export async function handler(props) {
  console.log('exec long task', props)
  await new Promise(resolve => setTimeout(() => resolve, 10000))
}
