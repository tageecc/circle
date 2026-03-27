import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const SidebarContext = React.createContext<{
  collapsible?: 'offcanvas' | 'icon' | 'none'
}>({
  collapsible: 'none'
})

function SidebarProvider({
  className,
  children,
  collapsible = 'none',
  ...props
}: React.ComponentProps<'div'> & {
  collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
  return (
    <SidebarContext.Provider value={{ collapsible }}>
      <div className={cn('flex', className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  className,
  collapsible,
  ...props
}: React.ComponentProps<'div'> & {
  collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
  return (
    <div
      data-slot="sidebar"
      className={cn('flex h-full w-[--sidebar-width] flex-col border-r border-border bg-sidebar', className)}
      style={
        {
          '--sidebar-width': '16rem'
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-group" className={cn('flex flex-col gap-1', className)} {...props} />
  )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sidebar-group-content" className={cn('flex flex-col', className)} {...props} />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" className={cn('flex flex-col gap-1', className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('list-none', className)} {...props} />
}

const sidebarMenuButtonVariants = cva(
  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
      },
      isActive: {
        true: 'bg-accent text-accent-foreground',
        false: 'text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default',
      isActive: false
    }
  }
)

interface SidebarMenuButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean
  isActive?: boolean
}

function SidebarMenuButton({
  className,
  variant,
  isActive,
  asChild = false,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="sidebar-menu-button"
      className={cn(sidebarMenuButtonVariants({ variant, isActive }), className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
}
