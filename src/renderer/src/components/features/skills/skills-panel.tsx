import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSkillsStore } from '@/stores/skills.store'
import { SkillsMarketPanel } from './skills-market-panel'
import { SkillsInstalledPanel } from './skills-installed-panel'

export function SkillsPanel() {
  const { activeTab, setActiveTab } = useSkillsStore()

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'marketplace' | 'installed')}
      className="flex flex-col h-full"
    >
      {/* Tab Headers */}
      <div className="px-3 py-2 border-b border-border/30">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="marketplace" className="text-xs">
            市场
          </TabsTrigger>
          <TabsTrigger value="installed" className="text-xs">
            本地
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Marketplace Tab */}
      <TabsContent
        value="marketplace"
        className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden"
      >
        <SkillsMarketPanel />
      </TabsContent>

      {/* Installed Tab */}
      <TabsContent
        value="installed"
        className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
      >
        <SkillsInstalledPanel />
      </TabsContent>
    </Tabs>
  )
}
