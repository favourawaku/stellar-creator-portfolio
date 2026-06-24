export type SkillCategory =
  | 'Languages'
  | 'Frameworks'
  | 'Design'
  | 'Disciplines'
  | 'Tools'
  | 'Blockchain';

export interface SkillNode {
  id: string;
  name: string;
  aliases: string[];
  category: SkillCategory;
  parentId?: string;
}

export const SKILLS_TAXONOMY: SkillNode[] = [
  // Languages
  { id: 'typescript', name: 'TypeScript', aliases: ['ts', 'TS'], category: 'Languages' },
  { id: 'javascript', name: 'JavaScript', aliases: ['js', 'JS', 'ES6', 'ESNext'], category: 'Languages' },
  { id: 'rust', name: 'Rust', aliases: ['rust-lang'], category: 'Languages' },
  { id: 'python', name: 'Python', aliases: ['py', 'python3'], category: 'Languages' },
  { id: 'go', name: 'Go', aliases: ['golang'], category: 'Languages' },
  { id: 'solidity', name: 'Solidity', aliases: ['sol'], category: 'Languages' },
  { id: 'swift', name: 'Swift', aliases: [], category: 'Languages' },
  { id: 'kotlin', name: 'Kotlin', aliases: [], category: 'Languages' },

  // Frameworks
  { id: 'react', name: 'React', aliases: ['ReactJS', 'react.js'], category: 'Frameworks' },
  { id: 'nextjs', name: 'Next.js', aliases: ['nextjs', 'next'], category: 'Frameworks' },
  { id: 'vue', name: 'Vue', aliases: ['VueJS', 'vue.js', 'Vue 3'], category: 'Frameworks' },
  { id: 'svelte', name: 'Svelte', aliases: ['SvelteKit'], category: 'Frameworks' },
  { id: 'express', name: 'Express', aliases: ['expressjs', 'express.js'], category: 'Frameworks' },
  { id: 'nestjs', name: 'NestJS', aliases: ['nest'], category: 'Frameworks' },
  { id: 'react-native', name: 'React Native', aliases: ['RN', 'react native'], category: 'Frameworks' },

  // Blockchain
  { id: 'soroban', name: 'Soroban', aliases: ['soroban-sdk', 'soroban sdk'], category: 'Blockchain' },
  { id: 'stellar', name: 'Stellar', aliases: ['XLM', 'stellar network'], category: 'Blockchain' },
  { id: 'ethereum', name: 'Ethereum', aliases: ['ETH', 'EVM'], category: 'Blockchain' },
  { id: 'solana', name: 'Solana', aliases: ['SOL'], category: 'Blockchain' },
  { id: 'polkadot', name: 'Polkadot', aliases: ['DOT', 'substrate'], category: 'Blockchain' },

  // Design
  { id: 'figma', name: 'Figma', aliases: [], category: 'Design' },
  { id: 'tailwindcss', name: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'], category: 'Design' },
  { id: 'css', name: 'CSS', aliases: ['CSS3'], category: 'Design' },
  { id: 'scss', name: 'SCSS', aliases: ['sass', 'SASS'], category: 'Design' },
  { id: 'framer', name: 'Framer', aliases: ['framer motion'], category: 'Design' },

  // Disciplines
  { id: 'uiux', name: 'UI/UX Design', aliases: ['UX', 'UI', 'user experience', 'user interface'], category: 'Disciplines' },
  { id: 'smart-contracts', name: 'Smart Contracts', aliases: ['smart contract'], category: 'Disciplines' },
  { id: 'defi', name: 'DeFi', aliases: ['decentralized finance'], category: 'Disciplines' },
  { id: 'nft', name: 'NFT', aliases: ['nfts', 'non-fungible token'], category: 'Disciplines' },
  { id: 'web3', name: 'Web3', aliases: ['web 3', 'dapp', 'dapps'], category: 'Disciplines' },
  { id: 'devops', name: 'DevOps', aliases: ['CI/CD', 'cicd', 'sre'], category: 'Disciplines' },
  { id: 'ml', name: 'Machine Learning', aliases: ['ML', 'AI', 'artificial intelligence'], category: 'Disciplines' },

  // Tools
  { id: 'docker', name: 'Docker', aliases: ['containers', 'dockerfile'], category: 'Tools' },
  { id: 'git', name: 'Git', aliases: ['github', 'gitlab'], category: 'Tools' },
  { id: 'postgresql', name: 'PostgreSQL', aliases: ['postgres', 'pg', 'psql'], category: 'Tools' },
  { id: 'redis', name: 'Redis', aliases: ['redis cache'], category: 'Tools' },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'], category: 'Tools' },
  { id: 'kubernetes', name: 'Kubernetes', aliases: ['k8s', 'k8'], category: 'Tools' },
];

export function searchSkills(query: string, limit = 8): SkillNode[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  const nameMatches: SkillNode[] = [];
  const aliasMatches: SkillNode[] = [];

  for (const skill of SKILLS_TAXONOMY) {
    if (skill.name.toLowerCase().includes(q)) {
      nameMatches.push(skill);
    } else if (skill.aliases.some((a) => a.toLowerCase().includes(q))) {
      aliasMatches.push(skill);
    }
  }

  return [...nameMatches, ...aliasMatches].slice(0, limit);
}

export function resolveSkillId(input: string): string | null {
  const q = input.toLowerCase().trim();
  for (const skill of SKILLS_TAXONOMY) {
    if (
      skill.name.toLowerCase() === q ||
      skill.aliases.some((a) => a.toLowerCase() === q)
    ) {
      return skill.id;
    }
  }
  return null;
}

export function getSkillById(id: string): SkillNode | undefined {
  return SKILLS_TAXONOMY.find((s) => s.id === id);
}
