export class TimeoutError extends Error {
  constructor(message = "请求超时") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
