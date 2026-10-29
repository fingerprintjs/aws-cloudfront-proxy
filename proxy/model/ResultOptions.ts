import type { OutgoingHttpHeaders } from 'http'
import type { Region } from './index'

export interface ResultOptions {
  fpIngressBaseHost: string
  region: Region
  querystring: string
  method: string
  headers: OutgoingHttpHeaders
  body: string
  suffix: string
}
