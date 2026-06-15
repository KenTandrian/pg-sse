import { EventEmitter } from "events";

export class TypedEmitter<Events extends object> {
  private emitter = new EventEmitter();

  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    this.emitter.on(event as string, listener);
    return this;
  }

  once<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    this.emitter.once(event as string, listener);
    return this;
  }

  off<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    this.emitter.off(event as string, listener);
    return this;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): boolean {
    return this.emitter.emit(event as string, payload);
  }

  addListener<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    this.emitter.addListener(event as string, listener);
    return this;
  }

  removeListener<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    this.emitter.removeListener(event as string, listener);
    return this;
  }

  removeAllListeners(event?: keyof Events): this {
    this.emitter.removeAllListeners(event as string);
    return this;
  }
}
