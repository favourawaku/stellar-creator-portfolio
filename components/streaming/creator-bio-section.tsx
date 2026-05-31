import { fetchCreatorBio } from '@/lib/streaming/chunk-data';
import { RichTextContent } from '@/components/ui/rich-text';

export async function CreatorBioSection({ id }: { id: string }) {
  const data = await fetchCreatorBio(id);
  if (!data) return null;

  return (
    <>
      <p className="text-lg italic text-muted-foreground mb-4">&ldquo;{data.tagline}&rdquo;</p>
      <div className="mb-8 max-w-3xl">
        {data.bio.startsWith('<') ? (
          <RichTextContent html={data.bio} />
        ) : (
          <p className="text-foreground leading-relaxed">{data.bio}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-12">
        {data.skills.map((skill) => (
          <span key={skill} className="px-3 py-1 text-sm bg-muted rounded-full text-foreground">
            {skill}
          </span>
        ))}
      </div>
    </>
  );
}
