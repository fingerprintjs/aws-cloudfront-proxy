import * as V3 from '@fingerprintjs/fingerprintjs-pro'
import * as V4 from '@fingerprint/agent'

type Text = string | { html: string }

enum AgentVersion {
  V3 = 'v3',
  V4 = 'v4',
}

let agentVersion: AgentVersion = AgentVersion.V3

const formFields = {
  apiKey: document.querySelector<HTMLInputElement>('#apiKey')!,
  endpoint: document.querySelector<HTMLInputElement>('#endpoint')!,
  scriptUrlPattern: document.querySelector<HTMLInputElement>('#scriptUrlPattern')!,
  version: document.querySelectorAll<HTMLInputElement>('[name="agentVersion"]'),
}

function initForm() {
  setupAgentVersion()

  document.querySelector<HTMLInputElement>(`[name="agentVersion"][value="${agentVersion}"]`)?.click()

  formFields.apiKey.value = import.meta.env.VITE_API_KEY as string
  formFields.endpoint.value = import.meta.env.VITE_ENDPOINT as string
  formFields.scriptUrlPattern.value = import.meta.env.VITE_SCRIPT_URL_PATTERN as string

  formFields.version.forEach((input) => {
    input.addEventListener('change', () => {
      agentVersion = input.value as unknown as AgentVersion
      setupAgentVersion()
    })
  })
}

function setupAgentVersion() {
  switch (agentVersion) {
    case AgentVersion.V3:
      formFields.scriptUrlPattern.disabled = false
      break

    case AgentVersion.V4:
      formFields.scriptUrlPattern.disabled = true
      break
  }
}

type VisitorData = {
  visitorId: string
  requestId: string
}

async function getVisitorData(): Promise<VisitorData> {
  switch (agentVersion) {
    case AgentVersion.V3: {
      const agent = await V3.load({
        apiKey: formFields.apiKey.value,
        endpoint: formFields.endpoint.value,
        scriptUrlPattern: formFields.scriptUrlPattern.value || V3.defaultScriptUrlPattern,
      })

      const result = await agent.get({
        extendedResult: true,
      })

      return {
        visitorId: result.visitorId,
        requestId: result.requestId,
      }
    }

    case AgentVersion.V4: {
      const agent = V4.start({
        endpoints: formFields.endpoint.value,
        apiKey: formFields.apiKey.value,
      })

      console.debug('Got agent V4', agent)

      const result = await agent.get()

      console.info('V4 result', result)

      return {
        visitorId: result.visitor_id ?? '',
        requestId: result.event_id,
      }
    }

    default:
      throw new Error(`Unknown agent version: ${agentVersion}`)
  }
}

async function getAndPrintData() {
  const output = document.querySelector('.output')
  if (!output) {
    throw new Error("The output element isn't found in the HTML code")
  }

  const startTime = Date.now()

  try {
    const response = await getVisitorData()
    const { visitorId, requestId } = response

    console.log('Got response', response)

    const totalTime = Date.now() - startTime
    output.innerHTML = ''
    addOutputSection({
      output,
      header: 'Response',
      content: JSON.stringify(response, null, ' '),
      size: 'big',
      id: 'response',
    })
    addOutputSection({
      output,
      header: 'Time took to get the identifier:',
      content: `${totalTime}ms`,
      size: 'big',
      id: 'time',
    })
    addOutputSection({
      output,
      header: 'Visitor ID:',
      content: visitorId,
      id: 'visitorId',
      comment: '',
      size: 'big',
    })
    addOutputSection({
      output,
      header: 'Request ID:',
      content: requestId,
      id: 'requestId',
      comment: '',
      size: 'big',
    })
    addOutputSection({ output, header: 'User agent:', content: navigator.userAgent, id: 'userAgent' })
  } catch (error) {
    const totalTime = Date.now() - startTime
    const errorData = error instanceof Error ? error.message : JSON.stringify(error)
    output.innerHTML = ''
    addOutputSection({ output, header: 'Unexpected error:', content: JSON.stringify(errorData, null, 2), id: 'error' })
    addOutputSection({
      output,
      header: 'Time passed before the error:',
      content: `${totalTime}ms`,
      size: 'big',
      id: 'error_time',
    })
    addOutputSection({ output, header: 'User agent:', content: navigator.userAgent, id: 'userAgent' })

    throw error
  }
}

async function startPlayground() {
  const getDataButton = document.querySelector('#getData')
  if (getDataButton instanceof HTMLButtonElement) {
    getDataButton.disabled = false
    getDataButton.addEventListener('click', async (event) => {
      event.preventDefault()

      await getAndPrintData()
    })
  }
}

function addOutputSection({
  output,
  header,
  content,
  comment,
  size,
  id,
}: {
  output: Node
  header: Text
  id: string
  content: Text
  comment?: Text
  size?: 'big' | 'giant'
}) {
  const container = document.createElement('div')
  container.classList.add('outputSection')
  container.id = id

  const headerElement = document.createElement('div')
  headerElement.appendChild(textToDOM(header))
  headerElement.classList.add('heading')
  container.appendChild(headerElement)

  const contentElement = document.createElement('pre')
  contentElement.appendChild(textToDOM(content))
  if (size) {
    contentElement.classList.add(size)
  }
  container.appendChild(contentElement)

  if (comment) {
    const commentElement = document.createElement('div')
    commentElement.appendChild(textToDOM(comment))
    commentElement.classList.add('comment')
    container.appendChild(commentElement)
  }

  output.appendChild(container)
}

function textToDOM(text: Text): Node {
  if (typeof text === 'string') {
    return document.createTextNode(text)
  }
  const container = document.createElement('div')
  container.innerHTML = text.html
  const fragment = document.createDocumentFragment()
  while (container.firstChild) {
    fragment.appendChild(container.firstChild)
  }
  return fragment
}

initForm()

startPlayground()
