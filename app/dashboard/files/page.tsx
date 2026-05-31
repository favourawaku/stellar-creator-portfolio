import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { IpfsStorageBrowser } from '@/components/ipfs/ipfs-storage-browser';

export const metadata = {
  title: 'Decentralized Files | Stellar',
  description: 'Browse and pin files to IPFS decentralized storage',
};

export default function DashboardFilesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow py-12 px-4">
        <IpfsStorageBrowser />
      </main>
      <Footer />
    </div>
  );
}
