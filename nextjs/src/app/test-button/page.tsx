import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const variants: NonNullable<React.ComponentProps<typeof Button>["variant"]>[] = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
]

type ButtonVariant = (typeof variants)[number]

const buttonShowcases: {
  title: string
  baseClass?: string
  variantClasses: Record<ButtonVariant, string>
}[] = [
  {
    title: "Version 1 · Pilules douces",
    baseClass: "rounded-full font-semibold shadow-sm",
    variantClasses: {
      default: "bg-primary-500 text-white hover:bg-primary-600",
      destructive: "bg-red-500 text-white hover:bg-red-600",
      outline: "border-2 border-primary-200 text-primary-700 hover:bg-primary-50",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
      ghost: "bg-transparent text-primary-600 hover:bg-primary-50",
      link: "text-primary-600 underline hover:text-primary-700",
    },
  },
  {
    title: "Version 2 · Dégradé vibrant",
    baseClass: "font-semibold text-white shadow-lg shadow-primary/30",
    variantClasses: {
      default:
        "bg-gradient-to-r from-primary-500 via-indigo-500 to-fuchsia-500 hover:brightness-110",
      destructive:
        "bg-gradient-to-r from-rose-500 via-red-500 to-orange-400 hover:brightness-110",
      outline:
        "bg-gradient-to-r from-slate-900 to-slate-700 text-white border border-white/20 hover:brightness-110",
      secondary:
        "bg-gradient-to-r from-emerald-400 to-teal-500 hover:brightness-110",
      ghost: "bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900",
      link: "text-indigo-200 underline underline-offset-4 hover:text-white",
    },
  },
  {
    title: "Version 3 · Minimal mate",
    baseClass: "rounded-lg border border-transparent text-sm",
    variantClasses: {
      default: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
      destructive: "bg-rose-100 text-rose-800 hover:bg-rose-200",
      outline: "border border-zinc-300 text-zinc-800 hover:bg-white",
      secondary: "bg-slate-900 text-white hover:bg-slate-800",
      ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100",
      link: "text-zinc-700 underline hover:text-zinc-900",
    },
  },
  {
    title: "Version 4 · Nuances profondes",
    baseClass: "rounded-lg border border-transparent text-white shadow-md",
    variantClasses: {
      default: "bg-slate-900 hover:bg-slate-800",
      destructive: "bg-red-600 hover:bg-red-500",
      outline: "border border-slate-500 text-slate-100 hover:bg-slate-800",
      secondary: "bg-slate-700 hover:bg-slate-600",
      ghost: "bg-transparent text-slate-100 hover:bg-slate-800",
      link: "text-sky-300 underline hover:text-white",
    },
  },
  {
    title: "Version 5 · Verre givré",
    baseClass: "rounded-xl border border-white/40 bg-white/20 backdrop-blur text-slate-900 shadow-sm",
    variantClasses: {
      default: "bg-white/60 text-slate-900 hover:bg-white/80",
      destructive: "bg-rose-200/80 text-rose-800 hover:bg-rose-200",
      outline: "border border-white/60 text-slate-800 hover:bg-white/30",
      secondary: "bg-sky-100/80 text-sky-900 hover:bg-sky-100",
      ghost: "bg-transparent text-slate-800 hover:bg-white/30",
      link: "text-slate-800 underline hover:text-slate-900",
    },
  },
  {
    title: "Version 6 · Néon punchy",
    baseClass:
      "rounded-lg font-semibold text-black shadow-[0_10px_30px_-12px_rgba(132,204,22,0.7)]",
    variantClasses: {
      default: "bg-lime-400 hover:bg-lime-300",
      destructive: "bg-orange-400 hover:bg-orange-300",
      outline: "border-2 border-lime-400 text-black hover:bg-lime-100",
      secondary: "bg-yellow-300 hover:bg-yellow-200",
      ghost: "bg-transparent text-lime-600 hover:bg-lime-100",
      link: "text-lime-700 underline hover:text-lime-800",
    },
  },
  {
    title: "Version 7 · Retro pixel",
    baseClass: "rounded-none border-2 border-black bg-white px-5 font-bold shadow-[4px_4px_0_0_#000]",
    variantClasses: {
      default: "text-black hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000]",
      destructive: "bg-red-200 text-red-900 hover:bg-red-300",
      outline: "bg-yellow-200 text-yellow-900 hover:bg-yellow-300",
      secondary: "bg-teal-200 text-teal-900 hover:bg-teal-300",
      ghost: "bg-transparent text-black hover:bg-slate-100",
      link: "text-black underline hover:tracking-wide",
    },
  },
  {
    title: "Version 8 · Lignes fines",
    baseClass:
      "rounded-lg border border-slate-300 bg-white font-medium uppercase tracking-wide text-slate-900 shadow-sm",
    variantClasses: {
      default: "hover:bg-slate-50",
      destructive: "border-rose-300 text-rose-800 hover:bg-rose-50",
      outline: "border-2 border-dashed border-slate-400 hover:border-slate-500",
      secondary: "border-emerald-300 text-emerald-900 hover:bg-emerald-50",
      ghost: "border-none bg-transparent text-slate-700 hover:bg-slate-100",
      link: "border-none text-slate-700 underline hover:text-slate-900",
    },
  },
  {
    title: "Version 9 · Halo doux",
    baseClass: "rounded-full bg-white text-slate-900 shadow-md shadow-primary/20",
    variantClasses: {
      default: "border border-primary-200 hover:bg-primary-50",
      destructive: "border border-rose-300 hover:bg-rose-50",
      outline: "border-2 border-slate-200 hover:border-primary-300",
      secondary: "border border-emerald-200 hover:bg-emerald-50",
      ghost: "border border-transparent hover:border-slate-200",
      link: "border-none text-primary-700 underline hover:text-primary-800",
    },
  },
  {
    title: "Version 10 · Pastel superposé",
    baseClass: "rounded-2xl px-5 font-semibold shadow-sm",
    variantClasses: {
      default: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
      destructive: "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100",
      outline: "border-2 border-slate-200 text-slate-800 hover:bg-slate-50",
      secondary: "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100",
      ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
      link: "text-slate-700 underline hover:text-slate-900",
    },
  },
]

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export default function TestButtonPage() {
  return (
    <div className="space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Page de test — 10 styles de Buttons</h1>
        <p className="text-sm text-muted-foreground">
          Chaque version décline les variantes du composant Button sans changer son comportement, uniquement son style.
        </p>
      </header>

      {buttonShowcases.map((showcase) => (
        <section key={showcase.title} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">{showcase.title}</h2>
          <div className="flex flex-wrap items-center gap-3">
            {variants.map((variant) => (
              <Button
                key={`${showcase.title}-${variant}`}
                variant={variant}
                className={cn(showcase.baseClass, showcase.variantClasses[variant])}
              >
                {capitalize(variant)}
              </Button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
