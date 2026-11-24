import { useMemo, useState } from 'react';
import { CyclicItem } from '@/services/cyclicInventoryService';
import { normalizeString } from '@/lib/utils';

export function useInventoryStats(items: CyclicItem[], initialCategory = "Medicamentos") {
    const [searchTerm, setSearchTerm] = useState("");
    const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<string>(initialCategory);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Filter by search term
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                if (!(item.name || '').toLowerCase().includes(search) && !(item.ean || '').includes(search)) {
                    return false;
                }
            }

            // Filter by differences
            if (showDifferencesOnly) {
                return item.countedQuantity !== item.systemQuantity;
            }

            return true;
        });
    }, [items, searchTerm, showDifferencesOnly]);

    // Filter pending items by CURRENT CATEGORY
    const pendingItems = useMemo(() => filteredItems.filter(i =>
        i.status === 'pending' &&
        (normalizeString(i.category || '') === normalizeString(currentCategory) || (!normalizeString(i.category || '') && normalizeString(currentCategory) === "VARIOS"))
    ), [filteredItems, currentCategory]);

    // Controlled and Adjusted items are GLOBAL (not filtered by category tab, usually)
    // But maybe they should be sorted.
    const sortItemsByDifference = (itemsToFilter: CyclicItem[]) => {
        return [...itemsToFilter].sort((a, b) => {
            const diffA = a.countedQuantity - a.systemQuantity;
            const diffB = b.countedQuantity - b.systemQuantity;

            const isDiffA = diffA !== 0;
            const isDiffB = diffB !== 0;

            // 1. Items with differences go first
            if (isDiffA && !isDiffB) return -1;
            if (!isDiffA && isDiffB) return 1;

            // 2. If both have differences (or both don't), sort by difference value
            return diffA - diffB;
        });
    };

    // Filter controlled items (GLOBAL - show all controlled items)
    const controlledItems = useMemo(() => {
        const filtered = filteredItems.filter(i => i.status === 'controlled');
        return sortItemsByDifference(filtered);
    }, [filteredItems]);

    // Filter adjusted items (GLOBAL - show all adjusted items regardless of current category tab)
    const adjustedItems = useMemo(() => {
        const filtered = filteredItems.filter(i => i.status === 'adjusted');
        return sortItemsByDifference(filtered);
    }, [filteredItems]);

    // Financial Stats Calculation
    const financialStats = useMemo(() => {
        let negative = 0;
        let positive = 0;
        let net = 0;

        items.forEach(item => {
            const diff = item.countedQuantity - item.systemQuantity;
            const value = diff * item.cost;

            if (diff < 0) negative += value;
            else if (diff > 0) positive += value;

            net += value;
        });

        return {
            negative: Math.round(negative * 100) / 100,
            positive: Math.round(positive * 100) / 100,
            net: Math.round(net * 100) / 100
        };
    }, [items]);

    return {
        searchTerm,
        setSearchTerm,
        showDifferencesOnly,
        setShowDifferencesOnly,
        currentCategory,
        setCurrentCategory,
        filteredItems,
        pendingItems,
        controlledItems,
        adjustedItems,
        financialStats
    };
}
