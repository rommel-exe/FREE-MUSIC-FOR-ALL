import React from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-0.5 p-0.5 glass-control rounded-mac-sm ${className}`}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative flex items-center gap-2 px-4 py-1 rounded-[5px] text-[13px] font-medium transition-colors duration-150 ${
            activeTab === tab.id ? 'text-surface-100' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-white/10 rounded-[5px]"
              transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
