import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';

export interface MenuItemConfig {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItemConfig[];
  align?: 'start' | 'center' | 'end';
}

export const Menu: React.FC<MenuProps> = ({ trigger, items, align = 'end' }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[192px] rounded-xl border border-border bg-surface-raised p-1.5 shadow-lg focus:outline-none"
        >
          {items.map((item, idx) => {
            const isDanger = Boolean(item.danger || item.destructive);
            return (
              <DropdownMenu.Item
                key={item.id ?? `${item.label}-${idx}`}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={`flex min-h-[40px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors data-[disabled]:opacity-40 data-[disabled]:pointer-events-none ${
                  isDanger
                    ? 'text-danger data-[highlighted]:bg-danger/10'
                    : 'text-text-primary data-[highlighted]:bg-surface-sunken'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export interface ContextMenuProps {
  children: React.ReactNode;
  items: MenuItemConfig[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ children, items }) => {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-[192px] rounded-xl border border-border bg-surface-raised p-1.5 shadow-lg focus:outline-none">
          {items.map((item, idx) => {
            const isDanger = Boolean(item.danger || item.destructive);
            return (
              <ContextMenuPrimitive.Item
                key={item.id ?? `${item.label}-${idx}`}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={`flex min-h-[40px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors data-[disabled]:opacity-40 data-[disabled]:pointer-events-none ${
                  isDanger
                    ? 'text-danger data-[highlighted]:bg-danger/10'
                    : 'text-text-primary data-[highlighted]:bg-surface-sunken'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </ContextMenuPrimitive.Item>
            );
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
};
