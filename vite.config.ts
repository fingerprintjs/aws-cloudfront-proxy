import { defineConfig } from 'vite'
import dotenv from 'dotenv'
import packageJson from './package.json' with { type: 'json' }
import { getLicenseBanner } from './build-utils/license.ts'

dotenv.config()

const outputDirectory = 'dist'

// Lambda@Edge needs two independent, fully self-contained bundles (no shared chunk between
// them, no node_modules at runtime). Building them as a Rolldown multi-entry graph would let the
// two share a common vendor chunk; running `vite build` twice - once per BUILD_TARGET - keeps
// each build isolated, same as the two independent Rollup configs this replaces.
const entries = {
  proxy: { input: 'proxy/app.ts', name: 'fingerprintjs-pro-cloudfront-lambda-function' },
  mgmt: { input: 'mgmt-lambda/app.ts', name: 'fingerprintjs-pro-cloudfront-mgmt-lambda-function' },
} as const

function getEnv(key: string, defaultValue: string): string {
  const value = process.env[key]
  if (value !== undefined && value !== '') {
    console.info(`Using environment variable "${key}" with value: ${value}`)
    return value
  }

  console.warn(`Missing environment variable "${key}". Using default value: ${defaultValue}`)
  return defaultValue
}

const target = process.env.BUILD_TARGET === 'mgmt' ? entries.mgmt : entries.proxy

export default defineConfig({
  define: {
    __FPCDN__: JSON.stringify(getEnv('FPCDN', 'fpcdn.io')),
    __INGRESS_API__: JSON.stringify(getEnv('INGRESS_API', 'api.fpjs.io')),
    __lambda_func_version__: JSON.stringify(packageJson.version),
  },
  build: {
    target: 'node24',
    outDir: outputDirectory,
    emptyOutDir: false,
    minify: false,
    sourcemap: true,
    ssr: target.input,
    rolldownOptions: {
      output: {
        format: 'cjs',
        entryFileNames: `${target.name}.js`,
        exports: 'named',
        banner: getLicenseBanner(),
        codeSplitting: false,
      },
    },
  },
  // Bundle every dependency (incl. @aws-sdk/*) into the single output file - Lambda@Edge has no
  // node_modules.
  ssr: {
    noExternal: true,
  },
})
