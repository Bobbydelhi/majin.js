/**
 * Majin.js - Advanced Fine-Grained Reactive Framework v1
 * Features: Signals, Computed Properties, m-for, m-class, m-ref, JS Expressions
 */

export default class Majin {
  #el;
  #rawData;
  #methods;
  #computed;
  #hooks;
  
  static activeEffect = null;
  static targetMap = new WeakMap();

  constructor({ el, data = {}, computed = {}, methods = {}, hooks = {} }) {
    this.#el = typeof el === 'string' ? document.querySelector(el) : el;
    this.#rawData = data;
    this.#methods = methods;
    this.#computed = computed;
    this.#hooks = hooks;
    this.$refs = {};
    
    if (!this.#el) throw new Error('[Majin] Target element not found.');

    this.data = this.#createReactive(this.#rawData);
    this.#bindComputed();
    this.#compile(this.#el);
    
    if (this.#hooks.mounted) this.#hooks.mounted.call(this.#getContext());
  }

  #getContext(localScope = {}) {
    return { data: this.data, methods: this.#methods, el: this.#el, $refs: this.$refs, ...localScope };
  }

  #track(target, key) {
    if (Majin.activeEffect) {
      let depsMap = Majin.targetMap.get(target);
      if (!depsMap) Majin.targetMap.set(target, (depsMap = new Map()));
      let dep = depsMap.get(key);
      if (!dep) depsMap.set(key, (dep = new Set()));
      dep.add(Majin.activeEffect);
    }
  }

  #trigger(target, key) {
    const depsMap = Majin.targetMap.get(target);
    if (!depsMap) return;
    const dep = depsMap.get(key);
    if (dep) {
      dep.forEach(effect => effect());
      if (this.#hooks.updated) setTimeout(() => this.#hooks.updated.call(this.#getContext()), 0);
    }
  }

  #createReactive(targetObj) {
    const self = this;
    
    // Polyfill for array methods to ensure reactivity
    if (Array.isArray(targetObj)) {
      ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(method => {
        const original = targetObj[method];
        Object.defineProperty(targetObj, method, {
          value: function(...args) {
            const result = original.apply(this, args);
            self.#trigger(targetObj, 'length'); // Trigger length mutation
            return result;
          }
        });
      });
    }

    return new Proxy(targetObj, {
      get(target, property) {
        self.#track(target, property);
        const value = target[property];
        return typeof value === 'object' && value !== null 
          ? self.#createReactive(value) 
          : value;
      },
      set(target, property, value) {
        const oldValue = target[property];
        if (oldValue !== value) {
          target[property] = value;
          self.#trigger(target, property);
          // If setting an array index, trigger length as well
          if (Array.isArray(target) && !isNaN(property)) {
            self.#trigger(target, 'length');
          }
        }
        return true;
      }
    });
  }

  #createEffect(fn) {
    const effect = () => {
      Majin.activeEffect = effect;
      fn();
      Majin.activeEffect = null;
    };
    effect();
  }

  #bindComputed() {
    for (const [key, getter] of Object.entries(this.#computed)) {
      this.#rawData[key] = undefined; 
      this.#createEffect(() => {
        this.data[key] = getter.call(this.#getContext());
      });
    }
  }

  // Evaluates JS expressions safely tracking dependencies
  #evaluate(expr, localScope = {}) {
    const context = new Proxy(this.data, {
      get(target, prop) {
        if (prop in localScope) return localScope[prop];
        return target[prop];
      },
      has(target, prop) {
        return prop in localScope || prop in target;
      }
    });
    try {
      return new Function('data', `with(data) { return (${expr}); }`)(context);
    } catch (e) {
      console.warn(`[Majin] Expression Error: ${expr}`, e);
      return undefined;
    }
  }

  #compile(node, localScope = {}) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // m-for (Must be processed first because it manipulates its own children)
    if (node.hasAttribute('m-for')) {
      const expr = node.getAttribute('m-for');
      node.removeAttribute('m-for');
      const match = expr.match(/(.*?)\s+in\s+(.*)/);
      
      if (match) {
        const [, itemName, arrayName] = match;
        const parent = node.parentNode;
        const comment = document.createComment(` m-for: ${expr} `);
        parent.insertBefore(comment, node);
        parent.removeChild(node);

        const renderedNodes = [];

        this.#createEffect(() => {
          const array = this.#evaluate(arrayName, localScope) || [];
          
          // Cleanup old nodes
          renderedNodes.forEach(n => n.parentNode && n.parentNode.removeChild(n));
          renderedNodes.length = 0;

          // Render new nodes
          array.forEach((item, index) => {
            const clone = node.cloneNode(true);
            const childScope = { ...localScope, [itemName]: item, index };
            this.#compile(clone, childScope); // recursively compile
            parent.insertBefore(clone, comment);
            renderedNodes.push(clone);
          });
        });
        return; // Stop compiling this node further, clones are handling it
      }
    }

    if (node.attributes) {
      const attrs = Array.from(node.attributes);
      for (const attr of attrs) {
        
        // m-ref (Template Refs)
        if (attr.name === 'm-ref') {
          this.$refs[attr.value] = node;
        }
        
        // m-bind
        else if (attr.name === 'm-bind') {
          this.#createEffect(() => {
            const val = this.#evaluate(attr.value, localScope);
            node.textContent = val !== undefined ? val : '';
          });
        }
        
        // m-class (Dynamic Classes)
        else if (attr.name === 'm-class') {
          this.#createEffect(() => {
            const classObj = this.#evaluate(attr.value, localScope);
            if (typeof classObj === 'object') {
              for (const [className, condition] of Object.entries(classObj)) {
                if (condition) node.classList.add(className);
                else node.classList.remove(className);
              }
            }
          });
        }
        
        // m-model (Enhanced to support checkboxes/selects)
        else if (attr.name === 'm-model') {
          const isCheckbox = node.type === 'checkbox';
          this.#createEffect(() => {
            const val = this.#evaluate(attr.value, localScope);
            if (isCheckbox) node.checked = !!val;
            else node.value = val ?? '';
          });
          
          node.addEventListener('input', (e) => {
            const val = isCheckbox ? e.target.checked : e.target.value;
            // Assuming simple path for model writes (user.name)
            const keys = attr.value.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((acc, key) => (acc || {})[key], this.data);
            if (target) target[lastKey] = val;
          });
        }
        
        // m-on (Event Listeners)
        else if (attr.name.startsWith('m-on:')) {
          const eventName = attr.name.substring(5);
          node.addEventListener(eventName, (e) => {
            // Can be method call or inline expression
            const expr = attr.value;
            if (this.#methods[expr]) {
              this.#methods[expr].call(this.#getContext(localScope), e, localScope);
            } else {
              this.#evaluate(expr, { ...localScope, $event: e });
            }
          });
        }
        
        // m-if
        else if (attr.name === 'm-if') {
          const parent = node.parentNode;
          const comment = document.createComment(` m-if: ${attr.value} `);
          parent.insertBefore(comment, node);
          
          this.#createEffect(() => {
            const truthy = !!this.#evaluate(attr.value, localScope);
            if (truthy && !node.parentNode) {
              comment.parentNode.insertBefore(node, comment.nextSibling);
            } else if (!truthy && node.parentNode) {
              node.parentNode.removeChild(node);
            }
          });
        }
      }
    }

    Array.from(node.childNodes).forEach(child => this.#compile(child, localScope));
  }
}
