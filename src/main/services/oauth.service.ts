import { app, shell } from 'electron'
import crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

interface OAuthTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
}

interface CachedToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenEndpoint: string
  resourceUrl: string
}

interface AuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  code_challenge_methods_supported?: string[]
}

interface ClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
}

export class OAuthRequiredError extends Error {
  constructor(public readonly statusCode: number) {
    super('OAuth authorization required')
    this.name = 'OAuthRequiredError'
  }
}

export class OAuthService {
  private static instance: OAuthService
  private tokenCachePath: string
  private clientCachePath: string
  private callbackServer: http.Server | null = null
  private readonly CALLBACK_PORT = 13337

  private constructor() {
    const userDataPath = app.getPath('userData')
    this.tokenCachePath = path.join(userDataPath, 'mcp-tokens.json')
    this.clientCachePath = path.join(userDataPath, 'mcp-clients.json')
  }

  static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService()
    }
    return OAuthService.instance
  }

  private readTokenCache(): Record<string, CachedToken> {
    try {
      if (fs.existsSync(this.tokenCachePath)) {
        const content = fs.readFileSync(this.tokenCachePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('[OAuth] Failed to read token cache:', error)
    }
    return {}
  }

  private writeTokenCache(cache: Record<string, CachedToken>): void {
    try {
      const dir = path.dirname(this.tokenCachePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.tokenCachePath, JSON.stringify(cache, null, 2), 'utf-8')
    } catch (error) {
      console.error('[OAuth] Failed to write token cache:', error)
    }
  }

  private readClientCache(): Record<string, ClientRegistrationResponse> {
    try {
      if (fs.existsSync(this.clientCachePath)) {
        const content = fs.readFileSync(this.clientCachePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('[OAuth] Failed to read client cache:', error)
    }
    return {}
  }

  private writeClientCache(cache: Record<string, ClientRegistrationResponse>): void {
    try {
      const dir = path.dirname(this.clientCachePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.clientCachePath, JSON.stringify(cache, null, 2), 'utf-8')
    } catch (error) {
      console.error('[OAuth] Failed to write client cache:', error)
    }
  }

  private extractCanonicalResourceUrl(serverUrl: string): string {
    try {
      const url = new URL(serverUrl)
      let canonical = `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}`

      if (url.port && url.port !== '80' && url.port !== '443') {
        canonical += `:${url.port}`
      }

      if (url.pathname && url.pathname !== '/') {
        canonical += url.pathname.replace(/\/$/, '')
      }

      return canonical
    } catch (error) {
      throw new Error(`Invalid server URL: ${serverUrl}`)
    }
  }

  private inferAuthorizationServerFromUrl(serverUrl: string): string {
    const url = new URL(serverUrl)
    const baseUrl = `${url.protocol}//${url.host}`
    console.log(`[OAuth] Inferred authorization server from URL: ${baseUrl}`)
    return baseUrl
  }

  private async getAuthorizationServerMetadata(
    authServerUrl: string
  ): Promise<AuthorizationServerMetadata> {
    try {
      const metadataUrl = new URL('/.well-known/oauth-authorization-server', authServerUrl)

      const response = await fetch(metadataUrl.toString(), {
        headers: { Accept: 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[OAuth] Failed to get authorization server metadata:', error)
      throw error
    }
  }

  private async registerClient(
    registrationEndpoint: string,
    resourceUrl: string
  ): Promise<ClientRegistrationResponse> {
    try {
      const response = await fetch(registrationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_name: 'Circle MCP Client',
          redirect_uris: [`http://localhost:${this.CALLBACK_PORT}/oauth/callback`],
          grant_types: ['authorization_code', 'refresh_token'],
          token_endpoint_auth_method: 'none',
          application_type: 'native'
        })
      })

      if (!response.ok) {
        throw new Error(`Client registration failed: ${response.status}`)
      }

      const clientInfo = await response.json()

      const cache = this.readClientCache()
      cache[resourceUrl] = clientInfo
      this.writeClientCache(cache)

      return clientInfo
    } catch (error) {
      console.error('[OAuth] Failed to register client:', error)
      throw error
    }
  }

  private async getOrRegisterClient(
    metadata: AuthorizationServerMetadata,
    resourceUrl: string
  ): Promise<string> {
    const cache = this.readClientCache()
    const cached = cache[resourceUrl]

    if (cached?.client_id) {
      return cached.client_id
    }

    if (metadata.registration_endpoint) {
      const clientInfo = await this.registerClient(metadata.registration_endpoint, resourceUrl)
      return clientInfo.client_id
    }

    throw new Error('Dynamic client registration not supported and no cached client_id found')
  }

  async startAuthFlow(serverId: string, serverUrl: string): Promise<boolean> {
    try {
      const resourceUrl = this.extractCanonicalResourceUrl(serverUrl)
      console.log(`[OAuth] Resource URL: ${resourceUrl}`)

      const authServerUrl = this.inferAuthorizationServerFromUrl(serverUrl)
      console.log(`[OAuth] Authorization Server: ${authServerUrl}`)

      const metadata = await this.getAuthorizationServerMetadata(authServerUrl)
      console.log(`[OAuth] Metadata endpoints:`, {
        authorization: metadata.authorization_endpoint,
        token: metadata.token_endpoint,
        registration: metadata.registration_endpoint
      })

      const clientId = await this.getOrRegisterClient(metadata, resourceUrl)
      console.log(`[OAuth] Client ID: ${clientId}`)

      const codeVerifier = this.generateCodeVerifier()
      const codeChallenge = await this.generateCodeChallenge(codeVerifier)
      const state = crypto.randomBytes(16).toString('hex')
      const redirectUri = `http://localhost:${this.CALLBACK_PORT}/oauth/callback`

      const authUrl = new URL(metadata.authorization_endpoint)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('resource', resourceUrl)

      return new Promise((resolve, reject) => {
        let isHandled = false

        const handleCallback = async (code: string, returnedState: string) => {
          if (isHandled) return
          isHandled = true

          if (returnedState !== state) {
            reject(new Error('Invalid state parameter'))
            return
          }

          try {
            const tokenResponse = await this.exchangeCodeForToken(
              code,
              codeVerifier,
              metadata.token_endpoint,
              clientId,
              resourceUrl,
              redirectUri
            )

            await this.saveTokens(serverId, tokenResponse, metadata.token_endpoint, resourceUrl)
            resolve(true)
          } catch (error) {
            reject(error)
          } finally {
            this.stopCallbackServer()
          }
        }

        this.startCallbackServer((code, returnedState, error) => {
          if (error) {
            isHandled = true
            this.stopCallbackServer()
            reject(new Error(`OAuth error: ${error}`))
            return
          }

          if (code && returnedState) {
            handleCallback(code, returnedState)
          }
        })
          .then(() => {
            console.log(`[OAuth] Opening system browser for authorization...`)
            shell.openExternal(authUrl.toString())
          })
          .catch((error) => {
            reject(new Error(`Failed to start callback server: ${error.message}`))
          })

        setTimeout(
          () => {
            if (!isHandled) {
              this.stopCallbackServer()
              reject(new Error('Authorization timeout (5 minutes)'))
            }
          },
          5 * 60 * 1000
        )
      })
    } catch (error) {
      console.error('[OAuth] Failed to start auth flow:', error)
      this.stopCallbackServer()
      throw error
    }
  }

  private startCallbackServer(
    onCallback: (code: string | null, state: string | null, error: string | null) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.callbackServer) {
        this.stopCallbackServer()
      }

      this.callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${this.CALLBACK_PORT}`)

        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          const error = url.searchParams.get('error')

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

          if (error) {
            res.end(`
              <html>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h1>❌ 授权失败</h1>
                  <p>${error}</p>
                  <p style="color: #666;">您可以关闭此页面</p>
                </body>
              </html>
            `)
            onCallback(null, null, error)
          } else if (code && state) {
            res.end(`
              <html>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h1>✅ 授权成功</h1>
                  <p>正在连接到 MCP 服务器...</p>
                  <p style="color: #666;">您可以关闭此页面</p>
                  <script>setTimeout(() => window.close(), 1000)</script>
                </body>
              </html>
            `)
            onCallback(code, state, null)
          } else {
            res.end(`
              <html>
                <body style="font-family: system-ui; text-align: center; padding: 50px;">
                  <h1>⚠️ 无效的回调</h1>
                  <p>缺少必要的参数</p>
                </body>
              </html>
            `)
            onCallback(null, null, 'Missing required parameters')
          }
        } else {
          res.writeHead(404)
          res.end('Not Found')
        }
      })

      this.callbackServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`端口 ${this.CALLBACK_PORT} 已被占用，请关闭占用该端口的程序后重试`))
        } else {
          reject(error)
        }
      })

      this.callbackServer.listen(this.CALLBACK_PORT, 'localhost', () => {
        console.log(`[OAuth] Callback server listening on http://localhost:${this.CALLBACK_PORT}`)
        resolve()
      })
    })
  }

  private stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close()
      this.callbackServer = null
      console.log('[OAuth] Callback server stopped')
    }
  }

  private async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    tokenEndpoint: string,
    clientId: string,
    resourceUrl: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
      resource: resourceUrl
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: body.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  private async saveTokens(
    serverId: string,
    tokenResponse: OAuthTokenResponse,
    tokenEndpoint: string,
    resourceUrl: string
  ): Promise<void> {
    const cache = this.readTokenCache()

    cache[serverId] = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenResponse.expires_in
        ? Date.now() + tokenResponse.expires_in * 1000
        : undefined,
      tokenEndpoint,
      resourceUrl
    }

    this.writeTokenCache(cache)
    console.log(`[OAuth] Token cached for ${resourceUrl}`)
  }

  async getValidToken(serverId: string): Promise<string | null> {
    const cache = this.readTokenCache()
    const cachedToken = cache[serverId]

    if (!cachedToken) {
      return null
    }

    if (cachedToken.expiresAt && Date.now() >= cachedToken.expiresAt) {
      if (cachedToken.refreshToken) {
        try {
          await this.refreshToken(
            serverId,
            cachedToken.refreshToken,
            cachedToken.tokenEndpoint,
            cachedToken.resourceUrl
          )

          const updatedCache = this.readTokenCache()
          return updatedCache[serverId]?.accessToken || null
        } catch (error) {
          console.error('[OAuth] Failed to refresh token:', error)
          return null
        }
      }
      return null
    }

    return cachedToken.accessToken
  }

  private async refreshToken(
    serverId: string,
    refreshToken: string,
    tokenEndpoint: string,
    resourceUrl: string
  ): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      resource: resourceUrl
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: body.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
    }

    const tokenResponse: OAuthTokenResponse = await response.json()
    await this.saveTokens(serverId, tokenResponse, tokenEndpoint, resourceUrl)
  }

  async clearAuth(serverId: string): Promise<void> {
    const cache = this.readTokenCache()
    delete cache[serverId]
    this.writeTokenCache(cache)
    console.log(`[OAuth] Cleared authorization for ${serverId}`)
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return Buffer.from(hash).toString('base64url')
  }
}
