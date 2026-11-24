export interface QueueItem {
    id: string;
    type: 'SAVE_INVENTORY' | 'UPDATE_STOCK';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    timestamp: number;
    retryCount: number;
}

const QUEUE_KEY = 'farmaplus_offline_queue';

export const OfflineQueue = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enqueue: (type: QueueItem['type'], payload: any) => {
        const queue = OfflineQueue.getQueue();
        const newItem: QueueItem = {
            id: crypto.randomUUID(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0
        };
        queue.push(newItem);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        return newItem;
    },

    getQueue: (): QueueItem[] => {
        try {
            const queue = localStorage.getItem(QUEUE_KEY);
            return queue ? JSON.parse(queue) : [];
        } catch (e) {
            console.error('Error reading offline queue', e);
            return [];
        }
    },

    remove: (id: string) => {
        const queue = OfflineQueue.getQueue();
        const newQueue = queue.filter(item => item.id !== id);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    },

    clear: () => {
        localStorage.removeItem(QUEUE_KEY);
    },

    peek: (): QueueItem | undefined => {
        const queue = OfflineQueue.getQueue();
        return queue[0];
    }
};
