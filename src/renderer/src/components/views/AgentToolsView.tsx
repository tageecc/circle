import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Users, Wrench } from 'lucide-react'
import { AgentList } from '../agent/AgentList'
import { AgentPanel } from '../agent/AgentPanel'
import { ToolsView } from '../tools/ToolsView'

interface AgentToolsViewProps {
  selectedAgentId: string | undefined
  onAgentSelect: (agentId: string | undefined) => void
}

/**
 * 融合「Agents」与「MCP & Tools」的单一视图，通过 Tab 切换
 */
export function AgentToolsView({ selectedAgentId, onAgentSelect }: AgentToolsViewProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'tools'>('agents')

  return (
    <div className="flex h-screen flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'agents' | 'tools')}
        className="flex h-full flex-col"
      >
        <div className="shrink-0 border-b border-border/50 px-4">
          <TabsList className="h-11 gap-1 bg-transparent p-0">
            <TabsTrigger
              value="agents"
              className="gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Users className="size-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className="gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              <Wrench className="size-4" />
              MCP & Tools
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="agents" className="m-0 flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <AgentList selectedAgent={selectedAgentId} onAgentSelect={onAgentSelect} />
            <AgentPanel agentId={selectedAgentId} />
          </div>
        </TabsContent>
        <TabsContent value="tools" className="m-0 flex-1 overflow-hidden">
          <ToolsView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
