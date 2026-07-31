import { useState, useEffect } from 'react';

const STORAGE_KEY = 'logichub.tool-checklist.v1';

export function useToolChecklist(toolId: string, projectId: string) {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydrate state from localStorage after mount
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const key = `${toolId}::${projectId}`;
        if (parsed[key]) {
          setCheckedItems(parsed[key]);
        }
      }
    } catch (e) {
      console.warn('Failed to parse checklist state', e);
    }
  }, [toolId, projectId]);

  const toggleItem = (index: number) => {
    setCheckedItems(prev => {
      const nextState = { ...prev, [index]: !prev[index] };
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        const key = `${toolId}::${projectId}`;
        parsed[key] = nextState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (e) {
        console.warn('Failed to save checklist state', e);
      }
      return nextState;
    });
  };

  return { checkedItems, toggleItem, mounted };
}
