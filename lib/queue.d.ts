export declare class PromiseQueue {
    maxConcurrent: number;
    private queue;
    private pendingPromiseCount;
    constructor(maxConcurrent?: number);
    add<T>(promiseGenerator: () => Promise<T>): Promise<T>;
    private dequeue;
}
