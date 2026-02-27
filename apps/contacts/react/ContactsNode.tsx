type ContactsNodeProps = {
  section?: string;
};

export default function ContactsNode({ section = 'contacts' }: ContactsNodeProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">Contacts mini-app</h2>
      <p className="mt-1 text-sm text-muted-foreground">Django app scoped node: {section}</p>
    </section>
  );
}
