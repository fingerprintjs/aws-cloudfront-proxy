import type { CloudfrontUrls } from './utils/cloudfront.ts'

export function getProjectName(browser: string, urlType: keyof CloudfrontUrls) {
  return `${browser}-${urlType}`
}

export function extractUrlTypeFromProjectName(name: string) {
  return name.split('-')[1] as keyof CloudfrontUrls
}
