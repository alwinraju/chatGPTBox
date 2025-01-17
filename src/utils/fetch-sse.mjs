import { createParser } from 'eventsource-parser'
import { streamAsyncIterable } from './stream-async-iterable'

export async function fetchSSE(resource, options) {
  const { onMessage, onStart, onEnd, onError, ...fetchOptions } = options
  const resp = await fetch(resource, fetchOptions).catch(async (err) => {
    await onError(err)
  })
  if (!resp) return
  if (!resp.ok) {
    await onError(resp)
    return
  }
  const parser = createParser((event) => {
    if (event.type === 'event') {
      onMessage(event.data)
    }
  })
  let hasStarted = false
  for await (const chunk of streamAsyncIterable(resp.body)) {
    const str = new TextDecoder().decode(chunk)
    if (!str.startsWith('{') && !str.startsWith('"{')) {
      parser.feed(str)
    } else {
      const formattedStr =
        'data: ' +
        JSON.stringify(
          JSON.parse(str.replace(/^"|"$/g, '').replaceAll('\\"', '"').replaceAll('\\\\u', '\\u')),
        ).replaceAll('\\\\n', '\\n') +
        '\n\ndata: [DONE]\n\n'
      parser.feed(formattedStr)
    }

    if (!hasStarted) {
      hasStarted = true
      await onStart(str)
    }
  }
  await onEnd()
}
