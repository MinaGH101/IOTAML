import type { ReactNode } from 'react';
import type { Project } from '../../../../shared/types';
import { EmptyState } from '../../../../shared/ui';
import { ProjectCard } from './ProjectCard';

export function ProjectSection({ icon, title, subtitle, projects, emptyText, className = '', onOpen }: { icon: ReactNode; title: string; subtitle?: ReactNode; projects: Project[]; emptyText: string; className?: string; onOpen: (project: Project) => void }) {
  return <section className={`project-access-section ${className}`}>
    <div className="project-section-heading"><span>{icon}<b>{title}</b></span><small>{subtitle}</small></div>
    <div className="project-reference-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project)} />)}{projects.length === 0 && <EmptyState compact>{emptyText}</EmptyState>}</div>
  </section>;
}
