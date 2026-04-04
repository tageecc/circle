const { notarize } = require('@electron/notarize')
const { execSync } = require('child_process')
const path = require('path')

// Deep sign all binaries in the app bundle
function deepSignBinaries(appPath, identity) {
  console.log('Deep signing binaries in:', appPath)
  console.log(`Using signing identity: ${identity}`)

  // Find all Mach-O binaries - use a more reliable method
  try {
    const findCmd = `find "${appPath}" -type f \\( -perm +111 -o -name "*.dylib" -o -name "*.so" -o -name "*.node" \\)`
    let binaries = execSync(findCmd, { encoding: 'utf-8' }).split('\n').filter(Boolean)

    // Filter to only Mach-O files
    binaries = binaries.filter((binary) => {
      try {
        const fileType = execSync(`file "${binary}"`, { encoding: 'utf-8' })
        return fileType.includes('Mach-O')
      } catch {
        return false
      }
    })

    console.log(`Found ${binaries.length} Mach-O binaries to process`)

    // Sign each binary
    for (const binary of binaries) {
      try {
        console.log(`Signing: ${path.basename(binary)}`)
        execSync(
          `codesign --sign "${identity}" --force --timestamp --options=runtime "${binary}"`,
          { stdio: 'pipe' }
        )
      } catch (err) {
        // Some binaries might already be properly signed or fail for other reasons
        console.warn(`Note: ${path.basename(binary)}: ${err.message.split('\n')[0]}`)
      }
    }

    console.log('Deep signing complete')
  } catch (err) {
    console.error('Deep signing failed:', err.message)
    throw err
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

  // Get signing identity
  const identity = process.env.CSC_NAME || process.env.CSC_IDENTITY
  if (!identity) {
    // Try to find Developer ID Application cert
    try {
      const identities = execSync('security find-identity -v -p codesigning', {
        encoding: 'utf-8'
      })
      const match = identities.match(/Developer ID Application: ([^(]+)/)
      if (match) {
        const foundIdentity = match[0]
        console.log(`Found identity: ${foundIdentity}`)
        // Perform deep signing with found identity
        deepSignBinaries(appPath, foundIdentity)
      }
    } catch (err) {
      console.error('Could not find signing identity:', err.message)
    }
  } else {
    // Perform deep signing before notarization
    deepSignBinaries(appPath, identity)
  }

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
