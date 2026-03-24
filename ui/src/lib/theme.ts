export function applyDarkMode(theme: string) {
  localStorage.setItem('theme', theme);
  const html = document.documentElement;
  html.classList.remove('dark');
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }
  }
}

export function applyColorTheme(colorTheme: string) {
  document.body.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) document.body.classList.remove(cls);
  });
  document.body.classList.add(colorTheme);
}
