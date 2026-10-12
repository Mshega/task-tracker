# Task Tracker

A clean, responsive task management app built with React and Vite. Tasks persist across page reloads using localStorage, and the UI adapts to both light and dark system themes.

## Features

- Add tasks with a title; empty submissions are ignored
- Mark tasks as completed or pending via checkbox
- Inline editing with save and cancel; empty titles are rejected
- Delete tasks with a confirmation prompt
- Filter the list by All, Pending, or Completed
- Live task counts (total, pending, completed)
- Automatic localStorage persistence — changes survive page refresh
- Responsive layout that works on mobile and desktop
- Light and dark mode via `prefers-color-scheme`

## Technologies

- [React 19](https://react.dev/) — UI and state management
- [Vite 8](https://vite.dev/) — development server and production bundler
- CSS custom properties — theming and design tokens
- localStorage — client-side persistence (no backend required)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later (bundled with Node.js)

## Installation

```bash
git clone https://github.com/your-username/task-tracker.git
cd task-tracker
npm install
```

## Development

Start the local development server with hot module replacement:

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Production Build

Compile and minify for production:

```bash
npm run build
```

Output is written to the `dist/` folder. Preview the production build locally:

```bash
npm run preview
```
