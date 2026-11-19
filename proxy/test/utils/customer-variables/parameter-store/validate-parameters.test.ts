import { validateParameters } from '../../../../utils/customer-variables/parameter-store/validate-parameters.ts'
import { CustomerVariableName } from '../../../../utils/customer-variables/types.ts'

describe('Validate parameters', () => {
  it.each(['not_a_secret', null])('throws if secret is not an object', (value) => {
    expect(() => {
      validateParameters(value)
    }).toThrow('Parameter Store settings is not an object')
  })

  it('does not throw if object contains unexpected keys', () => {
    const object = {
      invalid_key: 'value',
    }

    expect(() => {
      validateParameters(object)
    }).not.toThrow()
  })

  it('throws if object contains invalid values', () => {
    const object = {
      [CustomerVariableName.AgentDownloadPath]: {},
    }

    expect(() => {
      validateParameters(object)
    }).toThrow('Parameter Store settings contains an invalid value for fpjs_agent_download_path')
  })

  it('does not throw for object with partial values', () => {
    const object = {
      [CustomerVariableName.PreSharedSecret]: null,
      [CustomerVariableName.GetResultPath]: 'result',
    }

    expect(() => {
      validateParameters(object)
    }).not.toThrow()
  })
})
