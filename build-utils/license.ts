import { version } from '../package.json'

export function getLicenseBanner(): string {
  return `/**
 * Fingerprint Pro CloudFront Lambda function v${version} - Copyright (c) FingerprintJS, Inc, ${new Date().getFullYear()} (https://fingerprint.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 */`
}
