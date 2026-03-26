import { CloudFrontResultResponse } from 'aws-lambda'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CustomerVariableName, internalVariables } from '../utils/customer-variables/types'
import { maybeObfuscateVariable } from '../utils/customer-variables/maybe-obfuscate-variable'

export interface EnvVarInfo {
  envVarName: string
  value: string | number | null | undefined
  isSet: boolean
  isInternal: boolean
  isOptional: boolean
  // If null, the variable was resolved with the default value, otherwise it was resolved by the provider with the given name
  resolvedBy: string | null
  // Determines if the variable is relevant only for V3
  isForV3Only: boolean
}

const v3Values = [CustomerVariableName.AgentDownloadPath, CustomerVariableName.GetResultPath]
const optionalValues = [CustomerVariableName.BehaviorPathNestLevel, ...v3Values]

export interface StatusInfo {
  version: string
  envInfo: EnvVarInfo[]
  styleNonce: string
}

async function getEnvInfo(customerVariables: CustomerVariables) {
  const infoArray: EnvVarInfo[] = await Promise.all(
    Object.values(CustomerVariableName).map(async (variable) => {
      const value = await maybeObfuscateVariable(customerVariables, variable)

      return {
        envVarName: variable,
        value: value.value,
        isSet: value.value !== null && value.value !== undefined && value.value !== '',
        isInternal: internalVariables.has(variable),
        isOptional: optionalValues.includes(variable),
        resolvedBy: value.resolvedBy,
        isForV3Only: v3Values.includes(variable),
      }
    })
  )

  return infoArray
}

interface ItemRow {
  title: string
  description?: string
  children?: string
}

function renderItemRow({ title, description, children = '' }: ItemRow) {
  return `
          <div class="item">
              <h3>${title}</h3> 
              ${description ? `<p>${description}</p>` : ''}
              ${children}
          </div>
`.trim()
}

const v3Icon = `<span data-tooltip="This variable is relevant only for V3 version of the JS Agent and can be ignored in later versions." class="v3-icon">V3 only</span>`

function renderEnvInfoRow(info: EnvVarInfo) {
  let description = ''

  if (info.isSet && info.resolvedBy) {
    description = `Value is set`
  } else {
    description = `⚠️ Value is not defined ${info.value ? `and uses default value: ${info.value}` : ''}`
  }

  return `
    <li>
        <strong>${info.envVarName}${info.isForV3Only ? ` ${v3Icon}` : ''}</strong> - ${description}
    </li>
  `.trim()
}

function renderEnvInfo(envInfo: EnvVarInfo[]) {
  const isAllCustomerDefinedVariablesSet = envInfo
    .filter((info) => !info.isInternal && !info.isOptional)
    .every((info) => info.isSet && info.resolvedBy)

  return renderItemRow({
    title: 'Variables',
    description: isAllCustomerDefinedVariablesSet
      ? '✅ All required environment variables are set:'
      : '🚨 Some required environment variables are not set:',
    children: `
      <ul class="env-info">
        ${envInfo
          .filter((info) => !info.isInternal)
          .toSorted((a, b) => (a.isForV3Only === b.isForV3Only ? 0 : a.isForV3Only ? 1 : -1))
          .map(renderEnvInfoRow)
          .join('')}
      </ul>
    `.trim(),
  })
}

function renderHtml({ version, envInfo, styleNonce }: StatusInfo) {
  return `
    <html lang="en-US">
      <head>
        <title>CloudFront integration status</title>
        <meta charset="utf-8">
        <style nonce='${styleNonce}'>
         .env-info {
            display: flex;
            flex-direction: column;
          }
          
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          
          body > * {
            margin-bottom: 1em;
          }
          
          .v3-icon {
            font-size: 10px;
            color: #999;
          }
          
          .items {
            display: flex;
            flex-direction: column;
            align-content: baseline;
            gap: 2rem;
            flex-wrap: wrap;
          }
          
          .item {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          
          .item h3, p {
            margin: 0;
          }
          
          ul {
            margin: 0;
          }
          
          [data-tooltip] {
            position: relative;
            border-bottom: 1px dashed #000;
            cursor: help
          }
          
          [data-tooltip]::after {
            position: absolute;
            opacity: 0;
            pointer-events: none;
            content: attr(data-tooltip);
            left: 0;
            top: calc(100% + 10px);
            border-radius: 3px;
            box-shadow: 0 0 5px 2px rgba(100, 100, 100, 0.6);
            background-color: white;
            z-index: 10;
            padding: 8px;
            width: 300px;
            transform: translateY(-20px);
            transition: all 150ms cubic-bezier(.25, .8, .25, 1);
          }
          
          [data-tooltip]:hover::after {
            opacity: 1;
            transform: translateY(0);
            transition-duration: 300ms;
          }
        </style>
      </head>
      <body>
        <h1>CloudFront integration status</h1>
        <div class="items">
            ${renderItemRow({ title: 'Lambda function version', description: version })}
            ${renderEnvInfo(envInfo)}
        </div>
          <span>
            Please reach out our support via <a href="mailto:support@fingerprint.com">support@fingerprint.com</a> if you have any issues
          </span>
      </body>
    </html>
  `
}

export async function getStatusInfo(customerVariables: CustomerVariables, styleNonce: string): Promise<StatusInfo> {
  return {
    version: '__lambda_func_version__',
    envInfo: await getEnvInfo(customerVariables),
    styleNonce,
  }
}

export async function handleStatus(
  customerVariables: CustomerVariables,
  styleNonce: string
): Promise<CloudFrontResultResponse> {
  const body = await getStatusInfo(customerVariables, styleNonce)

  return {
    status: '200',
    body: renderHtml(body).trim(),
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html' }],
      'content-security-policy': [
        {
          key: 'Content-Security-Policy',
          value: `default-src 'none'; img-src https://fingerprint.com; style-src 'nonce-${styleNonce}'`,
        },
      ],
    },
  }
}
