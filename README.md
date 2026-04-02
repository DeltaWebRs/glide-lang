# Glide

**Animations as a language, not as code.**

Glide is a domain-specific language for web animations. You write human-readable animation declarations — Glide compiles them to production-ready [GSAP](https://gsap.com/) JavaScript.

No GSAP expertise required. No boilerplate. Just intent.

---

## Why Glide?

Writing animations in JavaScript is verbose, repetitive, and hard to read later. Glide fixes that.

**Before (raw GSAP):**
```js
gsap.from(".hero", {
  opacity: 0,
  y: 50,
  duration: 0.8,
  ease: "power2.out",
  delay: 0.2
});

gsap.from(".cards", {
  opacity: 0,
  y: 50,
  duration: 0.6,
  ease: "power2.out",
  stagger: { each: 0.12, from: "start" }
});

document.querySelectorAll(".button").forEach(el => {
  el.addEventListener("mouseenter", () => gsap.to(el, { scale: 1.08, duration: 0.25, ease: "back.out(1.7)" }));
  el.addEventListener("mouseleave", () => gsap.to(el, { scale: 1, duration: 0.25 }));
});
```

**After (Glide):**
```glide
entrance .hero {
  effect: fadeUp
  duration: 0.8s
  delay: 0.2s
}

stagger .cards {
  effect: fadeUp
  each: 0.12s
}

hover .button {
  scale: 1.08
  ease: back
}
```

Same output. A fraction of the code. Readable by anyone on your team.

---

## Installation

```bash
npm install -g @glide-lang/compiler
```

---

## Usage

```bash
glide compile animations.glide -o animations.js
```

Then include the output in your project alongside GSAP:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
<script src="animations.js"></script>
```

---

## Syntax

### Config

Set global defaults for your entire animation file:

```glide
config {
  default-ease: smooth
  default-duration: 0.6s
  reduced-motion: respect
}
```

`reduced-motion: respect` wraps all output in a `prefers-reduced-motion` check automatically.

---

### Entrance & Exit

```glide
entrance .hero {
  effect: fadeUp
  duration: 0.8s
  delay: 0.2s
}

exit .modal {
  effect: fade
  duration: 0.3s
}
```

---

### Scroll

```glide
scroll .about {
  effect: fadeUp
  trigger: "top 80%"
}

scroll .parallax-bg {
  y: -100
  trigger: "top bottom"
  end: "bottom top"
  scrub: true
}
```

---

### Hover & Click

```glide
hover .button {
  scale: 1.08
  duration: 0.25s
  ease: back
}

click .menu-icon {
  rotate: 45
  duration: 0.3s
}
```

Glide automatically handles `mouseenter`/`mouseleave` and resets hover state — no extra code needed.

---

### Stagger

```glide
stagger .cards {
  effect: fadeUp
  each: 0.12s
  from: start
}
```

---

### Timeline

```glide
timeline pageLoad {
  step { target: .logo,     effect: fade }
  step { target: .navbar,   effect: slideDown, delay: 0.3s }
  step { target: .headline, effect: fadeUp,    duration: 1s }
  step { target: .cta,      effect: popIn,     ease: bounce }
}
```

---

### Custom Properties

Need full control? Use an explicit `properties` block:

```glide
entrance .custom {
  properties {
    opacity: 0
    x: -200
  }
  duration: 0.8s
  ease: smooth
}
```

---

## Effect Presets

| Name        | What it does                    |
|-------------|----------------------------------|
| `fade`      | Fade in                          |
| `fadeUp`    | Fade in + slide up               |
| `fadeDown`  | Fade in + slide down             |
| `fadeLeft`  | Fade in + slide from right       |
| `fadeRight` | Fade in + slide from left        |
| `zoomIn`    | Fade in + scale up from 80%      |
| `popIn`     | Scale up from zero               |
| `slideUp`   | Slide up (no fade)               |
| `slideDown` | Slide down (no fade)             |

---

## Ease Aliases

| Alias     | GSAP Value              |
|-----------|--------------------------|
| `smooth`  | `power2.out`             |
| `snap`    | `power4.out`             |
| `bounce`  | `bounce.out`             |
| `elastic` | `elastic.out(1, 0.3)`   |
| `back`    | `back.out(1.7)`          |
| `linear`  | `none`                   |

Any standard GSAP ease string works too: `ease: "power3.inOut"`.

---

## Animation Categories

Glide covers everything you need:

- **Entrance / Exit** — elements appearing and disappearing
- **Scroll** — scroll-triggered animations and parallax
- **Hover / Click** — interaction-driven motion
- **Stagger** — sequenced group animations
- **Timeline** — choreographed multi-step sequences

Coming soon: Text, SVG, Page Transitions, Morphing, Physics/Spring, Loop/Infinite, Cursor, 3D.

---

## Framework Agnostic

Glide compiles to plain JavaScript. It works anywhere GSAP works:

- Vanilla HTML/JS
- React / Vue / Svelte / Angular
- Webflow (via custom code)
- Framer
- Any other environment

The `.glide` file lives in your repo. It's readable, diffable, and reviewable — even by designers and project managers.

---

## Programmatic API

```js
const { compile } = require('@glide-lang/compiler');
const fs = require('fs');

const source = fs.readFileSync('animations.glide', 'utf8');
const output = compile(source);

fs.writeFileSync('animations.js', output);
```

---

## Roadmap

- [ ] VS Code extension (syntax highlighting + IntelliSense)
- [ ] Online playground
- [ ] Text animations
- [ ] SVG animations
- [ ] Page transitions
- [ ] Webflow export (Pro)
- [ ] Live preview (Pro)
- [ ] Glide Cloud — team collaboration

---

## License

MIT © [DeltaWebRs](https://github.com/DeltaWebRs)
