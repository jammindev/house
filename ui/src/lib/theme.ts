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
  localStorage.setItem('color_theme', colorTheme);
  const html = document.documentElement;
  html.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) html.classList.remove(cls);
  });
  html.classList.add(colorTheme);
}
