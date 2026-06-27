# Majin.js

A zero-dependency, insanely lightweight, reactive JavaScript framework built from absolute zero. 

**Note: This project is in Day 0. It is currently being architected and built from scratch as part of a university thesis to prove the power of open-source community collaboration.**

## Why Majin.js?

*Inspired by the regenerative and absorbing powers of Majin Buu from Dragon Ball, this framework is designed to be impossibly light but infinitely adaptable.*

Modern web development is plagued by heavy tools, massive dependency trees, and corporate-backed monoliths. Majin.js is an experiment and a challenge: Can a decentralized community build a robust, deep-reactive frontend framework using only modern Vanilla JavaScript?

* **Deep Reactivity:** Built on JS Proxies. Direct, surgical DOM updates without a Virtual DOM.
* **Zero Dependencies:** No massive `node_modules` required to render a simple interface.
* **New Paradigms:** We are rethinking data-binding syntax. 

## Get Involved

We need your help to build this. Whether you are a junior developer looking to understand how frameworks work under the hood, or a senior architect wanting to flex your Vanilla JS skills:

1. Read our [CONTRIBUTING.md](CONTRIBUTING.md).
2. Check the active Issues for architecture discussions.
3. Fork, build, and submit PRs.

---

## Technical Preview (The MVP Engine)
*While the framework is in Day 0, our core MVP engine already supports advanced capabilities:*

- **List Rendering (`m-for`)**: Granular array reactivity. Pushing or splicing an array only modifies the exact DOM nodes involved.
- **Dynamic Classes (`m-class`)**: Safely bind CSS classes to boolean state logic.
- **Template Refs (`m-ref`)**: Direct, native access to DOM nodes from your Javascript via `this.$refs`.
- **Expression Evaluation**: Directives like `m-bind` and `m-on` accept full Javascript expressions (e.g. `m-bind="cpuLoad > 80 ? 'High' : 'Normal'"`).

## Usage Example

```html
<div id="app">
  <!-- Template Refs & Two-way Binding -->
  <input m-ref="taskInput" m-model="newTask" type="text">
  <button m-on:click="addTask">Add Task</button>

  <!-- List Rendering & Dynamic Classes -->
  <div m-for="task in tasks" m-class="{ 'completed': task.done }">
    <input type="checkbox" m-model="task.done">
    <span m-bind="task.name"></span>
    
    <!-- Using loop context index -->
    <button m-on:click="tasks.splice(index, 1)">Delete</button>
  </div>
</div>

<script type="module">
  import Majin from './src/core.js';
  
  new Majin({
    el: '#app',
    data: { tasks: [], newTask: '' },
    methods: {
      addTask() {
        if (!this.data.newTask) return;
        this.data.tasks.push({ name: this.data.newTask, done: false });
        this.data.newTask = '';
        this.$refs.taskInput.focus(); // Direct DOM manipulation
      }
    }
  });
</script>
```

## License
[MIT](LICENSE)
