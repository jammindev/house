import type { Config } from "tailwindcss";
import { Z_INDEX } from "./src/lib/design-tokens/z-index";

const config: Config = {
	darkMode: ["class"],
	content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			zIndex: {
				// Content layers
				'content-raised': Z_INDEX.content.raised.toString(),
				'content-sticky': Z_INDEX.content.sticky.toString(),

				// Interactive layers
				'interactive-dropdown': Z_INDEX.interactive.dropdown.toString(),
				'interactive-tooltip': Z_INDEX.interactive.tooltip.toString(),
				'interactive-popover': Z_INDEX.interactive.popover.toString(),

				// Navigation layers
				'nav-header': Z_INDEX.navigation.header.toString(),
				'nav-sidebar': Z_INDEX.navigation.sidebar.toString(),
				'nav-mobile': Z_INDEX.navigation.mobileMenu.toString(),

				// Overlay layers
				'overlay-backdrop': Z_INDEX.overlay.backdrop.toString(),
				'overlay-modal': Z_INDEX.overlay.modal.toString(),
				'overlay-sheet': Z_INDEX.overlay.sheet.toString(),
				'overlay-drawer': Z_INDEX.overlay.drawer.toString(),

				// System layers
				'system-toast': Z_INDEX.system.toast.toString(),
				'system-loading': Z_INDEX.system.loading.toString(),
				'system-debug': Z_INDEX.system.debug.toString(),

				// Emergency
				'emergency': Z_INDEX.emergency.toString(),
			},
			colors: {
				primary: {
					'50': 'var(--color-primary-50)',
					'100': 'var(--color-primary-100)',
					'200': 'var(--color-primary-200)',
					'300': 'var(--color-primary-300)',
					'400': 'var(--color-primary-400)',
					'500': 'var(--color-primary-500)',
					'600': 'var(--color-primary-600)',
					'700': 'var(--color-primary-700)',
					'800': 'var(--color-primary-800)',
					'900': 'var(--color-primary-900)',
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					'50': 'var(--color-secondary-50)',
					'100': 'var(--color-secondary-100)',
					'200': 'var(--color-secondary-200)',
					'300': 'var(--color-secondary-300)',
					'400': 'var(--color-secondary-400)',
					'500': 'var(--color-secondary-500)',
					'600': 'var(--color-secondary-600)',
					'700': 'var(--color-secondary-700)',
					'800': 'var(--color-secondary-800)',
					'900': 'var(--color-secondary-900)',
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
};

export default config;