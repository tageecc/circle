import * as monaco from 'monaco-editor'

let configured = false

/**
 * 配置 Monaco Editor 的内置语言服务
 * 启用 CSS、HTML、JSON 等语言的诊断功能
 */
export function configureMonacoLanguages() {
  if (configured) return
  configured = true

  // CSS/SCSS/LESS 语言服务配置
  const cssLintOptions = {
    compatibleVendorPrefixes: 'warning' as const,
    vendorPrefix: 'warning' as const,
    duplicateProperties: 'warning' as const,
    emptyRules: 'warning' as const,
    importStatement: 'ignore' as const,
    boxModel: 'warning' as const,
    universalSelector: 'ignore' as const,
    zeroUnits: 'warning' as const,
    fontFaceProperties: 'warning' as const,
    hexColorLength: 'warning' as const,
    argumentsInColorFunction: 'error' as const,
    unknownProperties: 'warning' as const,
    ieHack: 'ignore' as const,
    unknownVendorSpecificProperties: 'ignore' as const,
    propertyIgnoredDueToDisplay: 'warning' as const,
    important: 'ignore' as const,
    float: 'ignore' as const,
    idSelector: 'ignore' as const
  }

  monaco.languages.css.cssDefaults.setDiagnosticsOptions({
    validate: true,
    lint: cssLintOptions
  })

  monaco.languages.css.scssDefaults.setDiagnosticsOptions({
    validate: true,
    lint: cssLintOptions
  })

  monaco.languages.css.lessDefaults.setDiagnosticsOptions({
    validate: true,
    lint: cssLintOptions
  })

  // HTML 语言服务配置
  monaco.languages.html.htmlDefaults.setOptions({
    format: {
      tabSize: 2,
      insertSpaces: true,
      wrapLineLength: 120,
      unformatted: 'wbr',
      contentUnformatted: 'pre,code,textarea',
      indentInnerHtml: false,
      preserveNewLines: true,
      maxPreserveNewLines: undefined,
      indentHandlebars: false,
      endWithNewline: false,
      extraLiners: 'head, body, /html',
      wrapAttributes: 'auto' as const
    },
    suggest: {
      html5: true,
      angular1: false,
      ionic: false
    }
  })

  // JSON 语言服务配置（包含常用 schema）
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemaValidation: 'warning',
    schemas: [
      // package.json schema
      {
        uri: 'https://json.schemastore.org/package.json',
        fileMatch: ['package.json']
      },
      // tsconfig.json schema
      {
        uri: 'https://json.schemastore.org/tsconfig.json',
        fileMatch: ['tsconfig.json', 'tsconfig.*.json']
      },
      // eslintrc schema
      {
        uri: 'https://json.schemastore.org/eslintrc.json',
        fileMatch: ['.eslintrc.json', '.eslintrc']
      },
      // vscode settings schema
      {
        uri: 'https://json.schemastore.org/vscode.json',
        fileMatch: ['settings.json', '.vscode/*.json']
      },
      // prettierrc schema
      {
        uri: 'https://json.schemastore.org/prettierrc.json',
        fileMatch: ['.prettierrc', '.prettierrc.json', 'prettier.config.json']
      }
    ]
  })

  // TypeScript/JavaScript 语言服务配置
  // 关键：禁用eager sync，减少内置语言服务的活动
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(false)
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(false)

  // 配置编译选项
  const compilerOptions: monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: 'React',
    allowJs: true,
    typeRoots: ['node_modules/@types']
  }

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions)

  // 诊断配置 - 完全禁用内置的诊断，只使用自定义的Language Service
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: []
  })

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
    diagnosticCodesToIgnore: []
  })
}
