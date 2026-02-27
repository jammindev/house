type TasksNodeProps = {
  section?: string;
};

export default function TasksNode({ section = 'tasks' }: TasksNodeProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">Tasks mini-app</h2>
      <p className="mt-1 text-sm text-muted-foreground">Django app scoped node: {section}</p>
    </section>
  );
}
