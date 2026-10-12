import type { Project, Review } from '../types';
export const criteria = [
  'Novidade',
  'Criatividade',
  'Incerteza tecnológica',
  'Sistematicidade',
  'Reprodutibilidade',
];
export function currentReviews(project: Project): Review[] {
  return (project.reviews || (project.review ? [project.review] : [])).filter(
    (r) => r.documentVersion === project.documentVersion,
  );
}
