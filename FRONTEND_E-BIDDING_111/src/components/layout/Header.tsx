import { Menu, User } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { currentPlant } = useDataStore();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-muted rounded-lg lg:hidden"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Admin User ({currentPlant?.name || 'N/A'})
        </span>
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
