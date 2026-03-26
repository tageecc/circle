/**
 * Update Memory Tool
 */

import { tool } from 'ai'
import { z } from 'zod'
import { MemoryService } from '../services/memory.service'

const inputSchema = z.object({
  action: z
    .enum(['create', 'update', 'delete'])
    .describe('The action to perform on the knowledge base'),

  knowledge_to_store: z
    .string()
    .optional()
    .describe('The specific memory to be stored (required for create/update)'),

  existing_knowledge_id: z.string().optional().describe('ID of existing memory to update/delete')
})

export const updateMemoryTool = tool({
  description: `Manage persistent memories in the AI's knowledge base. Stores user preferences, project context, and important facts for future conversations.

### When to Use This Tool

Use update_memory when the user:
- **Explicitly asks** to remember something ("remember that I prefer...", "save this for later")
- **Shares personal info**: name, role, preferences, workflow habits
- **Provides project context**: architecture decisions, naming conventions, team practices
- **Corrects you**: "actually, I use X not Y" → update or delete old memory
- **States recurring preferences**: code style, framework choices, testing approaches

### When NOT to Use

Never use update_memory for:
- **Temporary task info**: current bug fixes, implementation details (those go in code/files)
- **General knowledge**: programming concepts, API documentation (you already know this)
- **Code itself**: implementations, functions, classes (use edit_file)
- **Current conversation context**: things only relevant to this session
- **Facts that might change**: package versions, API endpoints (too volatile)

### Three Actions

**1. create** - Add new memory
- User shares new information
- First time learning a preference
- Discovering project-specific context

**2. update** - Modify existing memory  
- User refines previous information
- Adding details to known preference
- Augmenting project context

**3. delete** - Remove memory
- User contradicts previous memory ("actually, I don't use X")
- Information is outdated or wrong
- User explicitly asks to forget

### Memory Guidelines

**Good Memories** (store these):
- "User prefers TypeScript with strict mode enabled"
- "Project uses kebab-case for file names, PascalCase for components"
- "Team uses Vitest instead of Jest for testing"
- "User is building an Electron app called Circle"
- "Prefers functional components over class components"

**Bad Memories** (don't store these):
- "Fixed bug in Button.tsx on line 45" (temporary)
- "React hooks were introduced in version 16.8" (general knowledge)
- "Current task is to add dark mode" (task-specific)
- "User asked about useState" (single question)

### Handling Changes

**When user updates factual information (use UPDATE)**:

<example>
  Scenario: User's name changed
  Old memory: "User's name is 张三"
  User says: "我改名了，我现在叫李师"
  Action: UPDATE memory to "User's name is 李师"
  <reasoning>
    Same attribute, different value → UPDATE to preserve history
  </reasoning>
</example>

<example>
  Scenario: User moved or changed job
  Old memory: "User works at Company A"
  User says: "I switched to Company B"
  Action: UPDATE memory to "User works at Company B"
  <reasoning>
    Same fact type (job), new value → UPDATE
  </reasoning>
</example>

**When user augments existing memory (use UPDATE)**:

<example>
  Old memory: "User prefers TypeScript"
  User says: "I also always enable strict mode"
  Action: UPDATE memory to "User prefers TypeScript with strict mode enabled"
  <reasoning>
    Adding detail → UPDATE to enrich
  </reasoning>
</example>

**When preference becomes obsolete (use DELETE)**:

<example>
  Old memory: "User prefers React class components"
  User says: "Actually, I only use functional components now"
  Action: DELETE old memory (don't update)
  <reasoning>
    Complete change in practice, old info misleading → DELETE
  </reasoning>
</example>

**Rule of thumb**:
- Same attribute, new value (name, job, location) → **UPDATE**
- Adding more context or detail → **UPDATE**
- Old information is wrong or misleading → **DELETE**
- User explicitly asks to forget → **DELETE**

### How to Find Memory IDs

**CRITICAL**: When updating or deleting a memory, you MUST provide the correct existing_knowledge_id.

**Where to find IDs**:
- All existing memories are listed in the memories section of the system prompt
- Each memory has its ID in parentheses at the end, format: (ID: mem_1234567890_abc123)
- Example: "User name is John (ID: mem_1705123456_x7k2q)"

**How to find the right ID**:
1. Read the memories section in system prompt
2. Find the memory that matches what the user wants to update or delete
3. Extract the ID from the parentheses
4. Use that exact ID as existing_knowledge_id parameter

**Example workflow**:
System shows: "User name is Zhang San (ID: mem_1705123456_x7k2q)"
User says: "My name is actually Li Si"
Step 1: Identify relevant memory about user name
Step 2: Extract ID: mem_1705123456_x7k2q
Step 3: Call tool with action=update, knowledge_to_store="User name is Li Si", existing_knowledge_id="mem_1705123456_x7k2q"

**DO NOT**:
- Make up IDs like "user_name" or "pref_001"
- Use descriptive names as IDs
- Create new memory when you should update existing one

### Memory Format

**Keep it concise**:
- ✅ One paragraph maximum
- ✅ Clear and specific
- ✅ Self-contained (doesn't reference other memories)
- ❌ No metadata or timestamps
- ❌ No conversational phrasing ("the user told me that...")

**Good format**:
\`\`\`
"Uses TypeScript with strict mode, explicit return types, and no implicit any. Prefers functional programming style."
\`\`\`

**Bad format**:
\`\`\`
"The user mentioned on 2024-01-10 that they like TypeScript and also said strict mode is good and they want to use it always and..."
\`\`\`

### Examples

<example>
  User: "Remember that I'm working on an Electron app called Circle"
  Action: create
  Content: "Building an Electron application called Circle, an AI-powered IDE"
  <reasoning>
    Good: User explicitly asked to remember project context
  </reasoning>
</example>

<example>
  User: "I prefer arrow functions over function declarations"
  Action: create
  Content: "Prefers arrow functions over function keyword declarations"
  <reasoning>
    Good: Coding preference that will be useful in future sessions
  </reasoning>
</example>

<example>
  User: "How do I use useState?"
  Action: NONE (don't create memory)
  <reasoning>
    Bad: Single question, no personal preference stated, general knowledge request
  </reasoning>
</example>

<example>
  <memories>
  - Uses Tailwind CSS for styling (ID: mem_1705123456_a1b2c)
  </memories>
  
  User: "Actually, I don't use Tailwind anymore, switched to vanilla CSS"
  Action: delete
  Parameters:
    - action: "delete"
    - existing_knowledge_id: "mem_1705123456_a1b2c"
  <reasoning>
    Good: Found ID from <memories>, contradiction → delete rather than update
  </reasoning>
</example>

<example>
  <memories>
  - User's name is Zhang San (ID: mem_1705123456_x7k2q)
  </memories>
  
  User: "Please update my name to塔歌"
  Action: update
  Parameters:
    - action: "update"
    - knowledge_to_store: "User's name is塔歌"
    - existing_knowledge_id: "mem_1705123456_x7k2q"
  <reasoning>
    Good: Found the name memory ID from <memories>, updating existing memory
  </reasoning>
</example>

### Required Parameters

- **create**: action, knowledge_to_store
- **update**: action, knowledge_to_store, existing_knowledge_id
- **delete**: action, existing_knowledge_id

### Important Notes

- Memories persist across conversations - store carefully
- Only store USER-SPECIFIC information
- Be conservative - when in doubt, don't create memory
- User can always ask to remember something explicitly
- Memories help you provide consistent, personalized assistance
- Don't mention memory IDs to the user (internal detail)`,
  inputSchema,
  execute: async ({ action, knowledge_to_store, existing_knowledge_id }) => {
    const memoryService = new MemoryService()

    try {
      if (action === 'delete') {
        if (!existing_knowledge_id) {
          return {
            success: false,
            error: 'existing_knowledge_id is required for delete action'
          }
        }
        await memoryService.deleteMemory(existing_knowledge_id)
        return {
          success: true,
          message: `Memory deleted successfully`,
          memoryId: existing_knowledge_id
        }
      }

      if (action === 'update') {
        if (!existing_knowledge_id || !knowledge_to_store) {
          return {
            success: false,
            error: 'existing_knowledge_id and knowledge_to_store are required for update'
          }
        }
        await memoryService.updateMemory(existing_knowledge_id, knowledge_to_store)
        return {
          success: true,
          message: `Memory updated`,
          memoryId: existing_knowledge_id,
          content: knowledge_to_store
        }
      }

      // action === 'create'
      if (!knowledge_to_store) {
        return {
          success: false,
          error: 'knowledge_to_store is required for create'
        }
      }
      const memoryId = await memoryService.createMemory(knowledge_to_store)
      return {
        success: true,
        message: `Memory created`,
        memoryId,
        content: knowledge_to_store
      }
    } catch (error) {
      console.error('[UpdateMemoryTool] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
})
