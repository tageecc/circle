const { notarize } = require('@electron/notarize')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Deep sign all binaries in the app bundle
function deepSignBinaries(appPath) {
  console.log('Deep signing binaries in:', appPath)

  // Find all Mach-O binaries
  try {
    const findCmd = `find "${appPath}" -type f \\( -perm +111 -o -name "*.dylib" -o -name "*.so" \\) -print0 | xargs -0 file | grep "Mach-O" | cut -d: -f1`
    const binaries = execSync(findCmd, { encoding: 'utf-8' }).split('\n').filter(Boolean)

    console.log(`Found ${binaries.length} binaries to sign`)

    // Sign each binary
    for (const binary of binaries) {
      try {
        // Check if already signed
        try {
          execSync(`codesign --verify --verbose "${binary}"`, { stdio: 'pipe' })
          console.log(`Already signed: ${path.basename(binary)}`)
          continue
        } catch {
          // Not signed, proceed
        }

        console.log(`Signing: ${path.basename(binary)}`)
        execSync(
          `codesign --sign "${process.env.CSC_NAME || '-'}" --force --timestamp --options=runtime --deep "${binary}"`,
          { stdio: 'inherit' }
        )
      } catch (err) {
        console.warn(`Warning: Failed to sign ${binary}:`, err.message)
      }
    }
  } catch (err) {
    console.error('Deep signing failed:', err.message)
  }
}

exports.default = async function (context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  // Only notarize if we have the necessary credentials
  if (
    !process.env.APPLE_API_KEY ||
    !process.env.APPLE_API_KEY_ID ||
    !process.env.APPLE_API_ISSUER
  ) {
    console.log('Skipping notarization (no credentials)')
    return
  }

  // Perform deep signing before notarization
  deepSignBinaries(appPath)

  console.log('Starting notarization for:', appPath)

  try {
    await notarize({
      appPath,
      tool: 'notarytool',
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    })
    console.log('Notarization complete')
  } catch (error) {
    console.error('Notarization failed:', error)
    throw error
  }
}
