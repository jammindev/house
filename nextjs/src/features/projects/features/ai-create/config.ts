import type { ProjectIntakeStep } from "./types";

export const PROJECT_INTAKE_ORDER: ProjectIntakeStep[] = [
  "title",
  "type",
  "startDate",
  "dueDate",
  "plannedBudget",
  "tags",
  "description",
];

export const PROJECT_INTAKE_LABELS: Record<ProjectIntakeStep, { en: string; fr: string }> = {
  title: {
    en: "Project name",
    fr: "Nom du projet",
  },
  type: {
    en: "Project type",
    fr: "Type de projet",
  },
  startDate: {
    en: "Start date",
    fr: "Date de début",
  },
  dueDate: {
    en: "Due date",
    fr: "Date cible",
  },
  plannedBudget: {
    en: "Planned budget",
    fr: "Budget prévisionnel",
  },
  tags: {
    en: "Tags",
    fr: "Étiquettes",
  },
  description: {
    en: "Description",
    fr: "Description",
  },
};

export const PROJECT_INTAKE_QUESTIONS: Record<ProjectIntakeStep, { en: string; fr: string }> = {
  title: {
    en: "What should we call this project?",
    fr: "Comment veux-tu nommer ce projet ?",
  },
  type: {
    en: "Which type fits best? (renovation, maintenance, repair, purchase, relocation, vacation, leisure, other)",
    fr: "Quel type correspond le mieux ? (rénovation, maintenance, réparation, achat, déménagement, vacances, loisir, autre)",
  },
  startDate: {
    en: "When would you like to start? Use YYYY-MM-DD or say 'skip'.",
    fr: "Quand veux-tu démarrer ? Format AAAA-MM-JJ ou réponds 'skip' pour passer.",
  },
  dueDate: {
    en: "Any target due date? Format YYYY-MM-DD or say 'skip'.",
    fr: "As-tu une date cible ? Format AAAA-MM-JJ ou 'skip' pour passer.",
  },
  plannedBudget: {
    en: "Do you have a planned budget? Share a number or say 'skip'.",
    fr: "As-tu un budget prévisionnel ? Donne un nombre ou 'skip' pour passer.",
  },
  tags: {
    en: "Any tags to help find it later? Separate them with commas.",
    fr: "Des étiquettes pour retrouver le projet ? Sépare-les avec des virgules.",
  },
  description: {
    en: "Add a short description or the main goal.",
    fr: "Ajoute une courte description ou l'objectif principal.",
  },
};
