interface MobileDomMutationScope {
  setClass(element: Element, className: string, enabled: boolean): void;
  setAttribute(element: Element, name: string, value: string): void;
  ownNode<T extends Node>(node: T): T;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void;
  restore(): void;
}

interface AttributeSnapshot {
  present: boolean;
  value: string | null;
}

function createMobileDomMutationScope(): MobileDomMutationScope {
  const classSnapshots = new Map<Element, Map<string, boolean>>();
  const attributeSnapshots = new Map<Element, Map<string, AttributeSnapshot>>();
  const ownedNodes: Node[] = [];
  const listenerCleanups: Array<() => void> = [];
  let restored = false;

  const captureClass = (element: Element, className: string): void => {
    let elementSnapshots = classSnapshots.get(element);
    if (!elementSnapshots) {
      elementSnapshots = new Map<string, boolean>();
      classSnapshots.set(element, elementSnapshots);
    }
    if (!elementSnapshots.has(className)) {
      elementSnapshots.set(className, element.classList.contains(className));
    }
  };

  const captureAttribute = (element: Element, name: string): void => {
    let elementSnapshots = attributeSnapshots.get(element);
    if (!elementSnapshots) {
      elementSnapshots = new Map<string, AttributeSnapshot>();
      attributeSnapshots.set(element, elementSnapshots);
    }
    if (!elementSnapshots.has(name)) {
      elementSnapshots.set(name, {
        present: element.hasAttribute(name),
        value: element.getAttribute(name),
      });
    }
  };

  return {
    setClass(element: Element, className: string, enabled: boolean): void {
      if (restored) return;
      captureClass(element, className);
      element.classList.toggle(className, enabled);
    },
    setAttribute(element: Element, name: string, value: string): void {
      if (restored) return;
      captureAttribute(element, name);
      element.setAttribute(name, value);
    },
    ownNode<T extends Node>(node: T): T {
      if (!restored) ownedNodes.push(node);
      return node;
    },
    listen(
      target: EventTarget,
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions | boolean,
    ): void {
      if (restored) return;
      target.addEventListener(type, listener, options);
      listenerCleanups.push(() => target.removeEventListener(type, listener, options));
    },
    restore(): void {
      if (restored) return;
      restored = true;
      listenerCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
      ownedNodes.splice(0).reverse().forEach((node) => node.parentNode?.removeChild(node));
      attributeSnapshots.forEach((snapshots, element) => {
        snapshots.forEach((snapshot, name) => {
          if (snapshot.present) element.setAttribute(name, snapshot.value || '');
          else element.removeAttribute(name);
        });
      });
      classSnapshots.forEach((snapshots, element) => {
        snapshots.forEach((present, className) => {
          element.classList.toggle(className, present);
        });
      });
      attributeSnapshots.clear();
      classSnapshots.clear();
    },
  };
}

export {
  createMobileDomMutationScope,
};

export type {
  MobileDomMutationScope,
};
