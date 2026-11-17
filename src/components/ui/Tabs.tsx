import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  items: TabItem[];
  listClassName?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, items, listClassName = '' }) => {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        className={`flex items-center gap-1 rounded-xl bg-surface-sunken p-1 ${listClassName}`}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors data-[state=active]:bg-surface-raised data-[state=active]:text-text-primary data-[state=active]:shadow-xs cursor-pointer whitespace-nowrap"
          >
            {item.icon}
            <span>{item.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items
        .filter((item) => item.content !== undefined)
        .map((item) => (
          <TabsPrimitive.Content key={item.value} value={item.value} className="mt-3 focus:outline-none">
            {item.content}
          </TabsPrimitive.Content>
        ))}
    </TabsPrimitive.Root>
  );
};
