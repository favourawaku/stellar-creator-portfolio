import { fetchCreatorProjects } from '@/lib/streaming/chunk-data';
import { ProjectCard } from '@/components/project-card';

export async function CreatorProjectsSection({ id }: { id: string }) {
  const projects = await fetchCreatorProjects(id);

  if (projects.length === 0) {
    return <p className="text-muted-foreground">No projects yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
