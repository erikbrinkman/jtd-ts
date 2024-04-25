export function* concat<T>(
  ...iters: readonly Iterable<T>[]
): IterableIterator<T> {
  for (const iter of iters) {
    yield* iter;
  }
}

export function* map<T, R>(
  iter: Iterable<T>,
  func: (inp: T, idx: number) => R,
): IterableIterator<R> {
  let i = 0;
  for (const elem of iter) {
    yield func(elem, i++);
  }
}

export function* filter<T>(
  iter: Iterable<T>,
  pred: (inp: T, idx: number) => boolean,
): IterableIterator<T> {
  let i = 0;
  for (const elem of iter) {
    if (pred(elem, i++)) {
      yield elem;
    }
  }
}

export function* range(len: number): IterableIterator<number> {
  for (let i = 0; i < len; ++i) {
    yield i;
  }
}
