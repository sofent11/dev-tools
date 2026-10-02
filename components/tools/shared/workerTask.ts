/** A task owns its worker: timeout, cancellation and completion always release it. */
export const runWorkerTask = <T>(worker: Worker, payload: unknown, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    const finish = (error?: Error, result?: T) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(result as T);
    };
    const abort = () => finish(new Error('Task cancelled; previous results were retained.'));
    const timer = setTimeout(() => finish(new Error('Task exceeded its time budget; reduce the input and retry.')), options.timeoutMs ?? 5000);
    worker.onmessage = event => event.data.error ? finish(new Error(event.data.error)) : finish(undefined, event.data.result);
    worker.onerror = event => finish(new Error(event.message || 'Worker failed'));
    worker.onmessageerror = () => finish(new Error('Invalid worker response'));
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    else { try { worker.postMessage(payload); } catch (error) { finish(error as Error); } }
  });
