import { describe, it, expect, vi } from "vitest";
import { TypedEmitter } from "./emitter";

interface TestEvents {
  basic: string;
  multiple: { id: number; name: string };
  empty: void;
}

describe("TypedEmitter", () => {
  it("should subscribe to and receive basic events", () => {
    const emitter = new TypedEmitter<TestEvents>();
    const callback = vi.fn();

    emitter.on("basic", callback);
    emitter.emit("basic", "hello");

    expect(callback).toHaveBeenCalledWith("hello");
  });

  it("should support once listener", () => {
    const emitter = new TypedEmitter<TestEvents>();
    const callback = vi.fn();

    emitter.once("basic", callback);
    emitter.emit("basic", "one");
    emitter.emit("basic", "two");

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("one");
  });

  it("should unsubscribe from events", () => {
    const emitter = new TypedEmitter<TestEvents>();
    const callback = vi.fn();

    emitter.on("basic", callback);
    emitter.off("basic", callback);
    emitter.emit("basic", "hello");

    expect(callback).not.toHaveBeenCalled();
  });

  it("should pass complex structures cleanly", () => {
    const emitter = new TypedEmitter<TestEvents>();
    const callback = vi.fn();
    const payload = { id: 42, name: "test-user" };

    emitter.on("multiple", callback);
    emitter.emit("multiple", payload);

    expect(callback).toHaveBeenCalledWith(payload);
  });

  it("should remove all listeners", () => {
    const emitter = new TypedEmitter<TestEvents>();
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    emitter.on("basic", callback1);
    emitter.on("basic", callback2);

    emitter.removeAllListeners("basic");
    emitter.emit("basic", "hello");

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });
});
