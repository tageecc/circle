import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/database/schema.sqlite.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./circle.db'
  }
})
